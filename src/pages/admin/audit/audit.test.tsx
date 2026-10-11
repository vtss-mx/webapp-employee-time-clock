import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { auditService } from '../../../services/auditService';
import type { AuditEvent, AuditExport, AuditSummary } from '../../../types/audit';
import { AuditPage } from './AuditPage';

const period = { since: '2026-09-28T06:00:00Z', until: '2026-10-06T05:59:59Z' };

const policyChange: AuditEvent = {
  id: 1,
  occurred_at: '2026-10-05T10:00:00Z',
  action: 'VERIFICATION_POLICY_CHANGED',
  outcome: 'OK',
  actor_email: 'support@vtss.mx',
  actor_role: 'ADMIN',
  actor_id: 1,
  company_id: 1,
  company_name: 'Acme',
  entity_type: 'verification_policy',
  entity_id: '1',
  ip: '187.188.1.10',
  user_agent: 'Safari',
  trace_id: 'abc12345trace',
  details: { site_codes: { before: 'OBSERVE', after: 'ENFORCE' }, liveness_steps: 2, qr_only: false },
};
/** Un acceso negado del sistema: sin actor, sin registro, sin origen y sin detalle. */
const denied: AuditEvent = {
  ...policyChange,
  id: 2,
  action: 'AUDIT_LOG_VIEWED',
  outcome: 'DENIED',
  actor_email: null,
  actor_role: null,
  company_id: null,
  company_name: null,
  entity_type: null,
  entity_id: null,
  ip: null,
  user_agent: null,
  trace_id: null,
  details: null,
};
/** Una acción que esta versión no conoce: su código es un dato y se dibuja tal cual. */
const future: AuditEvent = { ...denied, id: 3, action: 'ACCION_DEL_FUTURO', outcome: 'RESULTADO_NUEVO', entity_type: 'thing', entity_id: null };

const summary: AuditSummary = {
  ...period,
  total: 128,
  by_action: [
    { action: 'VERIFICATION_POLICY_CHANGED', outcome: 'OK', total: 120 },
    { action: 'LOGIN_FAILED', outcome: 'DENIED', total: 5 },
    { action: 'LOGIN_BLOCKED', outcome: 'DENIED', total: 2 },
    { action: 'PERSON_DATA_ERASED', outcome: 'FAILED', total: 1 },
  ],
  dropped: 0,
  pending: 3,
  retention_days: 730,
};

interface ServerOptions {
  events?: AuditEvent[];
  summaryResponse?: Response;
  listResponse?: Response;
  /** Tramos de la exportación, en orden (cada llamada consume el siguiente). */
  chunks?: Response[];
}

function server({ events = [policyChange, denied, future], summaryResponse = apiOk(summary), listResponse, chunks }: ServerOptions = {}) {
  const queue = [...(chunks ?? [])];
  return mockFetch((call: MockCall) => {
    if (call.url.includes('/admin/audit/export')) return queue.length > 1 ? (queue.shift() as Response) : (queue[0] ?? apiOk({ items: events, next_cursor: null, ...period }));
    if (call.url.includes('/admin/audit/summary')) return summaryResponse;
    return listResponse ?? apiOk({ items: events, total: events.length, page: 1, size: 10, ...period });
  });
}

const renderPage = (route = '/admin/audit') =>
  renderWithProviders(
    <Routes>
      <Route path="/admin/audit" element={<AuditPage />} />
    </Routes>,
    { route },
  );

