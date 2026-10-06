import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { adminUser, renderPage, rowsOf, settle } from '../../../test/companyPages';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { alertDetail, functionRow, series } from '../../../test/performance';
import type { SlowAlertDetail, SlowAlertStatus } from '../../../types/performance';
import { MetricDetailPage } from './MetricDetailPage';
import { SlowAlertDetailPage } from './SlowAlertDetailPage';

const refreshers = vi.hoisted(() => [] as Array<() => void>);
vi.mock('../../../hooks/useAutoRefresh', () => ({ useAutoRefresh: (refresh: () => void) => refreshers.push(refresh) }));

const urls = (calls: MockCall[], part: string) => calls.filter((c) => c.url.includes(part)).map((c) => c.url);
const metricRoute = (query: string) => `/admin/performance/metric?${query}`;
const renderMetric = (route: string) => renderPage('/admin/performance/metric', route, <MetricDetailPage />, { targets: { '/admin/performance/alerts/:id': 'Detalle de la alerta' } });

describe('detalle de una métrica', () => {
  it('ruta del servidor: totales (con base de datos y MB), llamadas y tiempos en el tiempo, su alerta y el periodo en la URL', async () => {
    const { calls } = mockFetch((call) => apiOk({ ...series, period: new URL(call.url, 'http://x').searchParams.get('period') }));
    renderMetric(metricRoute('kind=HTTP&name=GET+%2Fapi%2Femployees%2F%7Bemployee_id%7D'));
    expect(await screen.findByRole('heading', { name: 'GET /api/employees/{employee_id}' })).toBeInTheDocument();
    expect(urls(calls, '/series')[0]).toBe('/api/admin/performance/metrics/series?kind=HTTP&name=GET+%2Fapi%2Femployees%2F%7Bemployee_id%7D&period=24h');
    expect(screen.getByText('Ruta del servidor · Últimas 24 horas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Rendimiento/ })).toHaveAttribute('href', '/admin/performance?tab=routes');
    expect([...document.querySelectorAll('.kpi__label')].map((label) => label.textContent)).toEqual([
      'Llamadas',
      'Fallas',
      'Tiempo típico (p50)',
      'Tiempo p95',
      'Tiempo p99',
      'Promedio',
      'Tiempo en la base de datos',
      'Datos de entrada',
      'Datos de salida',
    ]);
    expect(screen.getByText('3 fallas')).toBeInTheDocument();
    expect(screen.getByText('Máximo 2.4 s')).toBeInTheDocument();
    expect(screen.getByText('2.5 consultas en promedio')).toBeInTheDocument();
    expect(document.querySelectorAll('.icon-tile')[1]).toHaveClass('icon-tile--danger');
    expect(screen.getByRole('img', { name: /^Llamadas por intervalo\. 2 intervalos\. Total Llamadas por intervalo: 1,200/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Tiempo de respuesta/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '7 días' }));
    await waitFor(() => expect(urls(calls, '/series').at(-1)).toContain('period=7d'));
    expect(await screen.findByText('Ruta del servidor · Últimos 7 días')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Rendimiento/ })).toHaveAttribute('href', '/admin/performance?tab=routes&period=7d');
    await settle(() => refreshers.at(-1)?.());
    await waitFor(() => expect(urls(calls, '/series')).toHaveLength(3));
    await userEvent.click(screen.getByRole('link', { name: 'Ver su alerta' }));
    expect(await screen.findByText('Detalle de la alerta')).toBeInTheDocument();
  });

  it('una ruta sin medición de la base de datos muestra 0 % (no un esqueleto eterno)', async () => {
    mockFetch(apiOk({ ...series, totals: { ...series.totals, db_share: null, avg_queries: null } }));
    renderMetric(metricRoute('kind=HTTP&name=GET+%2Fapi%2Fx'));
    expect(await screen.findByText('— consultas en promedio')).toBeInTheDocument();
    await waitFor(() => expect(document.querySelectorAll('.kpi__value')[6]).toHaveTextContent('0 %'));
  });

  it('una función sin llamadas en el periodo: sin base de datos ni alerta, y el vacío lo dice', async () => {
    mockFetch(apiOk({ ...series, kind: 'FUNCTION', name: 'face.detect', totals: { ...functionRow, count: 0, errors: 0 }, points: [], slow_alert_id: null }));
    renderMetric(metricRoute('kind=FUNCTION&name=face.detect&period=90d'));
    expect(await screen.findByText('Sin datos')).toBeInTheDocument();
    expect(screen.getByText('Función · Últimos 90 días')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Rendimiento/ })).toHaveAttribute('href', '/admin/performance?tab=functions&period=90d');
    expect(document.querySelectorAll('.kpi__label')).toHaveLength(6);
    expect(document.querySelectorAll('.icon-tile')[1]).toHaveClass('icon-tile--success');
    expect(screen.queryByRole('link', { name: 'Ver su alerta' })).toBeNull();
  });

  it('una API del navegador vuelve a la pestaña Navegador; si no carga, popup y "Volver a cargar"', async () => {
    let tries = 0;
    mockFetch(() => (tries++ === 0 ? apiFail(500, 'INTERNAL_ERROR') : apiOk({ ...series, kind: 'WEB_API', totals: { ...series.totals, kind: 'WEB_API', db_share: null } })));
    renderMetric(metricRoute('kind=WEB_API&name=POST+%2Fapi%2Fauth%2Flogin'));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar la métrica' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(screen.getByRole('link', { name: /Rendimiento/ })).toHaveAttribute('href', '/admin/performance?tab=browser');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('API vista desde el navegador · Últimas 24 horas')).toBeInTheDocument();
  });

  it.each([['kind=HTTP'], ['name=GET+%2Fx'], ['kind=OTRO&name=x'], ['kind=HTTP&name=+++']])('sin una métrica válida (%s) no consulta nada y explica qué pasó', async (query) => {
    const { calls } = mockFetch(apiOk(series));
    renderMetric(metricRoute(query));
    expect(await screen.findByText('Enlace incompleto')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Rendimiento/ })).toHaveAttribute('href', '/admin/performance');
    expect(calls).toEqual([]);
  });
});

