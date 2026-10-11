import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { pick, renderPage, settle } from '../../../test/companyPages';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { functionRow, overview, perfPage, routeRow, slowAlert, statement, vitals, webApiRow } from '../../../test/performance';
import type { Continuity } from '../../../types/continuity';
import type { MetricRow } from '../../../types/performance';
import { PerformancePage } from './PerformancePage';

// La actualización periódica se prueba en su hook; aquí se ejecuta a mano lo que cada parte le pasa.
const refreshers = vi.hoisted(() => [] as Array<() => void>);
vi.mock('../../../hooks/useAutoRefresh', () => ({ useAutoRefresh: (refresh: () => void) => refreshers.push(refresh) }));

type Responder = (call: MockCall) => Response;
const urls = (calls: MockCall[], part: string) => calls.filter((c) => c.url.includes(part)).map((c) => c.url);
const ROWS: Record<string, MetricRow> = { HTTP: routeRow, FUNCTION: functionRow, WEB_API: webApiRow };

/** Backend simulado: cada ruta responde lo del contrato salvo lo que la prueba reemplace. */
function server(overrides: Partial<Record<'overview' | 'metrics' | 'vitals' | 'statements' | 'alerts' | 'continuity', Responder>> = {}) {
  return mockFetch((call) => {
    const url = new URL(call.url, 'http://localhost');
    if (url.pathname.startsWith('/api/admin/continuity')) return overrides.continuity?.(call) ?? apiOk(continuity);
    const route = url.pathname.replace('/api/admin/performance/', '');
    if (route === 'overview') return overrides.overview?.(call) ?? apiOk({ ...overview, period: url.searchParams.get('period') });
    if (route === 'metrics') {
      const kind = String(url.searchParams.get('kind'));
      return overrides.metrics?.(call) ?? perfPage([ROWS[kind]], { kind, period: '24h', sort: 'impact' });
    }
    if (route === 'web-vitals') return overrides.vitals?.(call) ?? perfPage([vitals], { period: '24h' });
    if (route === 'statements') return overrides.statements?.(call) ?? perfPage([statement], { available: true, sort: 'total' });
    return overrides.alerts?.(call) ?? perfPage([slowAlert], { as_of: '2026-10-04T18:00:00Z' });
  });
}

/** Continuidad del servicio: lo mínimo que la pestaña dibuja (su detalle se prueba en `continuityTab.test.tsx`). */
const continuity: Continuity = {
  rto_minutes: 30,
  rpo_seconds: 60,
  drill_interval_days: 90,
  backup_upload_enabled: true,
  pitr_enabled: true,
  backup_interval_hours: 24,
  backup_retention_days: 30,
  pitr_archive_timeout_seconds: 60,
  pitr_retention_days: 14,
  drills: [],
  overdue_count: 0,
};

const TARGETS = { '/admin/performance/metric': 'Detalle de la métrica', '/admin/performance/alerts/:id': 'Detalle de la alerta' };
const renderPerformance = (route = '/admin/performance') => renderPage('/admin/performance', route, <PerformancePage />, { targets: TARGETS });
const tab = (name: RegExp | string) => userEvent.click(screen.getByRole('tab', { name }));
const rowOf = async (text: string) => (await screen.findByText(text, { selector: 'code' })).closest('tr') as HTMLElement;

