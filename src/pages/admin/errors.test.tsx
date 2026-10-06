import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { ErrorReportDetail, ServerStatus } from '../../types';
import { ErrorDetailPage } from './ErrorDetailPage';
import { ErrorsPage, whereOf } from './ErrorsPage';

const report: ErrorReportDetail = {
  id: 9,
  source: 'HTTP',
  severity: 'CRITICAL',
  status: 'PENDING',
  code: 'INTERNAL_ERROR',
  message: 'Ocurrió un error inesperado',
  http_status: 500,
  method: 'GET',
  location: '/api/catalogs',
  exception_type: 'RuntimeError',
  occurrences: 12,
  reopened: 1,
  first_seen_at: '2026-10-01T10:00:00Z',
  last_seen_at: '2026-10-03T10:00:00Z',
  last_trace_id: 'abc12345trace',
  status_changed_at: null,
  status_changed_by: null,
  detail: 'Traceback (most recent call last):\n  RuntimeError: se rompió algo',
};
const AS_OF = '2026-10-03T12:00:00Z';
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, size: 10, as_of: AS_OF });
const summary = { by_status: { PENDING: 1, RESOLVED: 4 }, open_by_severity: { CRITICAL: 1 }, pending: 1, last_seen_at: null };
const server: ServerStatus = {
  status: 'degraded',
  components: { database: { status: 'ok' }, face_engine: { status: 'unavailable', error: 'Modelo no encontrado' } },
  admission: {
    limit: 48,
    bounds: [32, 100],
    in_flight: 3,
    waiting: 0,
    admitted: 1200,
    shed: 7,
    latency_ratio: 1.1,
    top_demand: [
      { api: 'POST checkpoint/identify/face', tier: 'CRITICAL', recent_requests: 1500, latency_ms: 210.5, shed: 0 },
      { api: 'GET employees', tier: 'NORMAL', recent_requests: 40, latency_ms: null, shed: 7 },
    ],
  },
  storage: { configured: false, backend: 'disabled', bucket: null, prefix: 'local', reason: 'sin llave', count_cap: 10000, images: [], tasks: [] },
};
/** Bandeja: resumen, estado del servidor y la lista. */
function inbox(items: ErrorReportDetail[]) {
  return (call: MockCall) => {
    if (call.url.includes('/summary')) return apiOk(summary);
    if (call.url.includes('/server')) return apiOk(server);
    return apiOk(page(items));
  };
}