const listRequests = (calls: MockCall[]) => calls.filter((c) => /\/admin\/audit(\?|$)/.test(c.url));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuditPage (bitácora de auditoría, ADMIN)', () => {
  it('indicadores, periodo, retención y cada evento con su «antes → después»', async () => {
    server();
    const { container } = renderPage();
    expect(await screen.findByText('Política de verificación cambiada')).toBeInTheDocument();
    expect([...container.querySelectorAll('.kpi__label')].map((kpi) => kpi.textContent)).toEqual(['Eventos', 'Accesos negados', 'Acciones que fallaron', 'Por guardar']);
    // Los negados y los fallidos se suman de los conteos que el servidor ya agrupó.
    await waitFor(() => expect(container.querySelectorAll('.kpi__value')[1]).toHaveTextContent('7'));
    expect(container.querySelectorAll('.kpi__value')[2]).toHaveTextContent('1');
    expect(screen.getByText(/Cada evento se conserva 730 días/)).toBeInTheDocument();
    expect(screen.getByText('Eventos en el periodo: 3')).toBeInTheDocument();

    const row = screen.getByText('Política de verificación cambiada').closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('Rastreo abc12345trace');
    expect(row).toHaveTextContent('support@vtss.mx');
    expect(row).toHaveTextContent('Administrador');
    expect(row).toHaveTextContent('verification_policy 1');
    expect(row).toHaveTextContent('Acme');
    expect(row).toHaveTextContent('187.188.1.10');
    expect(within(row).getByText('Se hizo')).toHaveClass('badge--success');
    // El «antes → después» del cambio y los datos sueltos, legibles.
    expect(row).toHaveTextContent('OBSERVE ENFORCE');
    expect(row).toHaveTextContent('liveness_steps');
    expect(row).toHaveTextContent('No');
  });

  it('un evento del sistema, sin registro ni origen, y un código que esta versión no conoce se dibuja tal cual', async () => {
    server();
    renderPage();
    const systemRow = (await screen.findByText('Bitácora de auditoría consultada')).closest('tr') as HTMLElement;
    expect(systemRow).toHaveTextContent('Sistema');
    expect(systemRow).toHaveTextContent('Sin registro');
    expect(systemRow).toHaveTextContent('Plataforma');
    expect(systemRow).toHaveTextContent('Sin origen');
    expect(systemRow).toHaveTextContent('Sin detalle');
    expect(within(systemRow).getByText('Negada')).toHaveClass('badge--warning');
    const futureRow = screen.getByText('ACCION_DEL_FUTURO').closest('tr') as HTMLElement;
    expect(within(futureRow).getByText('RESULTADO_NUEVO')).toHaveClass('badge--muted');
    expect(futureRow).toHaveTextContent('thing');
  });

  it('el total llega al tope del servidor y se muestra «10,000+»', async () => {
    server({ listResponse: apiOk({ items: [policyChange], total: 10_000, count_cap: 10_000, page: 1, size: 10, ...period }) });
    renderPage();
    expect(await screen.findByText('Eventos en el periodo: 10,000+')).toBeInTheDocument();
  });

  it('eventos descartados por falta de memoria: un hueco en la evidencia nunca es silencioso', async () => {
    server({ summaryResponse: apiOk({ ...summary, dropped: 4 }) });
    renderPage();
    expect(await screen.findByText(/Se descartaron 4 eventos por falta de memoria/)).toBeInTheDocument();
  });

  it('los filtros viajan al servidor: periodo en la zona del negocio, acción, resultado y búsqueda', async () => {
    const { calls } = server();
    renderPage();
    await screen.findByText('Política de verificación cambiada');
    await userEvent.click(screen.getByRole('button', { name: /^Resultado/ }));
    await userEvent.click(await screen.findByRole('option', { name: /^Negada/ }));
    await waitFor(() => expect(listRequests(calls).at(-1)?.url).toContain('outcome=DENIED'));
    await userEvent.click(screen.getByRole('button', { name: /^Acción/ }));
    await userEvent.click(await screen.findByRole('option', { name: /^Inicio de sesión fallido/ }));
    await waitFor(() => expect(listRequests(calls).at(-1)?.url).toContain('action=LOGIN_FAILED'));
    await userEvent.type(screen.getByLabelText('Buscar en la bitácora'), 'ana@acme.mx');
    await waitFor(() => expect(listRequests(calls).at(-1)?.url).toContain('search=ana%40acme.mx'), { timeout: 2000 });
    // El día elegido se envía como el inicio y el fin del día EN LA ZONA DEL NEGOCIO (no en UTC ni en la del dispositivo).
    await userEvent.type(screen.getByLabelText('Desde'), '01/10/2026');
    await waitFor(() => expect(listRequests(calls).at(-1)?.url).toContain('since=2026-10-01T06%3A00%3A00.000Z'));
    await userEvent.type(screen.getByLabelText('Hasta'), '05/10/2026');
    await waitFor(() => expect(listRequests(calls).at(-1)?.url).toContain('until=2026-10-06T05%3A59%3A59.999Z'));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await waitFor(() => expect(listRequests(calls).at(-1)?.url).toBe('/api/admin/audit?page=1&size=10'));
  });

  it('con filtros y sin coincidencias el vacío lo dice; sin filtros, que aquí se verán los eventos', async () => {
    server({ events: [] });
    const { unmount } = renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent('Sin eventos');
    expect(screen.getByRole('status')).toHaveTextContent('Aquí verás cada acción con su resultado.');
    unmount();
    server({ events: [] });
    renderPage('/admin/audit');
    await userEvent.type(await screen.findByLabelText('Buscar en la bitácora'), 'nadie');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Sin resultados'), { timeout: 2000 });
  });

  it('si el resumen falla se puede reintentar; la lista sigue mostrándose', async () => {
    server({ summaryResponse: apiFail(503, 'SERVICE_UNAVAILABLE') });
    renderPage();
    expect(await screen.findByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
    expect(await screen.findByText('Política de verificación cambiada')).toBeInTheDocument();
  });

  it('si la lista falla, el popup lo dice con su título y se vuelve a pedir', async () => {
    const { calls } = server({ listResponse: apiFail(503, 'SERVICE_UNAVAILABLE', 'El servidor no está disponible.') });
    renderPage();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar la bitácora' });
    // Un 503 lo explica la app (no el mensaje del servidor): es una falla pasajera y se puede reintentar.
    expect(popup).toHaveTextContent('Servicio no disponible. Intenta de nuevo en unos segundos.');
    const before = listRequests(calls).length;
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(listRequests(calls).length).toBeGreaterThan(before));
  });
});