describe('Rendimiento: resumen', () => {
  it('indicadores, peticiones y tiempos por intervalo, rutas más lentas y funciones con más tiempo (con su detalle)', async () => {
    const { calls } = server();
    renderPerformance();
    expect(await screen.findByText('Últimas 24 horas · petición lenta: más de 1 s (rostro: más de 2.5 s)')).toBeInTheDocument();
    expect(urls(calls, '/overview')).toEqual(['/api/admin/performance/overview?period=24h']);
    expect([...document.querySelectorAll('.kpi__label')].map((label) => label.textContent)).toEqual([
      'Peticiones por minuto',
      'Peticiones',
      'Fallas del servidor (5xx)',
      'Rechazos (4xx)',
      'Tiempo típico (p50)',
      'Tiempo p95',
      'Tiempo p99',
      'Tiempo en la base de datos',
      'Consultas por petición',
      'Datos de entrada',
      'Datos de salida',
      'Alertas abiertas',
    ]);
    await waitFor(() => expect(document.querySelectorAll('.kpi__value')[0]).toHaveTextContent('2.8/min'));
    await waitFor(() => expect(document.querySelectorAll('.kpi__value')[10]).toHaveTextContent('10.00 MB'));
    expect(screen.getByText('4 peticiones')).toBeInTheDocument();
    expect(screen.getByText('Máximo 4.2 s')).toBeInTheDocument();
    expect(screen.getByText('Promedio 40 ms por petición')).toBeInTheDocument();
    expect(screen.getByText('Rutas con peticiones de más de 1 s (rostro: 2.5 s)')).toBeInTheDocument();
    expect(document.querySelectorAll('.icon-tile')[2]).toHaveClass('icon-tile--danger');
    expect(document.querySelectorAll('.icon-tile')[11]).toHaveClass('icon-tile--danger');
    expect(screen.getByRole('img', { name: /^Peticiones por intervalo\. 2 intervalos\. Total Peticiones por intervalo: 4,000/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Tiempo de respuesta \(p50, p95 y p99\)\. 2 intervalos\. Al final: p50: 180 ms; p95: 900 ms; p99: 1\.8 s/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Alertas, 2 abiertas' })).toBeInTheDocument();

    const routes = screen.getByRole('list', { name: 'Rutas más lentas (p95)' });
    expect(routes).toHaveTextContent('GET /api/employees/{employee_id}950 ms1,200 llamadas');
    expect(within(routes).getByRole('link')).toHaveAttribute('href', '/admin/performance/metric?kind=HTTP&name=GET+%2Fapi%2Femployees%2F%7Bemployee_id%7D&period=24h');
    expect(screen.getByRole('list', { name: 'Funciones con más tiempo' })).toHaveTextContent('face.detect1.5 min300 llamadas · p95 950 ms');
    expect(screen.getAllByRole('link', { name: 'Ver todas' }).map((link) => link.getAttribute('href'))).toEqual(['/admin/performance?tab=routes', '/admin/performance?tab=functions']);

    await settle(() => refreshers.forEach((refresh) => refresh()));
    await waitFor(() => expect(urls(calls, '/overview')).toHaveLength(2));
    await userEvent.click(within(routes).getByRole('link'));
    expect(await screen.findByText('Detalle de la métrica')).toBeInTheDocument();
  });

  it('el periodo vive en la URL: 7 días pide de nuevo y nombra los intervalos con día y hora; sin tráfico, los vacíos lo dicen', async () => {
    const quiet = { ...overview, open_alerts: 0, totals: { ...overview.totals, server_errors: 0 }, top_routes: [], top_functions: [] };
    const { calls } = server({ overview: () => apiOk(quiet) });
    renderPerformance('/admin/performance?period=90d');
    expect(await screen.findByText('Últimos 90 días · petición lenta: más de 1 s (rostro: más de 2.5 s)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Sin peticiones')).toBeInTheDocument();
    expect(screen.getByText('Sin funciones medidas')).toBeInTheDocument();
    expect(document.querySelectorAll('.icon-tile')[2]).toHaveClass('icon-tile--success');
    expect(screen.getByRole('tab', { name: 'Alertas' })).toBeInTheDocument();
    expect(screen.getAllByText('4 oct').length).toBeGreaterThan(0); // 90 días: solo el día (zona del Centro)

    await userEvent.click(screen.getByRole('button', { name: '7 días' }));
    await waitFor(() => expect(urls(calls, '/overview').at(-1)).toBe('/api/admin/performance/overview?period=7d'));
    expect(await screen.findByText('Últimos 7 días · petición lenta: más de 1 s (rostro: más de 2.5 s)')).toBeInTheDocument();
    expect(screen.getAllByText('4 oct, 09:00').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Ver todas' })[0]).toHaveAttribute('href', '/admin/performance?tab=routes&period=7d');
    await userEvent.click(screen.getByRole('button', { name: '1 h' }));
    expect(await screen.findByText('Última hora · petición lenta: más de 1 s (rostro: más de 2.5 s)')).toBeInTheDocument();
    expect(screen.getAllByText('09:15').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: '24 h' }));
    await waitFor(() => expect(urls(calls, '/overview').at(-1)).toBe('/api/admin/performance/overview?period=24h'));
  });

  it('si el resumen no carga: popup con su título y "Volver a cargar" en la pestaña', async () => {
    let tries = 0;
    server({ overview: () => (tries++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló') : apiOk(overview)) });
    renderPerformance();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el rendimiento' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Últimas 24 horas · petición lenta: más de 1 s (rostro: más de 2.5 s)')).toBeInTheDocument();
  });
});

describe('Rendimiento: rutas, funciones y navegador', () => {
  it('rutas del servidor: tiempos, fallas, base de datos y datos en MB; orden, búsqueda, páginas y cada fila abre su detalle', async () => {
    const { calls } = server({
      metrics: (call) => apiOk({ items: [routeRow], total: 25, page: call.url.includes('page=2') ? 2 : 1, size: 10, kind: 'HTTP', period: '24h', sort: 'impact' }),
    });
    renderPerformance('/admin/performance?tab=routes');
    const row = await rowOf(routeRow.name);
    expect(urls(calls, '/metrics')[0]).toBe('/api/admin/performance/metrics?kind=HTTP&period=24h&sort=impact&page=1&size=10');
    expect(screen.getByText(/Cada ruta de la API medida en el servidor/)).toBeInTheDocument();
    expect(row).toHaveTextContent('42.5 % del tiempo');
    expect(row).toHaveTextContent('1,200');
    expect(row).toHaveTextContent('950 msp50 80 ms · p99 1.8 s');
    expect(row).toHaveTextContent('120.5 msmáx. 2.4 s');
    expect(row).toHaveTextContent('3 · 0.3 %12 rechazos (4xx)');
    expect(row).toHaveTextContent('25 %2.5 consultas en promedio');
    expect(row).toHaveTextContent('1.00 MB / 5.00 MB');
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Nombre', 'Llamadas', 'p95', 'Promedio', 'Fallas', 'Base de datos', 'Entrada / salida']);

    await userEvent.click(screen.getByRole('button', { name: /Página siguiente|Siguiente/ }));
    await waitFor(() => expect(urls(calls, '/metrics').at(-1)).toContain('page=2'));
    await pick(/Ordenar por/, /Más lentas \(p95\)/);
    await waitFor(() => expect(urls(calls, '/metrics').at(-1)).toContain('sort=p95&page=1'));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar métricas' }), 'emp');
    await waitFor(() => expect(urls(calls, '/metrics').at(-1)).toContain('search=emp'));
    await settle(() => refreshers.forEach((refresh) => refresh()));
    await userEvent.click(await rowOf(routeRow.name));
    expect(await screen.findByText('Detalle de la métrica')).toBeInTheDocument();
  });

  it('funciones: sin columnas de base de datos ni datos; sin resultados y sin coincidencias se explican; una falla abre su popup', async () => {
    let answer: 'rows' | 'empty' | 'fail' = 'rows';
    server({
      metrics: () => (answer === 'fail' ? apiFail(500, 'INTERNAL_ERROR') : perfPage(answer === 'rows' ? [functionRow] : [], { kind: 'FUNCTION', period: '24h', sort: 'impact' })),
    });
    renderPerformance();
    await tab('Funciones');
    const row = await rowOf('face.detect');
    expect(row).toHaveTextContent('0 · 0 %');
    expect(row).not.toHaveTextContent('rechazo');
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
    answer = 'empty';
    await settle(() => refreshers.at(-1)?.());
    expect(await screen.findByText('Sin datos')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar métricas' }), 'zz');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    answer = 'fail';
    await settle(() => refreshers.at(-1)?.());
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar las métricas' })).toBeInTheDocument();
  });

  it('navegador: Web Vitals por pantalla con su p75, calificación y umbrales; tareas largas; y las APIs vistas desde el navegador', async () => {
    const quietScreen = { ...vitals, screen: '/login', views: 1, lcp: null, inp: null, cls: null, ttfb: null, long_tasks: { count: 0, total_ms: 0, p95_ms: 0, max_ms: 0 } };
    const { calls } = server({ vitals: () => perfPage([vitals, quietScreen], { period: '24h' }) });
    renderPerformance('/admin/performance?tab=browser&period=6h');
    const row = await rowOf('/admin/companies/{id}');
    expect(urls(calls, '/web-vitals')[0]).toBe('/api/admin/performance/web-vitals?page=1&size=10&period=6h');
    expect(urls(calls, '/metrics')[0]).toContain('kind=WEB_API&period=6h');
    expect(row).toHaveTextContent('40 muestras');
    const [lcp, inp, cls, fcp] = within(row).getAllByRole('cell').slice(1);
    expect(within(lcp).getByText('2.1 s')).toHaveClass('badge--success');
    expect(lcp).toHaveTextContent('Buena · 40 muestras');
    expect(lcp.firstElementChild).toHaveAttribute('title', 'Buena hasta 2.5 s; deficiente con más de 4 s');
    expect(within(inp).getByText('350 ms')).toHaveClass('badge--warning');
    expect(inp).toHaveTextContent('Mejorable · 30 muestras');
    expect(within(cls).getByText('0.31')).toHaveClass('badge--danger');
    expect(cls.firstElementChild).toHaveAttribute('title', 'Buena hasta 0.1; deficiente con más de 0.25');
    expect(fcp).toHaveTextContent('Sin datos');
    expect(row).toHaveTextContent('5 tareasp95 180 ms · máx. 220 ms');
    expect((await rowOf('/login')).textContent).toContain('0 tareas');
    expect(await rowOf(webApiRow.name)).toHaveTextContent('2 · 1.5 %');
    expect(screen.getByText(/red incluida/)).toBeInTheDocument();
  });

  it('navegador sin mediciones todavía: lo dice', async () => {
    server({ vitals: () => perfPage([], { period: '24h' }) });
    renderPerformance('/admin/performance?tab=browser');
    expect(await screen.findByText('Sin mediciones')).toBeInTheDocument();
  });
});

describe('Rendimiento: consultas de la base y alertas', () => {
  it('SQL: las consultas normalizadas con su tiempo y su parte; el orden se cambia', async () => {
    const { calls } = server();
    renderPerformance('/admin/performance?tab=sql');
    const row = await rowOf(statement.query);
    expect(row).toHaveTextContent('9,000');
    expect(row).toHaveTextContent('45 s61.2 % del tiempo de la base');
    expect(row).toHaveTextContent('90,000');
    expect(urls(calls, '/statements')[0]).toBe('/api/admin/performance/statements?page=1&size=10&sort=total');
    await pick(/Ordenar por/, /Mayor promedio/);
    await waitFor(() => expect(urls(calls, '/statements').at(-1)).toContain('sort=mean'));
  });

  it('SQL: sin pg_stat_statements lo explica (y no deja ordenar); con la extensión pero sin datos, lo dice', async () => {
    let available = false;
    server({ statements: () => perfPage([], { available, sort: 'total' }) });
    renderPerformance('/admin/performance?tab=sql');
    expect(await screen.findByText('Estadísticas de consultas no disponibles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ordenar por/ })).toBeDisabled();
    available = true;
    await settle(() => refreshers.at(-1)?.());
    expect(await screen.findByText('Sin consultas registradas')).toBeInTheDocument();
  });

  it('alertas: ruta, seguimiento del catálogo, cuántas, tiempos y cuándo; filtro y búsqueda; cada fila abre la alerta', async () => {
    const quiet = { ...slowAlert, id: 8, route: 'POST /api/auth/login', last_status: null, reopened: 0, status: 'RESOLVED' as const };
    const { calls } = server({ alerts: (call) => perfPage(call.url.includes('search=zz') ? [] : [slowAlert, quiet], { as_of: '2026-10-04T18:00:00Z' }) });
    renderPerformance('/admin/performance?tab=alerts');
    const row = await rowOf(slowAlert.route);
    expect(urls(calls, '/alerts')[0]).toBe('/api/admin/performance/alerts?page=1&size=10');
    expect(row).toHaveTextContent('Respondió 200');
    expect(within(row).getByText('Abierta')).toHaveClass('badge--danger');
    expect(row).toHaveTextContent('14reabierta 1 vez');
    expect(row).toHaveTextContent('1.8 spromedio 1.5 s · máx. 3.2 s');
    expect(row).toHaveTextContent('1 s');
    const other = await rowOf('POST /api/auth/login');
    expect(other).not.toHaveTextContent('Respondió');
    expect(other).not.toHaveTextContent('reabierta');
    expect(within(other).getByText('Resuelta')).toHaveClass('badge--success');

    await pick(/Seguimiento/, /En atención/);
    await waitFor(() => expect(urls(calls, '/alerts').at(-1)).toContain('status=ACKNOWLEDGED'));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar alertas' }), 'zz');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar alertas' }));
    await pick(/Seguimiento/, /Cualquier seguimiento/);
    await userEvent.click(await rowOf(slowAlert.route));
    expect(await screen.findByText('Detalle de la alerta')).toBeInTheDocument();
  });

  it('alertas: sin ninguna, es buena noticia', async () => {
    server({ alerts: () => perfPage([], { as_of: '2026-10-04T18:00:00Z' }) });
    renderPerformance('/admin/performance?tab=alerts');
    expect(await screen.findByText('Sin peticiones lentas')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('empty-state--success');
  });
});

describe('Rendimiento: fallas de cada lista', () => {
  it.each([
    ['browser', 'vitals', 'No se pudieron cargar las mediciones de las pantallas'],
    ['sql', 'statements', 'No se pudieron cargar las consultas de la base de datos'],
    ['alerts', 'alerts', 'No se pudieron cargar las alertas'],
  ] as const)('pestaña %s: si su lista no carga, su popup lo dice', async (name, part, title) => {
    server({ [part]: () => apiFail(500, 'INTERNAL_ERROR') });
    renderPerformance(`/admin/performance?tab=${name}`);
    expect(await screen.findByRole('alertdialog', { name: title })).toBeInTheDocument();
  });
});

describe('Rendimiento en inglés (en-US)', () => {
  it('pestañas, periodo, indicadores y listas en inglés', async () => {
    await setLocale('en-US');
    server();
    renderPerformance('/admin/performance?tab=alerts');
    expect(await screen.findByText('Last 24 hours · slow request: over 1 s (face: over 2.5 s)')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((item) => item.textContent?.trim())).toEqual(['Overview', 'Routes', 'Functions', 'Browser', 'SQL', 'Alerts2', 'Continuity']);
    expect(screen.getByRole('group', { name: 'Period' })).toHaveTextContent('1 h6 h24 h7 days30 days90 days');
    expect(await rowOf(slowAlert.route)).toHaveTextContent('Responded 200');
    await tab(/Overview/);
    expect(await screen.findByText('Requests per minute')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Slowest routes (p95)' })).toHaveTextContent('1,200 calls');
  });
});

describe('Rendimiento: continuidad del servicio', () => {
  it('la pestaña «Continuidad» pide el informe y lo dibuja con sus plazos', async () => {
    const { calls } = server();
    renderPerformance('/admin/performance?tab=continuity');
    expect(await screen.findByRole('tab', { name: /Continuidad/ })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(calls.some((call) => call.url.startsWith('/api/admin/continuity'))).toBe(true));
    expect(await screen.findByText('30 min')).toBeInTheDocument();
  });

  it('si el informe de continuidad falla, el popup lo dice con su título', async () => {
    server({ continuity: () => apiFail(503, 'SERVICE_UNAVAILABLE') });
    renderPerformance('/admin/performance?tab=continuity');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar la continuidad' })).toBeInTheDocument();
  });
});