describe('Errores del sistema: bandeja', () => {
  it('lista los errores con gravedad, lugar, veces y seguimiento; filtra por seguimiento', async () => {
    const { calls } = mockFetch(inbox([report]));
    renderWithProviders(<ErrorsPage />, { route: '/admin/errors' });
    expect(await screen.findByText('INTERNAL_ERROR')).toBeInTheDocument();
    expect(screen.getByText('GET /api/catalogs · 500')).toBeInTheDocument();
    expect(screen.getByText(/^1 pendiente · /)).toBeInTheDocument(); // el plural sigue al número
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por seguimiento/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Solucionado (4)' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain('status=RESOLVED'));
  });

  it('sin errores: buena noticia; con filtros: nada coincide', async () => {
    mockFetch(inbox([]));
    renderWithProviders(<ErrorsPage />, { route: '/admin/errors' });
    expect(await screen.findByText('Sin errores')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar errores' }), 'x');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('muestra el estado del servidor: dependencias con su error y la capacidad adaptativa', async () => {
    const { calls } = mockFetch(inbox([]));
    renderWithProviders(<ErrorsPage />, { route: '/admin/errors' });
    expect(await screen.findByText('Funciones limitadas')).toBeInTheDocument();
    expect(screen.getByText('Base de datos: disponible')).toBeInTheDocument();
    expect(screen.getByText('Motor facial: unavailable')).toBeInTheDocument();
    expect(screen.getByText('Modelo no encontrado')).toBeInTheDocument();
    expect(screen.getByText(/entre 32 y 100/)).toBeInTheDocument();
    expect(screen.getByText(/prioridad crítica · 1,500 peticiones recientes · 210.5 ms/)).toBeInTheDocument();
    expect(screen.getByText(/prioridad normal · 40 peticiones recientes · 7 descartadas/)).toBeInTheDocument();
    const before = calls.filter((c) => c.url.includes('/server')).length;
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/server')).length).toBe(before + 1));
  });

  it('si el estado del servidor no carga, ofrece reintentar (la bandeja sigue)', async () => {
    mockFetch((call: MockCall) => (call.url.includes('/server') ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : inbox([report])(call)));
    renderWithProviders(<ErrorsPage />, { route: '/admin/errors' });
    expect(await screen.findByText('INTERNAL_ERROR')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
  });

  it('filtra por gravedad y al abrir un error lleva a su detalle', async () => {
    const { calls } = mockFetch(inbox([report]));
    renderWithProviders(
      <Routes>
        <Route path="/admin/errors" element={<ErrorsPage />} />
        <Route path="/admin/errors/:id" element={<p>Detalle del error</p>} />
      </Routes>,
      { route: '/admin/errors' },
    );
    await screen.findByText('INTERNAL_ERROR');
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por gravedad/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Crítico' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain('severity=CRITICAL'));
    expect(calls.at(-1)?.url).not.toContain('status='); // el seguimiento sigue en "todo"
    await userEvent.click(await screen.findByText('INTERNAL_ERROR'));
    expect(await screen.findByText('Detalle del error')).toBeInTheDocument();
  });

  it('"Marcar como solucionados" solo con un filtro específico: confirma, envía el filtro y lo que vio el ADMIN', async () => {
    const { calls } = mockFetch((call: MockCall) => (call.url.endsWith('/resolve') ? apiOk({ resolved: 1 }) : inbox([report])(call)));
    renderWithProviders(<ErrorsPage />, { route: '/admin/errors' });
    await screen.findByText('INTERNAL_ERROR');
    expect(screen.queryByRole('button', { name: /Marcar como solucionados/ })).toBeNull(); // "todo": nunca toda la bandeja

    await userEvent.click(screen.getByRole('button', { name: /Filtrar por gravedad/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Crítico' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar errores' }), 'catalogs');
    await waitFor(() => expect(calls.at(-1)?.url).toContain('search=catalogs'));
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como solucionados (1)' }));
    let dialog = await screen.findByRole('dialog', { name: '¿Marcar como solucionado el error?' });
    expect(within(dialog).getByText(/Incluye el error con gravedad «Crítico», búsqueda «catalogs»/)).toBeInTheDocument();
    // Solo con la gravedad en el filtro, cada error está en su propio seguimiento.
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('SeguimientoAntes: Sin solucionarDespués: Solucionado');
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Errores1Vistos hasta');
    expect(dialog).toHaveTextContent('Si alguno vuelve a ocurrir, se reabre como pendiente.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.url.endsWith('/resolve'))).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Marcar como solucionados (1)' }));
    dialog = await screen.findByRole('dialog', { name: '¿Marcar como solucionado el error?' });
    const listed = calls.filter((c) => !c.url.endsWith('/resolve') && c.url.startsWith('/api/admin/errors?')).length;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como solucionados' }));
    expect(await screen.findByText('1 error marcado como solucionado.')).toBeInTheDocument();
    const sent = calls.find((c) => c.url.endsWith('/resolve'));
    expect(sent?.init.method).toBe('POST');
    expect(JSON.parse(sent?.init.body as string)).toEqual({ severity: 'CRITICAL', search: 'catalogs', seen_until: AS_OF });
    // La bandeja y su resumen se vuelven a pedir.
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/api/admin/errors?')).length).toBe(listed + 1));
  });

  it('con el filtro "Solucionado" o sin errores no se ofrece; si falla, lo avisa y se puede repetir', async () => {
    let attempts = 0;
    const { calls } = mockFetch((call: MockCall) => {
      if (call.url.endsWith('/resolve')) return attempts++ === 0 ? apiFail(422, 'ERROR_FILTER_REQUIRED', 'Elige un estado o una gravedad') : apiOk({ resolved: 2 });
      if (call.url.includes('status=RESOLVED')) return apiOk(page([{ ...report, status: 'RESOLVED' }]));
      return inbox([report, { ...report, id: 10, code: 'OTRO' }])(call);
    });
    renderWithProviders(<ErrorsPage />, { route: '/admin/errors' });
    await screen.findByText('OTRO');
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por seguimiento/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Solucionado (4)' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain('status=RESOLVED'));
    expect(screen.queryByRole('button', { name: /Marcar como solucionados/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Filtrar por seguimiento/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Pendiente (1)' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como solucionados (2)' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Marcar como solucionados los 2 errores?' });
    expect(within(dialog).getByText(/Incluye los 2 errores con seguimiento «Pendiente»/)).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('SeguimientoAntes: PendienteDespués: Solucionado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como solucionados' }));
    const failed = await screen.findByRole('alertdialog', { name: 'No se pudieron marcar los errores' });
    await userEvent.click(within(failed).getByRole('button', { name: 'Entendido' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como solucionados (2)' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Marcar como solucionados los 2 errores?' })).getByRole('button', { name: 'Marcar como solucionados' }));
    expect(await screen.findByText('2 errores marcados como solucionados.')).toBeInTheDocument();
  });

  it('dónde ocurrió, también si vino del log del backend', () => {
    expect(whereOf({ ...report, method: null, location: 'app/services/x.py:10', http_status: null, source: 'LOG' })).toBe('app/services/x.py:10');
    expect(whereOf({ ...report, method: null, location: null, http_status: null, source: 'WEBSOCKET' })).toBe('WEBSOCKET');
  });
});

