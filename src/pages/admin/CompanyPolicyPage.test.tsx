import { act, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfidenceSlider } from '../../components/ConfidenceSlider';
import { AccessoryReviewPrompt } from '../../components/LiveFaceFlow';
import { catalogsFixture, catalogsWith } from '../../test/catalogs';
import { publishPolicy, resetPolicyCache, useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import { CompanyPolicyPage } from './CompanyPolicyPage';

const policy = { ...samplePolicy, updated_at: '2026-10-01T10:00:00Z', updated_by: 'superadmin@plataforma.com' };
const company = {
  id: 4,
  name: 'Panificadora',
  legal_name: null,
  rfc: null,
  phone: null,
  active: true,
  max_employees: null,
  api_enabled: false,
  employee_count: 3,
  admin_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const learning = { enabled: true, approved_employees: 3, employees_learning: 1, learned_samples: 2, identifications: 9, learned_identifications: 1, last_learned_at: null };

/** El servidor de la consola: la empresa, su aprendizaje y su política (`policyResponse` responde GET y PUT de la política). */
function serve(policyResponse: Response | ((call: MockCall) => Response)) {
  return mockFetch((call) => {
    if (call.url.endsWith('/face-learning')) return apiOk(learning);
    if (!call.url.includes('/verification-policy')) return apiOk(company);
    return typeof policyResponse === 'function' ? policyResponse(call) : policyResponse.clone();
  });
}

/** La pantalla del ADMIN para la empresa 4 (/admin/companies/:id/policy). */
function renderPolicy(page: ReactElement = <CompanyPolicyPage />) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/companies/:id/policy" element={page} />
    </Routes>,
    { route: '/admin/companies/4/policy' },
  );
}

/** Elige una opción de un ajuste de los candados (todavía no guarda: primero se confirma). */
async function choose(control: RegExp, option: string | RegExp) {
  await userEvent.click(screen.getByRole('button', { name: control }));
  await userEvent.click(screen.getByRole('option', { name: option }));
}

/** Responde la confirmación con ese título: `dialog` (azul o verde) o `alertdialog` (protege menos, en rojo). */
async function answer(role: 'dialog' | 'alertdialog', title: string, button: string) {
  const dialog = await screen.findByRole(role, { name: title });
  await userEvent.click(within(dialog).getByRole('button', { name: button }));
  return dialog;
}

afterEach(() => resetPolicyCache());

