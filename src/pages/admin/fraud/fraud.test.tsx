import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { FraudCase, FraudCaseDetail } from '../../../types';
import { FraudCaseDetailPage } from './FraudCaseDetailPage';
import { FraudCaseDecisionPage, FraudCaseNotePage } from './FraudCaseFormPages';
import { FraudCasesPage, subjectOf } from './FraudCasesPage';

const base: FraudCase = {
  id: 7,
  company_id: 4,
  company_name: 'Panificadora',
  status: 'OPEN',
  kind: 'PRESENTATION',
  reason: 'SPOOF_DETECTED',
  reason_name: 'Posible foto o pantalla',
  employee: { id: 3, full_name: 'Juan Pérez', employee_number: 'EMP-3' },
  actor: 'juan@empresa.com',
  attempts: 3,
  max_score: 72,
  tier: 'HIGH',
  evidence: 2,
  created_at: '2026-10-01T10:00:00Z',
  last_attempt_at: '2026-10-02T10:00:00Z',
  decided_by: null,
  decided_at: null,
  decision_note: null,
};

const detail: FraudCaseDetail = {
  ...base,
  attempts_detail: [
    {
      id: 1,
      attempted_at: '2026-10-01T10:00:00Z',
      success: false,
      reason: 'SPOOF_DETECTED',
      score: 72,
      action: 'DENY',
      signals: [
        {
          code: 'SPOOF_PROB_LOW',
          name: 'Probabilidad de rostro real baja',
          description: 'El anti-spoofing pasó, pero quedó cerca de su umbral.',
          points: 20,
          mode: 'ENFORCE',
          kind: 'PRESENTATION',
          value: 0.07,
          threshold: 0.25,
        },
        { code: 'CAMERA_LABEL_MISSING', name: 'Cámara sin nombre', points: 0, mode: 'OBSERVE', kind: 'INJECTION', value: null, threshold: null },
        { code: 'FLASH_FLAT', name: 'Destello plano', points: 30, mode: 'ENFORCE', kind: 'PRESENTATION', value: 1.02, threshold: null },
      ],
      metrics: { frontal_real_min: 0.01, device: 'tablet' },
      signatures: 2,
      camera: 'Cámara FaceTime HD',
      ip_address: '52.95.1.10',
      network: { country: 'US', asn: 16509, organization: 'Amazon.com, Inc.', hosting: true },
      user_agent: 'Safari',
    },
    {
      id: 2,
      attempted_at: '2026-10-02T10:00:00Z',
      success: true,
      reason: null,
      score: null,
      action: null,
      signals: [],
      metrics: {},
      signatures: 1,
      camera: null,
      ip_address: '187.188.1.10',
      network: { country: null, asn: null, organization: null, hosting: false },
      user_agent: null,
    },
  ],
  events: [
    { id: 2, created_at: '2026-10-02T11:00:00Z', kind: 'STATUS_CHANGED', actor: 'root@plataforma.com', status_from: 'OPEN', status_to: 'IN_REVIEW', note: 'Lo reviso' },
    { id: 1, created_at: '2026-10-01T10:00:00Z', kind: 'OPENED', actor: null, status_from: null, status_to: null, note: null },
  ],
  evidence_items: [
    { id: 11, kind: 'FRONTAL', position: 0, created_at: '2026-10-01T10:00:00Z' },
    { id: 12, kind: 'FLASH', position: 1, created_at: '2026-10-01T10:00:00Z' },
    { id: 13, kind: 'OTHER', position: 2, created_at: '2026-10-01T10:00:00Z' },
  ],
};

const page = (items: FraudCase[]) => ({ items, total: items.length, page: 1, size: 10 });

function renderFraud(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/fraud-cases" element={<FraudCasesPage />} />
      <Route path="/admin/fraud-cases/:id" element={<FraudCaseDetailPage />} />
      <Route path="/admin/fraud-cases/:id/decision/:status" element={<FraudCaseDecisionPage />} />
      <Route path="/admin/fraud-cases/:id/note" element={<FraudCaseNotePage />} />
    </Routes>,
    { route },
  );
}