describe('Errores del sistema: detalle y seguimiento', () => {
  function renderDetail() {
    return renderWithProviders(
      <Routes>
        <Route path="/admin/errors/:id" element={<ErrorDetailPage />} />
      </Routes>,
      { route: '/admin/errors/9' },
    );
  }

  it('muestra el detalle técnico, las ocurrencias y marca el seguimiento (cada cambio se confirma)', async () => {
    const { calls } = mockFetch((call: MockCall) => {
      if (call.url.includes('/occurrences')) return apiOk(page([{ id: 1, occurred_at: '2026-10-03T10:00:00Z', trace_id: 'abc12345trace', message: 'falló', user_label: 'admin@empresa.com', company_name: 'Panificadora', context: { request: { method: 'GET', path: '/api/catalogs', body: null }, response: { status: 500, body: { code: 'INTERNAL_ERROR' } } } }]));
      if (call.init.method === 'PATCH') {
        const { status } = JSON.parse(call.init.body as string) as { status: string };
        return apiOk({ ...report, status, status_changed_by: 'superadmin@plataforma.com', status_changed_at: '2026-10-03T11:00:00Z' });
      }
      return apiOk(report);
    });
    const patches = () => calls.filter((c) => c.init.method === 'PATCH').map((c) => JSON.parse(c.init.body as string) as unknown);
    renderDetail();
    expect(await screen.findByText(/RuntimeError: se rompió algo/)).toBeInTheDocument();
    expect(await screen.findByText(/admin@empresa.com · Panificadora · traceId abc12345trace/)).toBeInTheDocument();
    expect(screen.getByText('GET /api/catalogs → 500')).toBeInTheDocument(); // su contexto literal, plegado
    expect(screen.getByText(/reabierto 1 vez/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Marcar como en proceso' }));
    let dialog = await screen.findByRole('dialog', { name: '¿Marcar INTERNAL_ERROR como en proceso?' });
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('SeguimientoAntes: PendienteDespués: En proceso');
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('MensajeOcurrió un error inesperadoDóndeGET /api/catalogs · 500Ocurrencias12');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(patches()).toEqual([]); // cancelar no envía nada
    expect(screen.getByRole('button', { name: 'Marcar como en proceso' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Marcar como en proceso' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Marcar INTERNAL_ERROR como en proceso?' })).getByRole('button', { name: 'Marcar como en proceso' }));
    expect(await screen.findByText('Seguimiento actualizado')).toBeInTheDocument();
    expect(patches()).toEqual([{ status: 'IN_PROGRESS' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText(/Último cambio: superadmin@plataforma.com/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como en proceso' })).not.toBeInTheDocument();

    // Solucionarlo se confirma en verde y recuerda que se reabre solo si vuelve a ocurrir.
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como solucionado' }));
    dialog = await screen.findByRole('dialog', { name: '¿Marcar INTERNAL_ERROR como solucionado?' });
    expect(dialog).toHaveClass('msg--success');
    expect(dialog).toHaveTextContent('Si vuelve a ocurrir, se reabre como pendiente.');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Antes: En procesoDespués: Solucionado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como solucionado' }));
    await waitFor(() => expect(patches()).toEqual([{ status: 'IN_PROGRESS' }, { status: 'RESOLVED' }]));
  });

  it('origen desconocido tal cual, reabierto varias veces y ocurrencias sin sesión', async () => {
    mockFetch((call: MockCall) => {
      if (call.url.includes('/occurrences')) return apiOk(page([{ id: 2, occurred_at: '2026-10-03T10:00:00Z', trace_id: null, message: 'falló al arrancar', user_label: null, company_name: null }]));
      return apiOk({ ...report, source: 'SCHEDULER', reopened: 3 });
    });
    renderDetail();
    expect(await screen.findByText('SCHEDULER')).toBeInTheDocument(); // un origen nuevo del backend se muestra con su código
    expect(screen.getByText(/reabierto 3 veces/)).toBeInTheDocument();
    expect(await screen.findByText('Sin sesión')).toBeInTheDocument(); // ni usuario, ni empresa, ni traceId
    expect(screen.getByText('falló al arrancar')).toBeInTheDocument();
  });

  it('un error controlado no tiene stack trace; si no carga ofrece reintentar', async () => {
    let attempts = 0;
    mockFetch((call: MockCall) => {
      if (call.url.includes('/occurrences')) return apiOk(page([]));
      attempts += 1;
      return attempts === 1 ? apiFail(500, 'INTERNAL_ERROR') : apiOk({ ...report, detail: null, exception_type: null, reopened: 0, last_trace_id: null });
    });
    renderDetail();
    const [retry] = await screen.findAllByRole('button', { name: /Reintentar/ });
    await userEvent.click(retry);
    expect(await screen.findByText(/Sin stack trace/)).toBeInTheDocument();
    expect(screen.getByText('Controlado (sin excepción)')).toBeInTheDocument();
    expect(await screen.findByText('Sin ocurrencias recientes')).toBeInTheDocument();
    expect(within(document.body).queryByText(/Último traceId/)).not.toBeInTheDocument();
  });
});
