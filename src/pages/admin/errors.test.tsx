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
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, size: 10 });
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
    expect(screen.getByText(/1 pendientes/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por seguimiento/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Solucionado (4)' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain('status=RESOLVED'));
  });

  it('sin errores: buena noticia; con filtros: nada coincide', async () => {
    mockFetch(inbox([]));
    renderWithProviders(<ErrorsPage />, { route: '/admin/errors' });
    expect(await screen.findByText('Sin errores registrados')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar errores' }), 'x');
    expect(await screen.findByText('Ningún error coincide con los filtros')).toBeInTheDocument();
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

  it('muestra el detalle técnico, las ocurrencias y marca el seguimiento', async () => {
    const { calls } = mockFetch((call: MockCall) => {
      if (call.url.includes('/occurrences')) return apiOk(page([{ id: 1, occurred_at: '2026-10-03T10:00:00Z', trace_id: 'abc12345trace', message: 'falló', user_label: 'admin@empresa.com', company_name: 'Panificadora', context: { request: { method: 'GET', path: '/api/catalogs', body: null }, response: { status: 500, body: { code: 'INTERNAL_ERROR' } } } }]));
      if (call.init.method === 'PATCH') return apiOk({ ...report, status: 'IN_PROGRESS', status_changed_by: 'superadmin@plataforma.com', status_changed_at: '2026-10-03T11:00:00Z' });
      return apiOk(report);
    });
    renderDetail();
    expect(await screen.findByText(/RuntimeError: se rompió algo/)).toBeInTheDocument();
    expect(await screen.findByText(/admin@empresa.com · Panificadora · traceId abc12345trace/)).toBeInTheDocument();
    expect(screen.getByText('GET /api/catalogs → 500')).toBeInTheDocument(); // su contexto literal, plegado
    expect(screen.getByText(/reabierto 1 vez/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como en proceso' }));
    expect(await screen.findByText('Seguimiento actualizado')).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.init.method === 'PATCH')?.init.body as string)).toEqual({ status: 'IN_PROGRESS' });
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText(/Último cambio: superadmin@plataforma.com/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como en proceso' })).not.toBeInTheDocument();
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