describe('CompanyPolicyPage (ADMIN: política de verificación de una empresa)', () => {
  it('candados contra suplantación: cada uno se desactiva con confirmación y sus ajustes se guardan', async () => {
    const { calls } = serve((call) => {
      if (call.init.method !== 'PUT') return apiOk(policy);
      return apiOk({ ...policy, ...(JSON.parse(call.init.body as string) as object) });
    });
    renderPolicy();
    const lock = await screen.findByRole('switch', { name: 'Bloquear cámaras virtuales' });
    expect(screen.getByRole('heading', { name: 'Política de verificación de identidad' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Panificadora/ })).toHaveAttribute('href', '/admin/companies/4');
    expect(lock).toHaveAttribute('aria-checked', 'true');
    for (const name of ['Solo capturas en vivo', 'Detectar fotos fijas', 'Detectar capturas reutilizadas', 'Exigir una sola toma', 'Tiempo humano en la prueba de vida', 'Detectar rostros duplicados', 'Bloqueo por intentos fallidos']) {
      expect(screen.getByRole('switch', { name })).toHaveAttribute('aria-checked', 'true');
    }
    await userEvent.click(lock);
    const confirm = await screen.findByRole('alertdialog', { name: '¿Desactivar «Bloquear cámaras virtuales»?' });
    expect(confirm).toHaveTextContent('Protección recomendada');
    expect(confirm).toHaveTextContent('Esto reduce la protección contra suplantación de identidad');
    expect(within(confirm).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Bloquear cámaras virtualesAntes: ActivadoDespués: Desactivado');
    expect(confirm).toHaveTextContent('Aplica en segundos a todo el personal de Panificadora.');
    expect(lock).toHaveAttribute('aria-checked', 'true'); // nada cambia hasta confirmar
    await userEvent.click(within(confirm).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(lock).toHaveAttribute('aria-checked', 'false'));
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));

    // Ajustes: cada uno se confirma con su "antes → después"; los que protegen menos, en rojo.
    await choose(/Sensibilidad del anti-spoofing/, /Máximo/);
    const level = await answer('dialog', '¿Cambiar «Sensibilidad del anti-spoofing» a Máximo?', 'Guardar ajuste');
    expect(within(level).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Sensibilidad del anti-spoofingAntes: EstándarDespués: Máximo');
    expect(level).toHaveTextContent('Basta con que una sola captura parezca una foto'); // qué hará el nivel
    expect(await screen.findByText('Anti-spoofing: nivel Máximo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await choose(/Movimientos de la prueba de vida/, '1 movimiento');
    const turns = await answer('alertdialog', '¿Cambiar «Movimientos de la prueba de vida» a 1 movimiento?', 'Guardar ajuste');
    expect(turns).toHaveTextContent('Este valor protege menos contra la suplantación de identidad.');
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));
    await choose(/Intentos antes del bloqueo/, '3 intentos');
    await answer('dialog', '¿Cambiar «Intentos antes del bloqueo» a 3 intentos?', 'Guardar ajuste');
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));
    await choose(/Duración del bloqueo/, '1 h');
    await answer('dialog', '¿Cambiar «Duración del bloqueo» a 1 h?', 'Guardar ajuste');
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));
    await choose(/Vigencia del código QR/, '1 min');
    await answer('alertdialog', '¿Cambiar «Vigencia del código QR» a 1 min?', 'Guardar ajuste');
    expect(await screen.findByText('Cada código QR durará 1 min y servirá una sola vez.')).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(6));
    expect(new Set(calls.filter((c) => c.init.method === 'PUT').map((c) => c.url))).toEqual(new Set(['/api/admin/companies/4/verification-policy']));
    expect(calls.filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(c.init.body as string) as object)).toEqual([
      { block_virtual_cameras: false },
      { anti_spoofing_level: 'MAXIMUM' },
      { liveness_steps: 1 },
      { lockout_max_failures: 3 },
      { lockout_minutes: 60 },
      { qr_lifetime_seconds: 60 },
    ]);
  });

  it('aprendizaje continuo: apagarlo se confirma diciendo qué pasará (no es una protección)', async () => {
    const { calls } = serve((call) => {
      if (call.init.method !== 'PUT') return apiOk(policy);
      return apiOk({ ...policy, ...(JSON.parse(call.init.body as string) as object) });
    });
    renderPolicy();
    const learning = await screen.findByRole('switch', { name: 'Aprender de cada identificación segura' });
    expect(learning).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(learning);
    const dialog = await answer('alertdialog', '¿Desactivar «Aprender de cada identificación segura»?', 'Desactivar');
    expect(dialog).toHaveTextContent('Política de verificación');
    expect(dialog).toHaveTextContent('Cada empleado se compara solo con las muestras de su registro aprobado.');
    expect(dialog).not.toHaveTextContent('suplantación');
    await waitFor(() => expect(learning).toHaveAttribute('aria-checked', 'false'));
    expect(await screen.findByRole('dialog', { name: 'Aprender de cada identificación segura: desactivado' })).toHaveTextContent('Cada empleado se compara solo con las muestras de su registro aprobado.');
    expect(calls.filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(c.init.body as string) as object)).toEqual([{ adaptive_learning: false }]);
    // La evolución del reconocimiento vive aquí (solo el ADMIN la ve) y se vuelve a pedir al cambiar el interruptor.
    expect(screen.getByRole('heading', { name: 'Reconocimiento facial evolutivo' })).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/admin/companies/4/face-learning')).toHaveLength(2));
  });

  it('prueba de vida: su tiempo y el destello; exigir el destello advierte calibrar antes y apagarlo protege menos', async () => {
    const { calls } = serve((call) => {
      if (call.init.method !== 'PUT') return apiOk(policy);
      return apiOk({ ...policy, ...(JSON.parse(call.init.body as string) as object) });
    });
    renderPolicy();
    await screen.findByRole('button', { name: /Tiempo para la prueba de vida/ });
    await choose(/Tiempo para la prueba de vida/, '45 s');
    const timeout = await answer('dialog', '¿Cambiar «Tiempo para la prueba de vida» a 45 s?', 'Guardar ajuste');
    expect(within(timeout).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Antes: 1 minDespués: 45 s');
    expect(await screen.findByText('Cada reto vencerá a los 45 s.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await choose(/Destello de colores/, /^Obligatorio/);
    const enforce = await screen.findByRole('alertdialog', { name: '¿Cambiar «Destello de colores» a Obligatorio?' });
    expect(enforce).toHaveTextContent('Hazlo después de calibrar con capturas reales (Seguridad facial › Destello de colores). Con luz del sol directa puede pedir repetir la prueba.');
    expect(enforce).toHaveTextContent('Aplica en segundos a todo el personal de Panificadora.');
    expect(enforce).not.toHaveTextContent('protege menos');
    await userEvent.click(within(enforce).getByRole('button', { name: 'Cancelar' }));
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1); // cancelar no envía nada

    await choose(/Destello de colores/, /^Apagado/);
    const off = await answer('alertdialog', '¿Cambiar «Destello de colores» a Apagado?', 'Guardar ajuste');
    expect(off).toHaveTextContent('Este valor protege menos contra la suplantación de identidad.');
    expect(await screen.findByText('Destello de colores: Apagado')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(c.init.body as string) as object)).toEqual([
      { liveness_timeout_seconds: 45 },
      { flash_liveness: 'OFF' },
    ]);
  });

  it('ubicación de la asistencia: precisión exigida, viaje imposible (con confirmación) y su velocidad', async () => {
    const { calls } = serve((call) => {
      if (call.init.method !== 'PUT') return apiOk({ ...policy, max_travel_kmh: 250 });
      return apiOk({ ...policy, max_travel_kmh: 250, ...(JSON.parse(call.init.body as string) as object) });
    });
    renderPolicy();
    await screen.findByRole('button', { name: /Precisión de la ubicación/ });
    await choose(/Precisión de la ubicación/, 'Hasta 50 m');
    const accuracy = await answer('dialog', '¿Cambiar «Precisión de la ubicación» a Hasta 50 m?', 'Guardar ajuste');
    expect(within(accuracy).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Antes: Hasta 100 mDespués: Hasta 50 m');
    expect(accuracy).toHaveTextContent('Se pedirá repetir el registro si la ubicación tiene un margen mayor a 50 m.');
    expect(await screen.findByRole('dialog', { name: 'Precisión actualizada' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    // La velocidad vigente aparece aunque no sea una de las opciones habituales.
    await userEvent.click(screen.getByRole('button', { name: /Velocidad máxima creíble/ }));
    expect(screen.getByRole('option', { name: '250 km/h' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: '120 km/h' }));
    await answer('dialog', '¿Cambiar «Velocidad máxima creíble» a 120 km/h?', 'Guardar ajuste');
    expect(await screen.findByText('Se rechazarán registros que exijan viajar a más de 120 km/h desde el anterior.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByRole('switch', { name: 'Detectar viajes imposibles' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Desactivar «Detectar viajes imposibles»?' });
    expect(within(confirm).getByText(/ubicación falsa o desde otro lugar/)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Velocidad máxima creíble/ })).toBeDisabled());
    expect(calls.filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(c.init.body as string) as object)).toEqual([
      { max_location_accuracy_m: 50 },
      { max_travel_kmh: 120 },
      { detect_impossible_travel: false },
    ]);
  });

  it('los ajustes de un candado apagado no se pueden cambiar', async () => {
    serve(apiOk({ ...policy, anti_spoofing: false, liveness_challenge: false, lockout_enabled: false, qr_enabled: false }));
    renderPolicy();
    expect(await screen.findByRole('button', { name: /Sensibilidad del anti-spoofing/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Movimientos de la prueba de vida/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Tiempo para la prueba de vida/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Destello de colores/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Intentos antes del bloqueo/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Duración del bloqueo/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Vigencia del código QR/ })).toBeDisabled();
  });

  it('nivel de confianza: control de 80 % a 100 % (100 = 99.999 %), guardado explícito y confirmación si es muy estricto', async () => {
    const { calls } = serve((call) => {
      if (call.init.method !== 'PUT') return apiOk(policy);
      return apiOk({ ...policy, ...(JSON.parse(call.init.body as string) as object) });
    });
    renderPolicy();
    const slider = await screen.findByRole('slider', { name: 'Nivel de confianza requerido' });
    expect(slider).toHaveValue('100'); // 99.999 % por defecto
    expect(slider).toHaveAttribute('aria-valuetext', '99.999 % (Máximo)');
    expect(slider).toHaveAttribute('min', '80');
    const control = within(slider.closest('.confidence') as HTMLElement);
    const save = control.getByRole('button', { name: 'Guardar nivel' });
    expect(save).toBeDisabled(); // sin cambios

    fireEvent.change(slider, { target: { value: '80' } });
    expect(slider).toHaveAttribute('aria-valuetext', '80 % (Flexible)');
    expect(control.getByText('0.386')).toBeInTheDocument(); // similitud exigida al 80 %
    fireEvent.change(slider, { target: { value: '95' } });
    expect(control.getByText('0.427')).toBeInTheDocument(); // similitud exigida a ese nivel
    // Bajar el nivel se confirma en rojo; cancelar no envía nada y el control sigue donde se dejó.
    await userEvent.click(save);
    const lower = await answer('alertdialog', '¿Exigir 95 % de confianza?', 'Cancelar');
    expect(within(lower).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Nivel de confianza requeridoAntes: 99.999 % (Máximo)Después: 95 % (Alto)');
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
    expect(slider).toHaveValue('95');
    await userEvent.click(save);
    await answer('alertdialog', '¿Exigir 95 % de confianza?', 'Guardar nivel');
    await waitFor(() => expect(slider).toHaveValue('95'));
    expect(JSON.parse(calls.filter((c) => c.init.method === 'PUT').at(-1)?.init.body as string)).toEqual({ min_confidence: 0.95 });
    expect(await screen.findByText('Nivel de confianza actualizado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' })); // confirmación en popup

    // Volver al máximo pide confirmación (más reintentos) y explica que 100 % = 99.999 %.
    fireEvent.change(slider, { target: { value: '100' } });
    await userEvent.click(control.getByRole('button', { name: 'Guardar nivel' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Exigir 99.999 % de confianza?' });
    expect(within(dialog).getByText(/puede garantizar el 100 %/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar nivel' }));
    await waitFor(() =>
      expect(JSON.parse(calls.filter((c) => c.init.method === 'PUT').at(-1)?.init.body as string)).toEqual({ min_confidence: 0.99999 }),
    );
  });

  it('confianza para identificar entre todos y calidad mínima de la captura', async () => {
    const { calls } = serve((call) => apiOk(call.init.method === 'PUT' ? { ...policy, ...(JSON.parse(call.init.body as string) as object) } : { ...policy, min_confidence: 0.99, identify_confidence: 0.95 }));
    renderPolicy();
    const slider = await screen.findByRole('slider', { name: 'Nivel de confianza para identificar entre todos' });
    expect(slider).toHaveValue('95');
    fireEvent.change(slider, { target: { value: '90' } });
    await userEvent.click(within(slider.closest('.confidence') as HTMLElement).getByRole('button', { name: 'Guardar nivel' }));
    const lower = await answer('alertdialog', '¿Exigir 90 % de confianza?', 'Guardar nivel');
    expect(within(lower).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Nivel de confianza para identificar entre todos');
    // Por debajo de la confianza 1:1 rige la 1:1: el aviso lo dice con el nivel que de verdad aplica.
    expect(await screen.findByText('Los validadores exigirán 99 % al identificar entre todos los empleados.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await choose(/Calidad mínima de la captura/, 'Alta');
    await answer('dialog', '¿Cambiar «Calidad mínima de la captura» a Alta?', 'Guardar ajuste');
    expect(await screen.findByText('Se rechazarán las capturas con calidad menor a «Alta».')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await choose(/Calidad mínima de la captura/, 'Sin mínimo');
    const relaxed = await answer('alertdialog', '¿Cambiar «Calidad mínima de la captura» a Sin mínimo?', 'Guardar ajuste');
    expect(within(relaxed).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Antes: AltaDespués: Sin mínimo');
    expect(await screen.findByText('Se acepta cualquier captura que pase los controles básicos.', { selector: '[role=dialog] *' })).toBeInTheDocument();
    const puts = calls.filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(c.init.body as string) as object);
    expect(puts).toEqual([{ identify_confidence: 0.9 }, { min_capture_quality: 0.7 }, { min_capture_quality: 0 }]);
  });

  it('una calidad guardada fuera de los niveles de la lista se muestra en porcentaje', async () => {
    serve(apiOk({ ...policy, min_capture_quality: 0.65 }));
    renderPolicy();
    expect(await screen.findByRole('button', { name: /Calidad mínima de la captura/ })).toHaveTextContent('65 %');
  });

  it('solo los validadores tienen restricciones de dispositivo (no hay interruptor para empleados)', async () => {
    serve(apiOk(policy));
    renderPolicy();
    expect(await screen.findByText('Dispositivos de los validadores')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Solo desde teléfono celular' })).toBeNull();
    expect(screen.getByText(/Empleados y administradores usan la aplicación desde cualquier dispositivo/)).toBeInTheDocument();
  });

  it('validadores solo desde tableta o teléfono (confirmación propia al desactivarlo)', async () => {
    const { calls } = serve((call) =>
      call.init.method === 'PUT' ? apiOk({ ...policy, validator_mobile_only: false }) : apiOk(policy),
    );
    renderPolicy();
    const touchOnly = await screen.findByRole('switch', { name: 'Validadores solo desde tableta o teléfono' });
    expect(touchOnly).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(touchOnly);
    const dialog = await screen.findByRole('alertdialog', { name: '¿Desactivar «Validadores solo desde tableta o teléfono»?' });
    expect(within(dialog).getByText(/podrán operar desde computadoras/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(touchOnly).toHaveAttribute('aria-checked', 'false'));
    expect(JSON.parse(calls.find((c) => c.init.method === 'PUT')?.init.body as string)).toEqual({ validator_mobile_only: false });
  });

  it('muestra la política y guarda un cambio ya confirmado', async () => {
    const { calls } = serve((call) =>
      call.init.method === 'PUT' ? apiOk({ ...policy, block_mask: false }) : apiOk(policy),
    );
    renderPolicy();
    // Un interruptor por accesorio del catálogo, nombrado con su frase.
    expect(await screen.findByRole('switch', { name: 'Retirar la gorra o sombrero' })).toBeInTheDocument();
    const mask = screen.getByRole('switch', { name: 'Retirar el cubrebocas' });
    expect(mask).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/Última modificación/)).toBeNull(); // etiqueta retirada a pedido del usuario

    await userEvent.click(mask);
    const dialog = await answer('alertdialog', '¿Desactivar «Retirar el cubrebocas»?', 'Desactivar');
    expect(dialog).toHaveTextContent('Se permite identificarse con cubrebocas (menor precisión).');
    await waitFor(() => expect(mask).toHaveAttribute('aria-checked', 'false'));
    const put = calls.find((c) => c.init.method === 'PUT');
    expect(JSON.parse(put?.init.body as string)).toEqual({ block_mask: false });
    expect(await screen.findByText('Retirar el cubrebocas: desactivado')).toBeInTheDocument();
  });

  it('pide confirmación para desactivar una protección de seguridad', async () => {
    const { calls } = serve((call) =>
      call.init.method === 'PUT' ? apiOk({ ...policy, anti_spoofing: false }) : apiOk(policy),
    );
    renderPolicy();
    await userEvent.click(await screen.findByRole('switch', { name: 'Anti-spoofing' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Desactivar «Anti-spoofing»?' });
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false); // aún no se guarda
    expect(screen.getByRole('switch', { name: 'Anti-spoofing' })).toHaveAttribute('aria-checked', 'true'); // ni se ve como guardado
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Anti-spoofing' })).toHaveAttribute('aria-checked', 'false'));
  });

  it('revierte el interruptor si el guardado falla', async () => {
    serve((call) => (call.init.method === 'PUT' ? apiFail(503, 'SERVER_BUSY', 'Ocupado') : apiOk(policy)));
    renderPolicy();
    const glasses = await screen.findByRole('switch', { name: 'Retirar los lentes' });
    await userEvent.click(glasses);
    await answer('alertdialog', '¿Desactivar «Retirar los lentes»?', 'Desactivar');
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
    expect(glasses).toHaveAttribute('aria-checked', 'true');
  });

  it('informa errores al cargar', async () => {
    serve(apiFail(403, 'FORBIDDEN', 'Sin permisos'));
    renderPolicy();
    expect(await screen.findByText('Sin permisos')).toBeInTheDocument();
  });
});

/** Política con el servidor que acepta cada cambio (responde la política ya actualizada). */
function accepting(base = samplePolicy) {
  return serve((call) => apiOk(call.init.method === 'PUT' ? { ...base, ...(JSON.parse(call.init.body as string) as object) } : base));
}
const puts = (calls: Array<{ init: RequestInit }>) => calls.filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(c.init.body as string) as unknown);

describe('Política de verificación: activar y confirmar', () => {
  it('activar una regla se confirma en verde (cancelar la deja apagada) y avisa qué cambia', async () => {
    const { calls } = accepting({ ...samplePolicy, block_glasses: false });
    renderPolicy();
    const glasses = await screen.findByRole('switch', { name: 'Retirar los lentes' });
    expect(glasses).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(glasses);
    const dialog = await answer('dialog', '¿Activar «Retirar los lentes»?', 'Cancelar');
    expect(dialog).toHaveClass('msg--success');
    expect(dialog).toHaveTextContent('Se pedirá quitarse lentes (incluidos los de sol).');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Retirar los lentesAntes: DesactivadoDespués: Activado');
    expect(glasses).toHaveAttribute('aria-checked', 'false');
    expect(puts(calls)).toEqual([]);

    await userEvent.click(glasses);
    await answer('dialog', '¿Activar «Retirar los lentes»?', 'Activar');
    expect(await screen.findByText('Retirar los lentes: activado')).toBeInTheDocument();
    expect(glasses).toHaveAttribute('aria-checked', 'true');
    expect(puts(calls)).toEqual([{ block_glasses: true }]);
  });

  it('cancelar la confirmación deja la protección encendida y no guarda nada', async () => {
    const { calls } = accepting();
    renderPolicy();
    const antiSpoofing = await screen.findByRole('switch', { name: 'Anti-spoofing' });
    await userEvent.click(antiSpoofing);
    const dialog = await screen.findByRole('alertdialog', { name: '¿Desactivar «Anti-spoofing»?' });
    expect(dialog).toHaveTextContent('Esto reduce la protección contra suplantación de identidad');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(antiSpoofing).toHaveAttribute('aria-checked', 'true');
    expect(puts(calls)).toEqual([]);
  });

  it('cancelar un ajuste deja el valor vigente y no guarda nada', async () => {
    const { calls } = accepting();
    renderPolicy();
    const duration = await screen.findByRole('button', { name: /Duración del bloqueo/ });
    await choose(/Duración del bloqueo/, '5 min');
    const dialog = await answer('alertdialog', '¿Cambiar «Duración del bloqueo» a 5 min?', 'Cancelar');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Antes: 15 minDespués: 5 min');
    expect(duration).toHaveTextContent('15 min');
    expect(puts(calls)).toEqual([]);
  });

  it('si la política no carga ofrece volver a cargar', async () => {
    let attempts = 0;
    serve(() => (attempts++ === 0 ? apiFail(403, 'FORBIDDEN', 'Sin permisos') : apiOk(samplePolicy)));
    renderPolicy();
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar la política de verificación' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('switch')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('switch', { name: 'Anti-spoofing' })).toBeInTheDocument();
  });
});

describe('ConfidenceSlider: niveles del catálogo confidence_levels', () => {
  it('solo niveles activos; una posición sin nivel se ajusta al más cercano', () => {
    const confidence_levels = catalogsFixture.confidence_levels.map((l) => (l.code === '85' || l.code === '100' ? { ...l, active: false } : l));
    const { container } = renderWithProviders(<ConfidenceSlider value={0.99999} onSave={() => undefined} />, {
      catalogs: catalogsWith({ confidence_levels }),
    });
    const slider = screen.getByRole('slider', { name: 'Nivel de confianza requerido' });
    expect(slider).toHaveAttribute('max', '99'); // el máximo activo
    expect(slider).toHaveAttribute('aria-valuetext', '99 % (Estricto)'); // valor guardado ya inactivo: el más cercano
    expect(container.querySelectorAll('.confidence__tick')).toHaveLength(19);
    fireEvent.change(slider, { target: { value: '85' } });
    expect(slider).toHaveAttribute('aria-valuetext', '84 % (Flexible)');
    expect(slider).toHaveValue('84');

    fireEvent.click(screen.getByText('90')); // marca del control
    expect(slider).toHaveAttribute('aria-valuetext', '90 % (Equilibrado)');
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(slider).toHaveAttribute('aria-valuetext', '99 % (Estricto)');
  });

  it('sin niveles activos no muestra el control', () => {
    renderWithProviders(<ConfidenceSlider value={0.9} onSave={() => undefined} />, { catalogs: catalogsWith({ confidence_levels: [] }) });
    expect(screen.queryByRole('slider')).toBeNull();
  });
});

describe('useVerificationPolicy', () => {
  it('usa valores estrictos hasta cargar y se actualiza al publicar cambios', async () => {
    mockFetch(apiOk({ ...policy, qr_enabled: false }));
    const { result } = renderHook(() => useVerificationPolicy());
    expect(result.current.policy.block_mask).toBe(true);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.policy.qr_enabled).toBe(false);
    act(() => publishPolicy({ ...policy, block_glasses: false }));
    expect(result.current.policy.block_glasses).toBe(false);
  });
});

describe('AccessoryReviewPrompt', () => {
  it('ofrece enviar a revisión con los accesorios detectados', async () => {
    let confirmed = false;
    renderWithProviders(<AccessoryReviewPrompt accessories={['MASK']} onConfirm={() => (confirmed = true)} />);
    expect(screen.getByText('¿No estás usando el cubrebocas?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /No uso el cubrebocas/ }));
    expect(confirmed).toBe(true);
  });
});
