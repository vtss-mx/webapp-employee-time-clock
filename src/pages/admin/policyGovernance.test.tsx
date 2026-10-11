import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { describeFieldChange, fieldLabel, fieldValue, withChanges } from '../../components/policy/policyFields';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { catalogsWith, testCatalogs } from '../../test/catalogs';
import { riskSignal, sampleAdminPolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { AdminVerificationPolicy, PolicyChange, RiskSimulation } from '../../types';
import { CompanyPolicyPage } from './CompanyPolicyPage';
import { RejectPolicyChangePage } from './RejectPolicyChangePage';

const company = { id: 4, name: 'Panificadora', active: true, employee_count: 3, admin_count: 1 };
const learning = { enabled: true, approved_employees: 3, employees_learning: 1, learned_samples: 2, identifications: 9, learned_identifications: 1, last_learned_at: null };
const URL = '/api/admin/companies/4/verification-policy';

const simulation: RiskSimulation = {
  days: 30,
  evaluated: 120,
  capped: true,
  current: { allow: 110, alert: 4, step_up: 4, review: 1, deny: 1 },
  candidate: { allow: 100, alert: 4, step_up: 10, review: 4, deny: 2 },
  stricter: 10,
  looser: 1,
  frauds_stopped: 2,
  frauds: 3,
  genuine_affected: 8,
  top_reasons: [
    { code: 'SPOOF_PROB_LOW', count: 6 },
    { code: 'DESCONOCIDA', count: 2 },
  ],
};

function change(extra: Partial<PolicyChange> = {}): PolicyChange {
  return {
    id: 21,
    status: 'PENDING',
    relaxes: true,
    preset: null,
    changes: [{ field: 'block_virtual_cameras', before: true, after: false, relaxes: true }],
    reason: 'Cámaras de la planta',
    simulation: null,
    requested_by: 'otro@plataforma.com',
    requested_by_me: false,
    created_at: '2026-10-01T10:00:00Z',
    expires_at: '2026-10-04T10:00:00Z',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    ...extra,
  };
}

interface Server {
  policy?: AdminVerificationPolicy;
  changes?: PolicyChange[];
  /** Respuesta de cada escritura (PUT de la política, nivel, aprobar, cancelar, simular...). */
  write?: (call: MockCall) => Response;
}

/** La consola del ADMIN: empresa, aprendizaje, política (con su motor) e historial de cambios. */
function serve({ policy = sampleAdminPolicy, changes = [], write }: Server = {}) {
  return mockFetch((call) => {
    if (call.url.endsWith('/face-learning')) return apiOk(learning);
    if (call.init.method === 'POST' || call.init.method === 'PUT') return (write as (call: MockCall) => Response)(call);
    if (call.url.includes('/verification-policy/changes')) return apiOk({ items: changes, total: changes.length, page: 1, size: 5 });
    if (call.url.includes('/verification-policy')) return apiOk(policy);
    return apiOk(company);
  });
}

const body = (call: MockCall | undefined) => JSON.parse(call?.init.body as string) as unknown;
const writes = (calls: MockCall[]) => calls.filter((c) => c.init.method === 'POST' || c.init.method === 'PUT');

function renderPage(route = '/admin/companies/4/policy', catalogs = testCatalogs) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/companies/:id/policy" element={<CompanyPolicyPage />} />
      <Route path="/admin/companies/:id/policy/changes/:changeId/reject" element={<RejectPolicyChangePage />} />
    </Routes>,
    { route, catalogs },
  );
}

afterEach(() => resetPolicyCache());

