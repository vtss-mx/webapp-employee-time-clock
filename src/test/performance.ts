import type { MetricRow, MetricSeries, PerformanceOverview, PerfPoint, ScreenVitals, SlowAlert, SlowAlertDetail, Statement } from '../types/performance';
import { apiOk } from './http';

/** Datos de la pantalla Rendimiento para las pruebas (forma del contrato del backend). */

export const routeRow: MetricRow = {
  kind: 'HTTP',
  name: 'GET /api/employees/{employee_id}',
  count: 1200,
  errors: 3,
  client_errors: 12,
  error_rate: 0.25,
  avg_ms: 120.5,
  max_ms: 2400,
  p50_ms: 80,
  p95_ms: 950,
  p99_ms: 1800,
  total_ms: 144_600,
  share: 42.5,
  avg_db_ms: 30,
  avg_queries: 2.5,
  db_share: 25,
  bytes_in: 1024 * 1024,
  bytes_out: 5 * 1024 * 1024,
};

export const functionRow: MetricRow = {
  ...routeRow,
  kind: 'FUNCTION',
  name: 'face.detect',
  count: 300,
  errors: 0,
  client_errors: 0,
  error_rate: 0,
  total_ms: 90_000,
  avg_db_ms: null,
  avg_queries: null,
  db_share: null,
  bytes_in: 0,
  bytes_out: 0,
};

export const webApiRow: MetricRow = { ...functionRow, kind: 'WEB_API', name: 'POST /api/auth/login', errors: 2, error_rate: 1.5 };

const point = (at: string, requests: number, p95: number): PerfPoint => ({
  at,
  requests,
  client_errors: 1,
  server_errors: 0,
  avg_ms: p95 / 4,
  p50_ms: p95 / 5,
  p95_ms: p95,
  p99_ms: p95 * 2,
  max_ms: p95 * 3,
  db_share: 20,
});

export const overview: PerformanceOverview = {
  period: '24h',
  start: '2026-10-03T18:00:00Z',
  end: '2026-10-04T18:00:00Z',
  step_seconds: 900,
  slow_threshold_ms: 1000,
  slow_face_threshold_ms: 2500,
  open_alerts: 2,
  totals: {
    requests: 4000,
    client_errors: 40,
    server_errors: 4,
    error_rate: 0.1,
    client_error_rate: 1,
    throughput_per_minute: 2.8,
    avg_ms: 150,
    max_ms: 4200,
    p50_ms: 90,
    p95_ms: 800,
    p99_ms: 1500,
    db_share: 35.5,
    avg_db_ms: 40,
    avg_queries: 3.25,
    bytes_in: 2 * 1024 * 1024,
    bytes_out: 10 * 1024 * 1024,
  },
  points: [point('2026-10-04T15:00:00Z', 1500, 700), point('2026-10-04T15:15:00Z', 2500, 900)],
  top_routes: [routeRow],
  top_functions: [functionRow],
};

export const series: MetricSeries = {
  kind: 'HTTP',
  name: routeRow.name,
  period: '24h',
  start: overview.start,
  end: overview.end,
  step_seconds: 900,
  totals: routeRow,
  points: [
    { at: '2026-10-04T15:00:00Z', count: 600, errors: 1, client_errors: 2, avg_ms: 100, p50_ms: 70, p95_ms: 900, p99_ms: 1700, max_ms: 2400 },
    { at: '2026-10-04T15:15:00Z', count: 600, errors: 2, client_errors: 10, avg_ms: 140, p50_ms: 90, p95_ms: 1000, p99_ms: 1900, max_ms: 2000 },
  ],
  slow_alert_id: 7,
};

export const vitals: ScreenVitals = {
  screen: '/admin/companies/{id}',
  views: 40,
  lcp: { count: 40, p75: 2100, unit: 'ms', rating: 'GOOD', good: 2500, poor: 4000 },
  inp: { count: 30, p75: 350, unit: 'ms', rating: 'NEEDS_IMPROVEMENT', good: 200, poor: 500 },
  cls: { count: 40, p75: 0.31, unit: 'score', rating: 'POOR', good: 0.1, poor: 0.25 },
  fcp: null,
  ttfb: { count: 12, p75: 300, unit: 'ms', rating: 'GOOD', good: 800, poor: 1800 },
  long_tasks: { count: 5, total_ms: 600, p95_ms: 180, max_ms: 220 },
};

export const statement: Statement = {
  query_id: '-912345678901',
  query: 'SELECT * FROM core.employees WHERE company_id = $1 ORDER BY id LIMIT $2',
  calls: 9000,
  total_ms: 45_000,
  mean_ms: 5,
  max_ms: 320,
  rows: 90_000,
  share: 61.2,
};

export const slowAlert: SlowAlert = {
  id: 7,
  route: 'GET /api/employees/{employee_id}',
  method: 'GET',
  path: '/api/employees/{employee_id}',
  status: 'OPEN',
  count: 14,
  avg_ms: 1450,
  last_ms: 1800,
  max_ms: 3200,
  threshold_ms: 1000,
  first_seen_at: '2026-10-03T10:00:00Z',
  last_seen_at: '2026-10-04T17:00:00Z',
  opened_at: '2026-10-04T16:00:00Z',
  last_trace_id: 'trace-slow-1',
  last_status: 200,
  reopened: 1,
};

export const alertDetail: SlowAlertDetail = {
  ...slowAlert,
  sample: {
    method: 'GET',
    path: '/api/employees/{employee_id}',
    query: { page: '2', size: '50' },
    status: 200,
    duration_ms: 1800,
    db_ms: 1200,
    db_queries: 14,
    bytes_in: 0,
    bytes_out: 2 * 1024 * 1024,
    user: { id: 5, role: 'COMPANY' },
    company_id: 3,
    trace_id: 'trace-slow-1',
  },
  status_changed_at: null,
  status_changed_by: null,
  requests_24h: 320,
  p95_ms_24h: 1100,
  error_report_id: 9,
};

/** Página del contrato con los campos propios de cada listado. */
export const perfPage = <T>(items: T[], extra: Record<string, unknown> = {}) => apiOk({ items, total: items.length, page: 1, size: 10, ...extra });
