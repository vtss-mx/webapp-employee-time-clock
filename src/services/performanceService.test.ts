import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiOk, mockFetch } from '../test/http';
import { alertDetail, overview, routeRow, series, slowAlert, statement, vitals } from '../test/performance';
import { config } from '../utils/config';
import { performanceService } from './performanceService';

// Una forma inválida es un 502 que las lecturas reintentan: aquí sin reintentos (no importa la espera).
const retries = config as { apiGetRetries: number };
const defaultRetries = retries.apiGetRetries;
beforeEach(() => {
  retries.apiGetRetries = 0;
});
afterEach(() => {
  retries.apiGetRetries = defaultRetries;
});

const page = (items: unknown[], extra: Record<string, unknown>) => ({ items, total: items.length, page: 1, size: 10, ...extra });
const invalid = { code: 'INVALID_RESPONSE' };

describe('performanceService', () => {
  it('cada consulta va a su ruta con sus parámetros y entrega `data` con la forma del contrato', async () => {
    const { calls } = mockFetch((call) => {
      const url = call.url;
      if (url.includes('/overview')) return apiOk(overview);
      if (url.includes('/metrics/series')) return apiOk(series);
      if (url.includes('/metrics')) return apiOk(page([routeRow], { kind: 'HTTP', period: '24h', sort: 'p95' }));
      if (url.includes('/web-vitals')) return apiOk(page([vitals], { period: '7d' }));
      if (url.includes('/statements')) return apiOk(page([statement], { available: true, sort: 'total' }));
      if (url.includes('/alerts/summary')) return apiOk({ open: 2, acknowledged: 1, latest: { id: 7, route: slowAlert.route, opened_at: slowAlert.opened_at, last_ms: 1800 } });
      if (url.endsWith('/alerts/7')) return apiOk(alertDetail);
      return apiOk(page([slowAlert], { as_of: '2026-10-04T18:00:00Z' }));
    });
    expect((await performanceService.overview('6h')).totals.requests).toBe(4000);
    expect((await performanceService.metrics({ kind: 'HTTP', period: '24h', sort: 'p95', search: 'emp', page: 2, size: 20 })).items).toEqual([routeRow]);
    expect((await performanceService.series('HTTP', routeRow.name, '24h')).slow_alert_id).toBe(7);
    expect((await performanceService.webVitals({ period: '7d', page: 1, size: 10 })).items).toEqual([vitals]);
    expect((await performanceService.statements({ sort: 'mean', page: 1, size: 10 })).available).toBe(true);
    expect((await performanceService.alerts({ status: 'OPEN', search: 'emp', page: 1, size: 10 })).as_of).toBe('2026-10-04T18:00:00Z');
    expect((await performanceService.alertsSummary()).open).toBe(2);
    expect((await performanceService.alert(7)).error_report_id).toBe(9);
    expect((await performanceService.setAlertStatus(7, 'RESOLVED')).id).toBe(7);
    expect(calls.map((call) => [call.init.method ?? 'GET', call.url])).toEqual([
      ['GET', '/api/admin/performance/overview?period=6h'],
      ['GET', '/api/admin/performance/metrics?kind=HTTP&period=24h&sort=p95&search=emp&page=2&size=20'],
      ['GET', `/api/admin/performance/metrics/series?kind=HTTP&name=${encodeURIComponent(routeRow.name).replace(/%20/g, '+')}&period=24h`],
      ['GET', '/api/admin/performance/web-vitals?period=7d&page=1&size=10'],
      ['GET', '/api/admin/performance/statements?sort=mean&page=1&size=10'],
      ['GET', '/api/admin/performance/alerts?status=OPEN&search=emp&page=1&size=10'],
      ['GET', '/api/admin/performance/alerts/summary'],
      ['GET', '/api/admin/performance/alerts/7'],
      ['PATCH', '/api/admin/performance/alerts/7'],
    ]);
    expect(calls.at(-1)?.init.body).toBe(JSON.stringify({ status: 'RESOLVED' }));
  });

  it('una forma inesperada de `data` es INVALID_RESPONSE (no se dibuja nada roto)', async () => {
    mockFetch(apiOk({ items: [{ name: 'x' }], total: 1 }));
    await expect(performanceService.overview('24h')).rejects.toMatchObject(invalid);
    await expect(performanceService.metrics({ kind: 'HTTP', period: '24h', sort: 'impact', page: 1, size: 10 })).rejects.toMatchObject(invalid);
    await expect(performanceService.series('HTTP', 'x', '24h')).rejects.toMatchObject(invalid);
    await expect(performanceService.webVitals({ period: '24h', page: 1, size: 10 })).rejects.toMatchObject(invalid);
    await expect(performanceService.statements({ sort: 'total', page: 1, size: 10 })).rejects.toMatchObject(invalid);
    await expect(performanceService.alerts({ page: 1, size: 10 })).rejects.toMatchObject(invalid);
    await expect(performanceService.alert(1)).rejects.toMatchObject(invalid);
  });

  it('una página sin sus campos propios (kind, available, as_of...) también es inválida', async () => {
    mockFetch((call) => apiOk(page(call.url.includes('/statements') ? [statement] : [routeRow], {})));
    await expect(performanceService.metrics({ kind: 'HTTP', period: '24h', sort: 'impact', page: 1, size: 10 })).rejects.toMatchObject(invalid);
    await expect(performanceService.statements({ sort: 'total', page: 1, size: 10 })).rejects.toMatchObject(invalid);
  });

  it('el resumen exige un número de abiertas y una alerta reciente con lo que muestra el aviso', async () => {
    const answers = [
      null,
      { open: '2', latest: null },
      { open: 1, latest: 'x' },
      { open: 1, latest: { id: '7', route: 'GET /x', opened_at: 'hoy' } },
      { open: 1, latest: { id: 7, route: 'GET /x', opened_at: 5 } },
      { open: 1, latest: { id: 7, route: null, opened_at: 'hoy' } },
    ];
    mockFetch(...answers.map((answer) => apiOk(answer)));
    for (let i = 0; i < answers.length; i++) await expect(performanceService.alertsSummary()).rejects.toMatchObject(invalid);
  });
});