describe('Política: regla de dos personas', () => {
  it('relajar un candado queda por aprobar: la confirmación lo dice, el aviso también y el interruptor sigue encendido', async () => {
    const pending = change({ requested_by_me: true, requested_by: 'superadmin@plataforma.com' });
    const { calls } = serve({ write: () => apiOk({ policy: { ...sampleAdminPolicy, pending_changes: 1 }, change: pending }) });
    renderPage();
    const lock = await screen.findByRole('switch', { name: 'Bloquear cámaras virtuales' });
    await userEvent.click(lock);
    const confirm = await screen.findByRole('alertdialog', { name: '¿Desactivar «Bloquear cámaras virtuales»?' });
    expect(confirm).toHaveTextContent('otro administrador debe aprobarlo antes de que aplique');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Desactivar' }));
    const notice = await screen.findByRole('dialog', { name: 'Cambio por aprobar' });
    expect(notice).toHaveTextContent('Mientras tanto, la política sigue igual.');
    expect(lock).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByText('1 por aprobar')).toBeInTheDocument();
    // El historial se vuelve a pedir tras pedir un cambio.
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/changes?')).length).toBe(2));
  });

  it('apagar el motor de riesgo o la evidencia se confirma con lo que se pierde', async () => {
    serve({ write: (call) => apiOk({ policy: withChanges(sampleAdminPolicy, body(call) as object), change: null }) });
    renderPage();
    await userEvent.click(await screen.findByRole('switch', { name: 'Motor de riesgo' }));
    expect(await screen.findByRole('alertdialog', { name: '¿Desactivar «Motor de riesgo»?' })).toHaveTextContent('Las señales dejarán de sumarse');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Guardar evidencia de los intentos sospechosos' }));
    expect(await screen.findByRole('alertdialog', { name: '¿Desactivar «Guardar evidencia de los intentos sospechosos»?' })).toHaveTextContent('Los casos se abren sin fotogramas');
  });
});