describe('AuditPage: exportar la bitácora para el auditor', () => {
  it('pregunta antes, junta los tramos del periodo, descarga un JSON y dice cuántos eventos se llevó', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const url = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const { calls } = server({
      chunks: [apiOk({ items: [policyChange], next_cursor: 'c2', ...period }), apiOk({ items: [denied], next_cursor: null, ...period })],
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    const ask = await screen.findByRole('dialog', { name: '¿Exportar la bitácora del periodo?' });
    expect(within(ask).getByText('La exportación queda registrada en la bitácora, con su filtro.')).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('Bitácora exportada')).toBeInTheDocument();
    expect(screen.getByText('2 eventos en audit-2026-09-28-2026-10-06.json')).toBeInTheDocument();
    expect(click).toHaveBeenCalled();
    expect(url).toHaveBeenCalled();
    // El segundo tramo se pide con el cursor del primero.
    const exports = calls.filter((c) => c.url.includes('/export'));
    expect(exports).toHaveLength(2);
    expect(exports[1].url).toContain('cursor=c2');
  });

  it('un periodo sin eventos no descarga nada y lo dice', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    server({ chunks: [apiOk({ items: [], next_cursor: null, ...period })] });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    const ask = await screen.findByRole('dialog', { name: '¿Exportar la bitácora del periodo?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('Sin eventos en el periodo')).toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
  });

  it('cancelar no exporta nada y una falla se explica con el error del servidor', async () => {
    const { calls } = server({ chunks: [apiFail(503, 'SERVICE_UNAVAILABLE', 'El servidor no está disponible.')] });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(calls.filter((c) => c.url.includes('/export'))).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    const ask = await screen.findByRole('dialog', { name: '¿Exportar la bitácora del periodo?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Exportar' }));
    expect(await screen.findByText('No se pudo exportar la bitácora')).toBeInTheDocument();
  });

  it('en inglés, los indicadores y el aviso de la exportación salen en el idioma activo', async () => {
    await setLocale('en-US');
    server({ chunks: [apiOk({ items: [policyChange], next_cursor: null, ...period })] });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    renderPage();
    expect(await screen.findByText('Audit log')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    const ask = await screen.findByRole('dialog', { name: 'Export the audit log for this period?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Export' }));
    expect(await screen.findByText('Audit log exported')).toBeInTheDocument();
    expect(screen.getByText('1 event in audit-2026-09-28-2026-10-06.json')).toBeInTheDocument();
  });

  it('con un filtro la pregunta lo dice; al llegar al tope de tramos avisa que hay que acotar el periodo', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    // Un servidor que siempre devuelve otro cursor: la app corta en su tope y lo dice (nunca pide tramos sin fin).
    const { calls } = mockFetch((call: MockCall) => {
      if (call.url.includes('/admin/audit/export')) return apiOk({ items: [policyChange], next_cursor: 'c', ...period });
      if (call.url.includes('/admin/audit/summary')) return apiOk(summary);
      return apiOk({ items: [policyChange], total: 1, page: 1, size: 10, ...period });
    });
    renderPage();
    await screen.findByText('Política de verificación cambiada');
    await userEvent.click(screen.getByRole('button', { name: /^Resultado/ }));
    await userEvent.click(await screen.findByRole('option', { name: /^Negada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    const ask = await screen.findByRole('dialog', { name: '¿Exportar la bitácora del periodo?' });
    expect(within(ask).getByText('Se descarga un archivo JSON con los eventos del filtro que estás viendo.')).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Exportar' }));
    expect(await screen.findByRole('dialog', { name: 'Bitácora exportada' })).toHaveTextContent('Se alcanzó el tope de 200 tramos: acota el periodo.');
    expect(calls.filter((c) => c.url.includes('/admin/audit/export'))).toHaveLength(200);
  });

  it('mientras exporta, el botón dice en qué tramo va y cuántos eventos lleva', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    server();
    // El segundo tramo se entrega cuando la prueba lo suelta: así se ve el botón a media exportación.
    let release = () => undefined as void;
    const second = new Promise<AuditExport>((resolve) => {
      release = () => resolve({ items: [denied], next_cursor: null, ...period });
    });
    const chunk = vi
      .spyOn(auditService, 'exportChunk')
      .mockResolvedValueOnce({ items: [policyChange], next_cursor: 'c2', ...period })
      .mockReturnValueOnce(second);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    const ask = await screen.findByRole('dialog', { name: '¿Exportar la bitácora del periodo?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Exportar' }));
    expect(await screen.findByRole('button', { name: 'Tramo 1 · 1 evento' })).toBeDisabled();
    await act(async () => {
      release();
      await second;
    });
    expect(await screen.findByRole('dialog', { name: 'Bitácora exportada' })).toBeInTheDocument();
    expect(chunk).toHaveBeenCalledTimes(2);
  });
});
