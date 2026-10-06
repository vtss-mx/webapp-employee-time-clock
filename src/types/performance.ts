// Rendimiento de la plataforma (pantalla "Rendimiento", solo el ADMIN): tiempos de las APIs, de las funciones
// clave, de la base de datos y de las pantallas de la app web, y las alertas de peticiones lentas (regla 18).
// Tiempos en milisegundos (1 decimal), porcentajes de 0 a 100, bytes como number (se muestran en MB).
import type { Page } from './index';

/** Periodo que se consulta (por omisión, 24 h). */
export type PerfPeriod = '1h' | '6h' | '24h' | '7d' | '30d' | '90d';
/** HTTP: rutas del backend; FUNCTION: funciones clave (p. ej. "face.detect"); WEB_API: la API vista desde el navegador. */
export type MetricKind = 'HTTP' | 'FUNCTION' | 'WEB_API';
export type MetricSort = 'impact' | 'p95' | 'mean' | 'max' | 'count' | 'errors';
export type SlowAlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type VitalRating = 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
export type StatementSort = 'total' | 'mean' | 'max' | 'calls';

export interface MetricRow {
  kind: MetricKind;
  /** HTTP/WEB_API: "GET /api/employees/{employee_id}" (método + plantilla); FUNCTION: "face.detect". */
  name: string;
  count: number;
  /** HTTP: 5xx · FUNCTION: excepciones · WEB_API: 5xx + sin red (0) + tiempo agotado (408). */
  errors: number;
  /** 4xx (HTTP y WEB_API); 0 en FUNCTION. */
  client_errors: number;
  error_rate: number;
  avg_ms: number;
  max_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  total_ms: number;
  /** % del tiempo total de ese tipo en el periodo. */
  share: number;
  /** Solo HTTP (null en los demás). */
  avg_db_ms: number | null;
  avg_queries: number | null;
  db_share: number | null;
  /** Solo HTTP (0 en los demás). */
  bytes_in: number;
  bytes_out: number;
}

export interface PerfTotals {
  requests: number;
  client_errors: number;
  server_errors: number;
  /** % de 5xx. */
  error_rate: number;
  /** % de 4xx. */
  client_error_rate: number;
  throughput_per_minute: number;
  avg_ms: number;
  max_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  /** % del tiempo de las peticiones dentro de la BD. */
  db_share: number;
  avg_db_ms: number;
  avg_queries: number;
  bytes_in: number;
  bytes_out: number;
}

/** Un punto de la serie (inicio del intervalo). */
export interface PerfPoint {
  at: string;
  requests: number;
  client_errors: number;
  server_errors: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
  db_share: number;
}

export interface PerformanceOverview {
  period: PerfPeriod;
  start: string;
  end: string;
  step_seconds: number;
  /** Umbral de una petición lenta (SLOW_REQUEST_THRESHOLD_MS del backend). */
  slow_threshold_ms: number;
  /** El de las rutas faciales (SLOW_REQUEST_FACE_THRESHOLD_MS: registro, verificación, identificación, reto y asistencia). */
  slow_face_threshold_ms: number;
  open_alerts: number;
  totals: PerfTotals;
  /** En orden, con ceros donde no hubo tráfico (≤ 96 puntos). */
  points: PerfPoint[];
  /** 5 rutas HTTP más lentas (p95). */
  top_routes: MetricRow[];
  /** 5 funciones con más tiempo total. */
  top_functions: MetricRow[];
}

export interface MetricPoint {
  at: string;
  count: number;
  errors: number;
  client_errors: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
}

export interface MetricSeries {
  kind: MetricKind;
  name: string;
  period: PerfPeriod;
  start: string;
  end: string;
  step_seconds: number;
  /** Con count 0 si no hubo datos. */
  totals: MetricRow;
  points: MetricPoint[];
  /** HTTP: la alerta de esa ruta si existe. */
  slow_alert_id: number | null;
}

/** Una métrica del navegador con su p75 y la calificación de Google (umbrales `good`/`poor`). */
export interface Vital {
  count: number;
  p75: number;
  unit: 'ms' | 'score';
  rating: VitalRating;
  good: number;
  poor: number;
}

export interface ScreenVitals {
  /** Plantilla de la pantalla: "/admin/companies/{id}". */
  screen: string;
  views: number;
  lcp: Vital | null;
  inp: Vital | null;
  cls: Vital | null;
  fcp: Vital | null;
  ttfb: Vital | null;
  long_tasks: { count: number; total_ms: number; p95_ms: number; max_ms: number };
}

export interface Statement {
  /** bigint como texto. */
  query_id: string;
  /** Texto normalizado de pg_stat_statements ($1, $2…; nunca parámetros). */
  query: string;
  calls: number;
  total_ms: number;
  mean_ms: number;
  max_ms: number;
  rows: number;
  /** % del tiempo total de la base. */
  share: number;
}

export interface SlowAlert {
  id: number;
  /** "GET /api/employees/{employee_id}". */
  route: string;
  method: string;
  path: string;
  status: SlowAlertStatus;
  /** Peticiones lentas acumuladas. */
  count: number;
  avg_ms: number;
  last_ms: number;
  max_ms: number;
  /** Umbral vigente cuando ocurrió la última. */
  threshold_ms: number;
  first_seen_at: string;
  last_seen_at: string;
  /** Cuándo se abrió (o se reabrió) por última vez. */
  opened_at: string;
  last_trace_id: string | null;
  /** Código HTTP de la última. */
  last_status: number | null;
  reopened: number;
}

/** Contexto de la última petición lenta (sin secretos ni cuerpos). */
export interface SlowAlertSample {
  method: string;
  path: string;
  query: Record<string, string> | null;
  status: number;
  duration_ms: number;
  db_ms: number;
  db_queries: number;
  bytes_in: number;
  bytes_out: number;
  user: { id: number; role: string | null } | null;
  company_id: number | null;
  trace_id: string;
}

export interface SlowAlertDetail extends SlowAlert {
  sample: SlowAlertSample | null;
  status_changed_at: string | null;
  /** Correo de quien cambió el seguimiento. */
  status_changed_by: string | null;
  /** Peticiones de esa ruta en las últimas 24 h y su p95. */
  requests_24h: number;
  p95_ms_24h: number;
  /** Si el traceId de la última tiene un error registrado → /admin/errors/{id}. */
  error_report_id: number | null;
}

/** Resumen de las alertas: contador del menú y la más reciente abierta (o reabierta) para el aviso en vivo. */
export interface SlowAlertSummary {
  open: number;
  acknowledged: number;
  latest: { id: number; route: string; opened_at: string; last_ms: number } | null;
}

export type MetricPage = Page<MetricRow> & { kind: MetricKind; period: PerfPeriod; sort: MetricSort };
export type WebVitalsPage = Page<ScreenVitals> & { period: PerfPeriod };
export type StatementPage = Page<Statement> & { available: boolean; sort: StatementSort };
export type SlowAlertPage = Page<SlowAlert> & { as_of: string };