describe('Política: niveles predefinidos', () => {
  it('el vigente se marca; aplicar otro se confirma y avisa (aplicado o por aprobar)', async () => {
    let pending = false;
    const { calls } = serve({
      write: () => {
        pending = !pending;
        return apiOk({ policy: { ...sampleAdminPolicy, preset: pending ? 'STANDARD' : 'HIGH' }, change: pending ? change() : change({ status: 'APPLIED' }) });
      },
    });
    renderPage();
    expect(await screen.findByText('Nivel vigente: Estándar')).toBeInTheDocument();
    const cards = screen.getAllByRole('button', { name: 'Aplicar nivel' });
    expect(cards).toHaveLength(2);
    await userEvent.click(cards[0]);
    const dialog = await screen.findByRole('dialog', { name: '¿Aplicar el nivel «Alto»?' });
    expect(dialog).toHaveTextContent('todo el nivel espera la aprobación de otro administrador');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aplicar nivel' }));
    expect(await screen.findByRole('dialog', { name: 'Cambio por aprobar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Aplicar nivel' })[0]);
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Aplicar el nivel «Alto»?' })).getByRole('button', { name: 'Aplicar nivel' }));
    expect(await screen.findByRole('dialog', { name: 'Nivel Alto aplicado' })).toHaveTextContent('Más exigente:');
    expect(writes(calls).map((c) => [c.url, body(c)])).toEqual([
      [`${URL}/preset`, { preset: 'HIGH', reason: null }],
      [`${URL}/preset`, { preset: 'HIGH', reason: null }],
    ]);
  });

  it('sin nivel: a la medida; sin la regla de dos personas la nota es la de siempre', async () => {
    serve({ policy: { ...sampleAdminPolicy, preset: null, two_person_rule: false } });
    renderPage();
    expect(await screen.findByText('Nivel vigente: a la medida')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Aplicar nivel' })[0]);
    expect(await screen.findByRole('dialog', { name: '¿Aplicar el nivel «Estándar»?' })).toHaveTextContent('cada control cambiado queda en el historial');
    expect(screen.getByText(/Quién cambió qué y cuándo \(antes → después\)\.$/)).toBeInTheDocument();
  });
});

describe('Política: motor de riesgo', () => {
  /** Elige un valor de un ajuste (todavía no guarda: primero se confirma). */
  async function choose(control: RegExp, option: string | RegExp) {
    // El primero: la simulación repite las acciones de cada nivel más abajo.
    await userEvent.click(screen.getAllByRole('button', { name: control })[0]);
    await userEvent.click(screen.getByRole('option', { name: option }));
  }
  async function save(title: string, role: 'dialog' | 'alertdialog' = 'dialog') {
    await userEvent.click(within(await screen.findByRole(role, { name: title })).getByRole('button', { name: 'Guardar ajuste' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));
  }

  it('cortes en orden, acciones, respaldo, sospecha de duplicado, dispositivo y cada señal: cada uno con su confirmación', async () => {
    const { calls } = serve({ write: (call) => apiOk({ policy: withChanges(sampleAdminPolicy, body(call) as object), change: null }) });
    renderPage();
    await screen.findByRole('heading', { name: 'Motor de riesgo' });
    // El corte medio solo ofrece valores bajo el alto (60).
    await userEvent.click(screen.getByRole('button', { name: /Riesgo medio desde/ }));
    expect(screen.queryByRole('option', { name: '65 pts' })).toBeNull();
    await userEvent.click(screen.getByRole('option', { name: '25 pts' }));
    await save('¿Cambiar «Riesgo medio desde» a 25 pts?');
    await choose(/Riesgo crítico desde/, '90 pts');
    await save('¿Cambiar «Riesgo crítico desde» a 90 pts?', 'alertdialog');
    await choose(/Con riesgo alto/, /^Negar/);
    await save('¿Cambiar «Con riesgo alto» a Negar?');
    await userEvent.click(screen.getByRole('button', { name: /Si el motor falla/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Reintentar'), expect.stringContaining('Bloquear la operación')]));
    expect(screen.queryByRole('option', { name: /^Permitir/ })).toBeNull();
    await userEvent.click(screen.getByRole('option', { name: /^Reintentar/ }));
    await save('¿Cambiar «Si el motor falla» a Reintentar?', 'alertdialog');
    await choose(/Sospecha de rostro duplicado/, /95/);
    await save('¿Cambiar «Sospecha de rostro duplicado» a 95 %?');
    await choose(/Dispositivo del empleado/, /Aprobación de la empresa/);
    await save('¿Cambiar «Dispositivo del empleado» a Aprobación de la empresa?');
    const spoof = screen.getByText('Probabilidad de rostro real baja').closest('li') as HTMLElement;
    expect(spoof).toHaveTextContent('Fraudes confirmados: 2 · Falsos positivos: 1');
    expect(spoof).toHaveTextContent('Plataforma: Obligatoria · 20 pts');
    expect(within(screen.getByText('Reenvío perceptual').closest('li') as HTMLElement).getByText('Regla dura')).toBeInTheDocument();
    expect(within(screen.getByText('Cámara sin nombre').closest('li') as HTMLElement).getByText('La informa el dispositivo')).toBeInTheDocument();
    await choose(/Modo de «Probabilidad de rostro real baja»/, /^Solo medir/);
    await save('¿Cambiar «Modo de «Probabilidad de rostro real baja»» a Solo medir?', 'alertdialog');
    await choose(/Puntos de «Cámara sin nombre»/, '40 pts');
    await save('¿Cambiar «Puntos de «Cámara sin nombre»» a 40 pts?');
    expect(writes(calls).map(body)).toEqual([
      { risk_medium_score: 25 },
      { risk_critical_score: 90 },
      { risk_high_action: 'DENY' },
      { risk_failure_policy: 'RETRY' },
      { duplicate_confidence: 0.95 },
      { employee_device_mode: 'APPROVAL' },
      { risk_signals: { SPOOF_PROB_LOW: { mode: 'OBSERVE' } } },
      { risk_signals: { CAMERA_LABEL_MISSING: { points: 40 } } },
    ]);
  });

  it('una señal que solo se mide (el pulso por video) no ofrece «Obligatoria» y lo dice', async () => {
    const pulse = riskSignal('PULSE_ABSENT', { name: 'Sin pulso visible (solo se mide)', points: 0, default_points: 0, measure_only: true });
    serve({ policy: { ...sampleAdminPolicy, risk_signals: [...sampleAdminPolicy.risk_signals, pulse] } });
    renderPage();
    const row = (await screen.findByText('Sin pulso visible (solo se mide)')).closest('li') as HTMLElement;
    expect(within(row).getByText('Solo se mide')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: /Modo de «Sin pulso visible/ }));
    expect(screen.queryByRole('option', { name: /^Obligatoria/ })).toBeNull();
    expect(screen.getByRole('option', { name: /^Apagada/ })).toBeInTheDocument();
  });

  it('apagado, sus ajustes no se pueden cambiar; sin detectar duplicados, tampoco la sospecha', async () => {
    serve({ policy: { ...sampleAdminPolicy, risk_engine: false, detect_duplicate_faces: false } });
    renderPage();
    expect(await screen.findByRole('button', { name: /Riesgo medio desde/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Sospecha de rostro duplicado/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Modo de «Reenvío perceptual»/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Dispositivo del empleado/ })).toBeEnabled();
  });
});

describe('Política: simulación', () => {
  it('envía solo lo que cambia y muestra hoy contra con el cambio, lo que pesó y el tope', async () => {
    const { calls } = serve({ write: () => apiOk(simulation) });
    renderPage();
    const field = await screen.findByRole('spinbutton', { name: 'Riesgo medio desde' });
    await userEvent.clear(field);
    await userEvent.type(field, '20');
    const actions = screen.getAllByRole('button', { name: /Con riesgo alto/ });
    await userEvent.click(actions[actions.length - 1]);
    await userEvent.click(screen.getByRole('option', { name: 'Negar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
    expect(await screen.findByText('120 intentos de los últimos 30 días. Solo los más recientes (tope de la simulación).')).toBeInTheDocument();
    expect(writes(calls).map((c) => [c.url, body(c)])).toEqual([[`${URL}/simulate`, { risk_engine: true, risk_medium_score: 20, risk_high_action: 'DENY' }]]);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('row', { name: /Un paso más/ })).toHaveTextContent('410');
    expect(screen.getByText('10 intentos se tratarían más estricto.')).toBeInTheDocument();
    expect(screen.getByText('1 intento se trataría más suave.')).toBeInTheDocument();
    expect(screen.getByText('Se detendrían 2 de 3 fraudes confirmados.')).toBeInTheDocument();
    expect(screen.getByText(/8 intentos sin fraude confirmado ya no pasarían directo/)).toHaveClass('text-warning');
    expect(screen.getByText(/Probabilidad de rostro real baja \(6\) · DESCONOCIDA \(2\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a lo vigente' }));
    expect(field).toHaveValue('30');
  });

  it('sin intentos lo dice; si falla se avisa', async () => {
    let fail = false;
    serve({ write: () => (fail ? apiFail(503, 'SERVER_BUSY', 'Ocupado') : apiOk({ ...simulation, evaluated: 0, capped: false, top_reasons: [], genuine_affected: 0 })) });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Simular' }));
    expect(await screen.findByText('Sin intentos medidos en los últimos 30 días.')).toBeInTheDocument();
    fail = true;
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo simular' })).toHaveTextContent('Ocupado');
  });
});

describe('Política: historial y aprobación', () => {
  const applied = change({
    id: 20,
    status: 'APPLIED',
    relaxes: false,
    preset: 'HIGH',
    reason: null,
    changes: [
      { field: 'liveness_steps', before: 2, after: 3, relaxes: false },
      { field: 'risk_signals.REPLAY_PERCEPTUAL.mode', before: 'OBSERVE', after: 'ENFORCE', relaxes: false },
      { field: 'block_glasses', before: false, after: true, relaxes: false },
    ],
    simulation,
    expires_at: null,
    decided_by: 'root@plataforma.com',
    decided_at: '2026-10-01T11:00:00Z',
    decision_note: 'Visto',
  });

  it('cada cambio con su antes → después; aprobar el de otro ADMIN se confirma y aplica; el propio se retira', async () => {
    const mine = change({ id: 22, requested_by_me: true, requested_by: 'superadmin@plataforma.com', changes: [{ field: 'risk_high_score', before: 60, after: 70, relaxes: true }] });
    const { calls } = serve({
      policy: { ...sampleAdminPolicy, pending_changes: 2 },
      changes: [change(), mine, applied],
      write: (call) => (call.url.endsWith('/approve') ? apiOk({ policy: { ...sampleAdminPolicy, block_virtual_cameras: false, pending_changes: 1 }, change: change({ status: 'APPLIED' }) }) : apiOk(mine)),
    });
    renderPage();
    expect(await screen.findByText('2 por aprobar')).toBeInTheDocument();
    const history = screen.getByRole('heading', { name: 'Historial de la política' }).closest('section') as HTMLElement;
    expect(await within(history).findAllByText('Motivo: Cámaras de la planta')).toHaveLength(2);
    expect(within(history).getAllByText('Relaja la seguridad')).toHaveLength(2);
    expect(within(history).getByText('Alto')).toBeInTheDocument(); // el nivel del cambio
    expect(history).toHaveTextContent('Movimientos de la prueba de vida: 2 → 3');
    expect(history).toHaveTextContent('Modo de «Reenvío perceptual»: Solo medir → Obligatoria');
    expect(history).toHaveTextContent('Retirar los lentes: Desactivado → Activado');
    expect(history).toHaveTextContent('Riesgo alto desde: 60 pts → 70 pts');
    expect(history).toHaveTextContent(/Decidió root@plataforma.com .* · Visto/);
    expect(within(history).getAllByText(/Se puede aprobar hasta el/)).toHaveLength(2);
    expect(within(history).getByText('Se detendrían 2 de 3 fraudes confirmados.')).toBeInTheDocument();

    await userEvent.click(within(history).getByRole('button', { name: 'Aprobar' }));
    const approve = await screen.findByRole('alertdialog', { name: '¿Aprobar el cambio que pidió otro@plataforma.com?' });
    expect(within(approve).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Bloquear cámaras virtualesAntes: ActivadoDespués: Desactivado');
    await userEvent.click(within(approve).getByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByRole('dialog', { name: 'Cambio aprobado' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByRole('switch', { name: 'Bloquear cámaras virtuales' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('1 por aprobar')).toBeInTheDocument();

    await userEvent.click(within(history).getByRole('button', { name: 'Retirar' }));
    const cancel = await screen.findByRole('alertdialog', { name: '¿Retirar tu cambio por aprobar?' });
    expect(cancel).toHaveTextContent('Riesgo alto desde60 pts → 70 pts');
    await userEvent.click(within(cancel).getByRole('button', { name: 'Retirar' }));
    await waitFor(() => expect(screen.queryByText('1 por aprobar')).toBeNull());
    expect(writes(calls).map((c) => c.url)).toEqual([`${URL}/changes/21/approve`, `${URL}/changes/22/cancel`]);
  });

  it('un cambio sin motivo lo dice al aprobarlo; si falla se avisa; vacío, el historial lo explica', async () => {
    serve({ changes: [change({ reason: null })], write: () => apiFail(409, 'POLICY_CHANGE_EXPIRED', 'Venció sin aprobarse') });
    const view = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    const approve = await screen.findByRole('alertdialog', { name: '¿Aprobar el cambio que pidió otro@plataforma.com?' });
    expect(approve).toHaveTextContent('Sin motivo escrito.');
    await userEvent.click(within(approve).getByRole('button', { name: 'Aprobar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo aprobar el cambio' })).toHaveTextContent('Venció sin aprobarse');
    view.unmount();
    serve({ changes: [change({ requested_by_me: true })], write: () => apiFail(409, 'POLICY_CHANGE_NOT_PENDING', 'Ya no está pendiente') });
    const second = renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Retirar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Retirar tu cambio por aprobar?' })).getByRole('button', { name: 'Retirar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo retirar el cambio' })).toBeInTheDocument();
    second.unmount();
    serve();
    renderPage();
    expect(await screen.findByText('Sin cambios todavía')).toBeInTheDocument();
  });

  it('rechazar abre su formulario: el motivo es obligatorio, se confirma con los cambios y regresa a la política', async () => {
    const { calls } = serve({ changes: [change()], write: () => apiOk(change({ status: 'REJECTED' })) });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByRole('heading', { name: 'Rechazar un cambio de la política' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByText('Escribe el motivo (al menos 3 caracteres)')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /Motivo del rechazo/ }), 'No relajar en planta');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Rechazar el cambio que pidió otro@plataforma.com?' });
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Bloquear cámaras virtuales');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByRole('dialog', { name: 'Cambio rechazado' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Política de verificación de identidad' })).toBeInTheDocument();
    const post = writes(calls)[0];
    expect([post.url, body(post)]).toEqual([`${URL}/changes/21/reject`, { note: 'No relajar en planta' }]);
  });

  it('rechazar un cambio que ya no espera aprobación lo dice; si no carga ofrece reintentar', async () => {
    serve({ changes: [] });
    const view = renderPage('/admin/companies/4/policy/changes/21/reject');
    expect(await screen.findByText('Este cambio ya no está pendiente')).toBeInTheDocument();
    expect(screen.getByText('Ya se decidió. Revisa el historial de cambios.')).toBeInTheDocument();
    view.unmount();
    mockFetch(apiFail(503, 'SERVER_BUSY', 'Ocupado'));
    renderPage('/admin/companies/4/policy/changes/21/reject');
    expect(await screen.findByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
  });
});

describe('policyFields: nombre y valor de cada campo del historial', () => {
  const policy = { risk_signals: sampleAdminPolicy.risk_signals };

  it('nombres de interruptores, ajustes, motor, accesorios, señales y desconocidos', () => {
    expect(fieldLabel('detect_replays', policy, testCatalogs)).toBe('Detectar capturas reutilizadas');
    expect(fieldLabel('lockout_minutes', policy, testCatalogs)).toBe('Duración del bloqueo');
    expect(fieldLabel('min_confidence', policy, testCatalogs)).toBe('Nivel de confianza');
    expect(fieldLabel('block_mask', policy, testCatalogs)).toBe('Retirar el cubrebocas');
    expect(fieldLabel('risk_signals.SPOOF_PROB_LOW.points', policy, testCatalogs)).toBe('Puntos de «Probabilidad de rostro real baja»');
    expect(fieldLabel('risk_signals.NUEVA.mode', policy, testCatalogs)).toBe('Modo de «NUEVA»');
    // Guía por voz (decisión del dueño, 2026-10-08): interruptor y voz del catálogo.
    expect(fieldLabel('voice_guidance_enabled', policy, testCatalogs)).toBe('Guía por voz');
    expect(fieldLabel('voice_profile', policy, testCatalogs)).toBe('Voz de la guía');
    expect(fieldLabel('campo_nuevo', policy, testCatalogs)).toBe('campo_nuevo');
  });

  it('valores: vacío, interruptor, confianza, puntos, número, catálogo, modo, texto y objetos', () => {
    expect(fieldValue('reason', null, testCatalogs)).toBe('—');
    expect(fieldValue('risk_engine', false, testCatalogs)).toBe('Desactivado');
    expect(fieldValue('duplicate_confidence', 0.95, testCatalogs)).toBe('95 %');
    expect(fieldValue('risk_signals.X.points', 30, testCatalogs)).toBe('30 pts');
    expect(fieldValue('lockout_minutes', 15, testCatalogs)).toBe('15');
    expect(fieldValue('employee_device_mode', 'APPROVAL', testCatalogs)).toBe('Aprobación de la empresa');
    expect(fieldValue('risk_signals.X.mode', 'OFF', testCatalogs)).toBe('Apagada');
    expect(fieldValue('preset', 'HIGH', testCatalogs)).toBe('HIGH');
    expect(fieldValue('voice_profile', 'FEMALE_WARM', testCatalogs)).toBe('Femenina cálida'); // nombre del catálogo voice_profiles
    expect(fieldValue('blocked_cameras', ['obs'], testCatalogs)).toBe('["obs"]');
    expect(describeFieldChange({ field: 'qr_enabled', before: true, after: false, relaxes: false }, policy, testCatalogs)).toEqual({
      label: 'Verificación con código QR',
      before: 'Activado',
      after: 'Desactivado',
    });
  });

  it('vista optimista: campos directos y el ajuste de una señal sobre su fila', () => {
    const changed = withChanges(sampleAdminPolicy, { risk_engine: false, reason: 'x', risk_signals: { SPOOF_PROB_LOW: { mode: 'OFF' } } });
    expect(changed.risk_engine).toBe(false);
    expect(changed.risk_signals.find((s) => s.code === 'SPOOF_PROB_LOW')?.mode).toBe('OFF');
    expect('reason' in changed).toBe(false);
    expect(withChanges(sampleAdminPolicy, { lockout_minutes: 30 }).risk_signals).toBe(sampleAdminPolicy.risk_signals);
  });
});

describe('Política: bordes', () => {
  it('nivel sin descripción; códigos que el catálogo no conoce; una señal con descripción', async () => {
    const catalogs = catalogsWith({ policy_presets: [{ code: 'HIGH', name: 'Alto', description: null, sort_order: 1, active: true }] });
    const policy = {
      ...sampleAdminPolicy,
      preset: null,
      risk_medium_action: 'NUEVA',
      employee_device_mode: 'NUEVO',
      risk_signals: [{ ...sampleAdminPolicy.risk_signals[0], description: 'Mide si el rostro es real.' }],
    };
    serve({ policy, write: () => apiOk({ policy, change: change({ status: 'APPLIED' }) }) });
    renderPage(undefined, catalogs);
    expect(await screen.findByText('Mide si el rostro es real.')).toBeInTheDocument();
    expect(screen.getByText('Qué se hace con un intento de este nivel.')).toBeInTheDocument();
    expect(screen.getByText(/Qué pasa cuando el empleado usa un teléfono nuevo/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar nivel' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Aplicar el nivel «Alto»?' })).getByRole('button', { name: 'Aplicar nivel' }));
    expect(await screen.findByRole('dialog', { name: 'Nivel Alto aplicado' })).toBeInTheDocument();
  });

  it('una simulación sin señales que pesen ni molestias; el historial que no carga', async () => {
    let failChanges = false;
    mockFetch((call) => {
      if (call.url.endsWith('/face-learning')) return apiOk(learning);
      if (call.url.endsWith('/simulate')) return apiOk({ ...simulation, capped: false, top_reasons: [], genuine_affected: 0 });
      if (call.url.includes('/changes')) return failChanges ? apiFail(503, 'SERVER_BUSY', 'Ocupado') : apiOk({ items: [], total: 0, page: 1, size: 5 });
      if (call.url.includes('/verification-policy')) return apiOk(sampleAdminPolicy);
      return apiOk(company);
    });
    failChanges = true;
    renderPage();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar el historial de la política' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }));
    expect(await screen.findByText('120 intentos de los últimos 30 días.')).toBeInTheDocument();
    expect(screen.queryByText('Lo que más pesó:')).toBeNull();
    expect(screen.getByText(/0 intentos sin fraude confirmado/)).not.toHaveClass('text-warning');
  });

  it('rechazar: cancelar regresa sin enviar y si el servidor no lo acepta se explica', async () => {
    const { calls } = serve({ changes: [change()], write: () => apiFail(409, 'POLICY_SELF_DECISION', 'Para retirar tu propio cambio usa «Cancelar»') });
    const view = renderPage('/admin/companies/4/policy/changes/21/reject');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Política de verificación de identidad' })).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
    view.unmount();
    renderPage('/admin/companies/4/policy/changes/21/reject');
    await userEvent.type(await screen.findByRole('textbox', { name: /Motivo del rechazo/ }), 'No conviene');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: /¿Rechazar el cambio/ })).getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo rechazar el cambio' })).toHaveTextContent('usa «Cancelar»');
  });
});