const changed = (detail: SlowAlertDetail, status: SlowAlertStatus) => ({ ...detail, status, status_changed_by: 'ana@plataforma.com', status_changed_at: '2026-10-04T18:30:00Z' });

/** La alerta y su cambio de seguimiento (lo que envíe el PATCH, o una falla). */
function alertServer(detail: SlowAlertDetail = alertDetail, patch?: (call: MockCall) => Response) {
  return mockFetch((call) => {
    if (call.init.method === 'PATCH') return patch?.(call) ?? apiOk(changed(detail, (JSON.parse(call.init.body as string) as { status: SlowAlertStatus }).status));
    return apiOk(detail);
  });
}

const renderAlert = (user = adminUser) =>
  renderPage('/admin/performance/alerts/:id', '/admin/performance/alerts/7', <SlowAlertDetailPage />, {
    user,
    targets: { '/admin/performance/metric': 'Detalle de la métrica', '/admin/errors/:id': 'Detalle del error' },
  });

describe('detalle de una alerta de petición lenta', () => {
  it('sus datos, la ruta en 24 h, el rastreo, el error registrado y el contexto de la última petición lenta', async () => {
    const { calls } = alertServer();
    renderAlert();
    expect(await screen.findByRole('heading', { name: 'GET /api/employees/{employee_id}' })).toBeInTheDocument();
    expect(calls[0].url).toBe('/api/admin/performance/alerts/7');
    expect(screen.getByText('Peticiones que tardaron más de 1 s')).toBeInTheDocument();
    expect(screen.getByText('Abierta', { selector: '.badge' })).toHaveClass('badge--danger');
    expect(screen.getByText(/Sin seguimiento todavía\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Alertas/ })).toHaveAttribute('href', '/admin/performance?tab=alerts');
    const data = screen.getByRole('heading', { name: 'Datos' }).closest('section') as HTMLElement;
    expect(data).toHaveTextContent('Peticiones lentas14');
    expect(data).toHaveTextContent('La última tardó1.8 s');
    expect(data).toHaveTextContent('Último código HTTP200');
    expect(data).toHaveTextContent('Veces reabierta1');
    const route = screen.getByRole('heading', { name: 'La ruta en las últimas 24 h' }).closest('section') as HTMLElement;
    expect(route).toHaveTextContent('Peticiones320');
    expect(route).toHaveTextContent('Tiempo p951.1 s');
    expect(within(route).getByText('trace-slow-1')).toBeInTheDocument();
    expect(within(route).getByRole('link', { name: 'Ver la ruta en el tiempo' })).toHaveAttribute('href', '/admin/performance/metric?kind=HTTP&name=GET+%2Fapi%2Femployees%2F%7Bemployee_id%7D&period=24h');
    const sample = screen.getByRole('heading', { name: 'Última petición lenta' }).closest('section') as HTMLElement;
    expect(sample).toHaveTextContent('PeticiónGET /api/employees/{employee_id}');
    expect(sample).toHaveTextContent('Parámetrospage=2 · size=50');
    expect(sample).toHaveTextContent('En la base de datos1.2 s');
    expect(sample).toHaveTextContent('Entrada / salida0 MB / 2.00 MB');
    expect(sample).toHaveTextContent('UsuarioUsuario 5 · Empresa');
    expect(sample).toHaveTextContent('EmpresaEmpresa 3');
    await userEvent.click(within(route).getByRole('link', { name: 'Ver el error registrado' }));
    expect(await screen.findByText('Detalle del error')).toBeInTheDocument();
  });

  it('sin rastreo, contexto ni la pantalla de errores: no ofrece lo que no hay; muestra quién cambió el seguimiento', async () => {
    const bare = { ...changed(alertDetail, 'ACKNOWLEDGED'), last_trace_id: null, last_status: null, sample: null };
    alertServer(bare);
    renderAlert({ ...adminUser, screens: adminUser.screens.filter((s) => s.code !== 'ADMIN_ERRORS') });
    expect(await screen.findByText('Sin contexto de la última petición lenta.')).toBeInTheDocument();
    expect(screen.getByText(/Último cambio: ana@plataforma\.com/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver el error registrado' })).toBeNull();
    expect(screen.queryByText('Rastreo de la última petición lenta')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Datos' }).closest('section')).toHaveTextContent('Último código HTTP—');
  });

  it('una petición lenta sin sesión, sin parámetros ni empresa lo dice así', async () => {
    const sample = { ...alertDetail.sample!, query: {}, user: { id: 5, role: null }, company_id: null };
    alertServer({ ...alertDetail, sample, error_report_id: null });
    renderAlert();
    const section = (await screen.findByRole('heading', { name: 'Última petición lenta' })).closest('section') as HTMLElement;
    expect(section).toHaveTextContent('ParámetrosSin parámetros');
    expect(section).toHaveTextContent('UsuarioUsuario 5 · Ninguna');
    expect(section).toHaveTextContent('EmpresaNinguna');
    expect(screen.queryByRole('link', { name: 'Ver el error registrado' })).toBeNull();
  });

  it('sin sesión ni query en la muestra', async () => {
    alertServer({ ...alertDetail, sample: { ...alertDetail.sample!, query: null, user: null } });
    renderAlert();
    const section = (await screen.findByRole('heading', { name: 'Última petición lenta' })).closest('section') as HTMLElement;
    expect(section).toHaveTextContent('UsuarioSin sesión');
    expect(section).toHaveTextContent('ParámetrosSin parámetros');
  });

  it('cambiar el seguimiento se confirma (antes → después); cancelar no envía nada; al guardar se actualiza y avisa al contador', async () => {
    const changes: Array<string | undefined> = [];
    const listener = (event: Event) => changes.push((event as CustomEvent<string | undefined>).detail);
    window.addEventListener('tc:slow-alerts-changed', listener);
    const { calls } = alertServer();
    renderAlert();
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar en atención' }));
    let dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('¿Cambiar el seguimiento de GET /api/employees/{employee_id}?');
    expect(dialog).toHaveTextContent('El contador del menú se actualiza al guardar.');
    expect(rowsOf(dialog, 'Cambios')).toEqual(['SeguimientoAntes: AbiertaDespués: En atención']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.filter((call) => call.init.method === 'PATCH')).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Marcar en atención' }));
    dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar en atención' }));
    expect(await screen.findByText('En atención', { selector: '.badge' })).toBeInTheDocument();
    const patch = calls.find((call) => call.init.method === 'PATCH');
    expect(patch?.url).toBe('/api/admin/performance/alerts/7');
    expect(patch?.init.body).toBe(JSON.stringify({ status: 'ACKNOWLEDGED' }));
    expect(changes).toEqual([alertDetail.opened_at]);
    expect(screen.queryByRole('dialog')).toBeNull(); // sin aviso de éxito: el cambio ya se ve
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
    window.removeEventListener('tc:slow-alerts-changed', listener);
  });

  it('resolver explica que se reabre sola; si falla, su popup lo dice y nada cambia', async () => {
    alertServer(alertDetail, () => apiFail(409, 'CONFLICT', 'Otra persona la cambió'));
    renderAlert();
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como resuelta' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Marca la alerta como resuelta solo si ya se corrigió la causa');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Marcar como resuelta' }));
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cambiar el seguimiento' });
    expect(popup).toHaveTextContent('Otra persona la cambió');
    expect(screen.getByText('Abierta', { selector: '.badge' })).toBeInTheDocument();
  });

  it('si no carga: popup y "Volver a cargar"', async () => {
    let tries = 0;
    mockFetch(() => (tries++ === 0 ? apiFail(404, 'SLOW_ALERT_NOT_FOUND', 'No existe la alerta') : apiOk(alertDetail)));
    renderAlert();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar la alerta' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('heading', { name: 'GET /api/employees/{employee_id}' })).toBeInTheDocument();
  });

  it('cambio de idioma en caliente con la confirmación abierta: se traduce sin cerrarse y cancelar no envía nada', async () => {
    const { calls } = alertServer({ ...alertDetail, status: 'RESOLVED' });
    renderAlert();
    await userEvent.click(await screen.findByRole('button', { name: 'Reabrir' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('El contador del menú se actualiza al guardar.');
    await act(() => setLocale('en-US'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Change the follow-up of GET /api/employees/{employee_id}?');
    expect(within(dialog).getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Follow-up' })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(calls.filter((call) => call.init.method === 'PATCH')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Mark as in progress' })).toBeInTheDocument();
  });
});