describe('Casos de fraude: bandeja', () => {
  it('por omisión los que esperan revisión; filtros por estado y tipo; cada fila abre su caso', async () => {
    const { calls } = mockFetch((call) => {
      if (call.url.startsWith('/api/admin/fraud-cases/7')) return apiOk(detail);
      return apiOk(page([base, { ...base, id: 8, employee: null, actor: null, tier: null, max_score: null, status: 'IN_REVIEW' }]));
    });
    renderFraud('/admin/fraud-cases');
    expect(await screen.findByRole('heading', { name: 'Casos de fraude' })).toBeInTheDocument();
    const row = (await screen.findByText('Caso #7')).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Posible foto o pantalla');
    expect(row).toHaveTextContent('Juan Pérez · EMP-3');
    expect(row).toHaveTextContent('Presentación (foto, pantalla o máscara)');
    expect(row).toHaveTextContent('Alto');
    expect(row).toHaveTextContent('72 pts');
    expect(within(screen.getByText('Caso #8').closest('tr') as HTMLElement).getByText('Sin identificar')).toBeInTheDocument();
    expect(screen.getByText('Sin puntaje')).toBeInTheDocument();
    expect(calls[0].url).toBe('/api/admin/fraud-cases?page=1&size=10');

    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Todos' }));
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/admin/fraud-cases?page=1&size=10&status=ALL'));
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por tipo de fraude/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Reenvío de capturas' }));
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/admin/fraud-cases?page=1&size=10&status=ALL&kind=REPLAY'));

    await userEvent.click(screen.getByText('Caso #7'));
    expect(await screen.findByRole('heading', { name: 'Caso #7' })).toBeInTheDocument();
  });

  it('vacía: nada por revisar (buena noticia) o nada que coincida con el filtro', async () => {
    mockFetch(apiOk(page([])));
    renderFraud('/admin/fraud-cases');
    expect(await screen.findByText('Todo al día')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Fraude confirmado' }));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('quién: el empleado, la cuenta que operó o sin identificar', () => {
    expect(subjectOf(base)).toBe('Juan Pérez · EMP-3');
    expect(subjectOf({ ...base, employee: null })).toBe('juan@empresa.com');
  });
});

describe('Casos de fraude: detalle', () => {
  it('datos, intentos con sus señales, historial y tomar el caso (confirmado antes)', async () => {
    const { calls } = mockFetch((call) => apiOk(call.init.method === 'POST' ? { ...detail, status: 'IN_REVIEW' } : detail));
    renderFraud('/admin/fraud-cases/7');
    expect(await screen.findByRole('heading', { name: 'Caso #7' })).toBeInTheDocument();
    expect(screen.getByText('Sin decisión todavía.')).toBeInTheDocument();
    expect(screen.getByText('Probabilidad de rostro real baja')).toBeInTheDocument();
    expect(screen.getByText(/0\.07 \(umbral 0\.25\)/)).toBeInTheDocument();
    expect(screen.getByText(/1\.02/)).toBeInTheDocument(); // medido sin umbral
    expect(screen.getAllByText(/sin puntos/).length).toBe(1);
    expect(screen.getByText('tablet')).toBeInTheDocument();
    expect(screen.getByText(/Cámara: Cámara FaceTime HD/)).toBeInTheDocument();
    expect(screen.getByText(/Sin nombre de cámara/)).toBeInTheDocument();
    // La explicación de cada señal y la red de la IP con su atribución (base local DB-IP, CC BY 4.0).
    expect(screen.getByText('El anti-spoofing pasó, pero quedó cerca de su umbral.')).toBeInTheDocument();
    expect(screen.getByText(/Red: US · AS16509 · Amazon.com, Inc. · nube o centro de datos/)).toBeInTheDocument();
    const credits = screen.getAllByRole('link', { name: 'IP Geolocation by DB-IP' });
    expect(credits).toHaveLength(2); // también el intento cuya IP no está en la base (red desconocida)
    expect(credits[0]).toHaveAttribute('href', 'https://db-ip.com');
    expect(screen.getByText('Se muestran 2 de 3')).toBeInTheDocument();
    expect(screen.getByText('Abierto → En revisión')).toBeInTheDocument();
    expect(screen.getByText('Lo reviso')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tomar el caso' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Tomar el caso #7?' });
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Antes: AbiertoDespués: En revisión');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tomar el caso' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tomar el caso' })).toBeNull());
    const post = calls.find((c) => c.init.method === 'POST');
    expect(post?.url).toBe('/api/admin/fraud-cases/7/decision');
    expect(JSON.parse(post?.init.body as string)).toEqual({ status: 'IN_REVIEW', note: null });
  });

  it('un caso decidido muestra quién y su nota; las decisiones abren su formulario', async () => {
    mockFetch(apiOk({ ...detail, status: 'CONFIRMED', decided_by: 'root@plataforma.com', decided_at: '2026-10-03T10:00:00Z', decision_note: 'Foto impresa' }));
    renderFraud('/admin/fraud-cases/7');
    expect(await screen.findByText(/Decidió root@plataforma.com/)).toHaveTextContent('Foto impresa');
    expect(screen.queryByRole('button', { name: 'Confirmar fraude' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Falso positivo' }));
    expect(await screen.findByRole('heading', { name: 'Falso positivo' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /Caso #7/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar nota' }));
    expect(await screen.findByRole('heading', { name: 'Agregar una nota' })).toBeInTheDocument();
  });

  it('la evidencia se ve solo tras confirmar; la que falla se avisa y las demás se muestran', async () => {
    let views = 0;
    mockFetch((call: MockCall) => {
      if (call.url.endsWith('/evidence/11')) return apiOk({ id: 11, kind: 'FRONTAL', position: 0, content_type: 'image/jpeg', data: 'AAAA' });
      if (call.url.endsWith('/evidence/13')) return apiOk({ id: 13, kind: 'OTHER', position: 2, content_type: 'image/png', data: 'BBBB' });
      if (call.url.endsWith('/evidence/12')) return apiFail(404, 'FRAUD_EVIDENCE_EXPIRED', 'La evidencia ya no está disponible');
      views += 1;
      return apiOk(detail);
    });
    renderFraud('/admin/fraud-cases/7');
    await userEvent.click(await screen.findByRole('button', { name: 'Ver evidencia' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Ver los 3 fotogramas del intento?' });
    expect(confirm).toHaveTextContent('Cada fotograma que consultes queda en el historial');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Ver evidencia' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo mostrar toda la evidencia' })).toHaveTextContent('La evidencia ya no está disponible');
    expect(screen.getByRole('img', { name: 'Evidencia: De frente, fotograma 1' })).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA');
    expect(screen.getByRole('img', { name: 'Evidencia: OTHER, fotograma 3' })).toBeInTheDocument();
    await waitFor(() => expect(views).toBe(2)); // se volvió a pedir el caso: su historial dice quién la vio
  });

  it('todos los fotogramas a la vista; sin evidencia lo dice', async () => {
    mockFetch((call) => {
      if (call.url.includes('/evidence/')) return apiOk({ id: 12, kind: 'STEP', position: 0, content_type: 'image/jpeg', data: 'CCCC' });
      return apiOk(call.url.endsWith('/8') ? { ...detail, id: 8, evidence_items: [] } : { ...detail, evidence_items: [detail.evidence_items[1]] });
    });
    const { unmount } = renderFraud('/admin/fraud-cases/7');
    await userEvent.click(await screen.findByRole('button', { name: 'Ver evidencia' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Ver el fotograma del intento?' })).getByRole('button', { name: 'Ver evidencia' }));
    expect(await screen.findByText('Movimiento del reto · 1')).toBeInTheDocument();
    unmount();
    renderFraud('/admin/fraud-cases/8');
    expect(await screen.findByText('Sin evidencia')).toBeInTheDocument();
  });

  it('si no carga ofrece reintentar', async () => {
    mockFetch(apiFail(404, 'FRAUD_CASE_NOT_FOUND', 'Caso de fraude no encontrado'));
    renderFraud('/admin/fraud-cases/99');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar el caso' })).toHaveTextContent('Caso de fraude no encontrado');
    expect(screen.getByRole('heading', { name: 'Caso #99' })).toBeInTheDocument();
  });
});

describe('Casos de fraude: decidir y notas', () => {
  it('confirmar exige la nota, se confirma con su efecto y regresa al caso', async () => {
    const { calls } = mockFetch((call) => apiOk(call.init.method === 'POST' ? { ...detail, status: 'CONFIRMED' } : detail));
    renderFraud('/admin/fraud-cases/7/decision/CONFIRMED');
    const submit = await screen.findByRole('button', { name: 'Confirmar fraude' });
    expect(screen.getByText(/Sus huellas quedan bloqueadas/)).toBeInTheDocument();
    await userEvent.click(submit);
    expect(await screen.findByText('Escribe la nota (al menos 3 caracteres)')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /Nota de la decisión/ }), 'Foto impresa');
    await userEvent.click(submit);
    const dialog = await screen.findByRole('alertdialog', { name: '¿Confirmar el fraude del caso #7?' });
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Antes: AbiertoDespués: Fraude confirmado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar fraude' }));
    expect(await screen.findByRole('dialog', { name: 'Caso actualizado' })).toHaveTextContent('Nuevo estado: Fraude confirmado.');
    expect(JSON.parse(calls.find((c) => c.init.method === 'POST')?.init.body as string)).toEqual({ status: 'CONFIRMED', note: 'Foto impresa' });
    expect(await screen.findByRole('heading', { name: 'Caso #7' })).toBeInTheDocument();
  });

  it('no concluyente sin nota; falso positivo; un estado desconocido es no concluyente; el mismo estado no se envía', async () => {
    const { calls } = mockFetch((call) => apiOk(call.init.method === 'POST' ? detail : { ...detail, status: 'FALSE_POSITIVE' }));
    const view = renderFraud('/admin/fraud-cases/7/decision/OTRO');
    await userEvent.click(await screen.findByRole('button', { name: 'No concluyente' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Dejar el caso #7 como no concluyente?' });
    expect(dialog).toHaveTextContent('Sin nota');
    await userEvent.click(within(dialog).getByRole('button', { name: 'No concluyente' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'POST')).toBe(true));
    expect(JSON.parse(calls.find((c) => c.init.method === 'POST')?.init.body as string)).toEqual({ status: 'INCONCLUSIVE', note: null });
    view.unmount();
    renderFraud('/admin/fraud-cases/7/decision/FALSE_POSITIVE');
    expect(await screen.findByRole('button', { name: 'Falso positivo' })).toBeDisabled();
  });

  it('agregar una nota la confirma y regresa al caso; si el caso no carga ofrece reintentar', async () => {
    const { calls } = mockFetch(apiOk(detail));
    const view = renderFraud('/admin/fraud-cases/7/note');
    await userEvent.type(await screen.findByRole('textbox', { name: /Nota/ }), '  Revisar   cámara ');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar nota' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Agregar la nota al caso #7?' })).getByRole('button', { name: 'Agregar nota' }));
    expect(await screen.findByRole('heading', { name: 'Caso #7' })).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === 'POST');
    expect(post?.url).toBe('/api/admin/fraud-cases/7/notes');
    expect(JSON.parse(post?.init.body as string)).toEqual({ note: 'Revisar   cámara' });
    view.unmount();
    mockFetch(apiFail(404, 'FRAUD_CASE_NOT_FOUND', 'Caso de fraude no encontrado'));
    const note = renderFraud('/admin/fraud-cases/7/note');
    expect(await screen.findByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
    note.unmount();
    renderFraud('/admin/fraud-cases/7/decision/CONFIRMED');
    expect(await screen.findByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
  });

  it('en inglés', async () => {
    await act(() => setLocale('en-US'));
    mockFetch((call) => (call.url.includes('?') ? apiOk(page([base])) : apiOk(detail)));
    renderFraud('/admin/fraud-cases');
    expect(await screen.findByRole('heading', { name: 'Fraud cases' })).toBeInTheDocument();
    expect(await screen.findByText('Case #7')).toBeInTheDocument();
  });
});

describe('Casos de fraude: fallas', () => {
  it('la bandeja que no carga; tomar el caso que falla; cancelar una decisión o una nota; decidir o anotar que falla', async () => {
    mockFetch(apiFail(503, 'SERVER_BUSY', 'Ocupado'));
    const list = renderFraud('/admin/fraud-cases');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los casos de fraude' })).toBeInTheDocument();
    list.unmount();
    mockFetch((call) => (call.init.method === 'POST' ? apiFail(409, 'FRAUD_CASE_SAME_STATUS', 'El caso ya está en ese estado') : apiOk(detail)));
    const take = renderFraud('/admin/fraud-cases/7');
    await userEvent.click(await screen.findByRole('button', { name: 'Tomar el caso' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Tomar el caso #7?' })).getByRole('button', { name: 'Tomar el caso' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo tomar el caso' })).toHaveTextContent('El caso ya está en ese estado');
    take.unmount();

    const decision = renderFraud('/admin/fraud-cases/7/decision/INCONCLUSIVE');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Caso #7' })).toBeInTheDocument();
    decision.unmount();
    const note = renderFraud('/admin/fraud-cases/7/note');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Caso #7' })).toBeInTheDocument();
    note.unmount();

    const failing = renderFraud('/admin/fraud-cases/7/decision/INCONCLUSIVE');
    await userEvent.click(await screen.findByRole('button', { name: 'No concluyente' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: /no concluyente/ })).getByRole('button', { name: 'No concluyente' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo guardar la decisión' })).toBeInTheDocument();
    failing.unmount();
    renderFraud('/admin/fraud-cases/7/note');
    await userEvent.type(await screen.findByRole('textbox', { name: /Nota/ }), 'Revisar');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar nota' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Agregar la nota al caso #7?' })).getByRole('button', { name: 'Agregar nota' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo agregar la nota' })).toBeInTheDocument();
  });
});
