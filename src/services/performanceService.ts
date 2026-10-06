import type { PageQuery } from '../types';
import type {
  MetricKind,
  MetricPage,
  MetricSeries,
  MetricSort,
  PerformanceOverview,
  PerfPeriod,
  SlowAlertDetail,
  SlowAlertPage,
  SlowAlertStatus,
  SlowAlertSummary,
  StatementPage,
  StatementSort,
  WebVitalsPage,
} from '../types/performance';
import { hasKeys, isPage, isRecord, type Guard } from '../utils/guards';
import { apiRequest } from './apiClient';

const BASE = '/admin/performance';

const isOverview = hasKeys<PerformanceOverview>('period', 'totals', 'points', 'top_routes', 'top_functions', 'open_alerts');
const isRow = hasKeys('kind', 'name', 'count', 'p95_ms', 'share');
const isSeries = hasKeys<MetricSeries>('kind', 'name', 'totals', 'points', 'slow_alert_id');
const isVitals = hasKeys('screen', 'views', 'long_tasks');
const isStatement = hasKeys('query_id', 'query', 'calls', 'total_ms');
const isAlert = hasKeys('id', 'route', 'status', 'count', 'opened_at');
const isDetail = hasKeys<SlowAlertDetail>('id', 'route', 'status', 'sample', 'requests_24h', 'error_report_id');

/** Página con sus campos propios (`kind`, `available`, `as_of`...). */
const pageWith = <T>(itemGuard: Guard<unknown>, ...keys: string[]): Guard<T> => {
  const page = isPage<T>(itemGuard);
  const extra = hasKeys<T>(...keys);
  return (value: unknown): value is T => page(value) && extra(value);
};

/**
 * El resumen alimenta el contador del menú y el aviso en vivo: se exige que `open` sea un número y que la
 * alerta más reciente, si viene, tenga lo que el aviso muestra (una forma inesperada no pinta "NaN").
 */
function isSummary(value: unknown): value is SlowAlertSummary {
  if (!isRecord(value) || typeof value.open !== 'number') return false;
  const { latest } = value;
  return latest === null || (isRecord(latest) && typeof latest.id === 'number' && typeof latest.opened_at === 'string' && typeof latest.route === 'string');
}

export interface MetricQuery extends PageQuery {
  kind: MetricKind;
  period: PerfPeriod;
  sort: MetricSort;
  search?: string;
}

export interface AlertQuery extends PageQuery {
  status?: SlowAlertStatus;
  search?: string;
}

/**
 * Rendimiento de la plataforma (solo el ADMIN, pantalla ADMIN_PERFORMANCE): resumen, métricas de rutas,
 * funciones y la API vista desde el navegador, Web Vitals por pantalla, consultas de la base
 * (pg_stat_statements) y las alertas de peticiones lentas con su seguimiento. Lo que miden los navegadores se
 * envía aparte (`services/perf/telemetry.ts`, de mejor esfuerzo).
 */
export const performanceService = {
  overview(period: PerfPeriod, signal?: AbortSignal): Promise<PerformanceOverview> {
    return apiRequest<PerformanceOverview>(`${BASE}/overview`, { query: { period }, signal, validate: isOverview });
  },

  metrics(query: MetricQuery, signal?: AbortSignal): Promise<MetricPage> {
    return apiRequest<MetricPage>(`${BASE}/metrics`, { query: { ...query }, signal, validate: pageWith<MetricPage>(isRow, 'kind', 'sort') });
  },

  /** Una métrica (ruta, función o API del navegador) en el tiempo, con sus totales. */
  series(kind: MetricKind, name: string, period: PerfPeriod, signal?: AbortSignal): Promise<MetricSeries> {
    return apiRequest<MetricSeries>(`${BASE}/metrics/series`, { query: { kind, name, period }, signal, validate: isSeries });
  },

  /** Web Vitals por pantalla (las pantallas con más muestras primero). */
  webVitals(query: PageQuery & { period: PerfPeriod }, signal?: AbortSignal): Promise<WebVitalsPage> {
    return apiRequest<WebVitalsPage>(`${BASE}/web-vitals`, { query: { ...query }, signal, validate: pageWith<WebVitalsPage>(isVitals, 'period') });
  },

  /** Consultas de la base que más tiempo usan; `available=false` si la base no tiene pg_stat_statements. */
  statements(query: PageQuery & { sort: StatementSort }, signal?: AbortSignal): Promise<StatementPage> {
    return apiRequest<StatementPage>(`${BASE}/statements`, { query: { ...query }, signal, validate: pageWith<StatementPage>(isStatement, 'available') });
  },

  /** Bandeja de alertas de peticiones lentas (lo más reciente primero). */
  alerts(query: AlertQuery, signal?: AbortSignal): Promise<SlowAlertPage> {
    return apiRequest<SlowAlertPage>(`${BASE}/alerts`, { query: { ...query }, signal, validate: pageWith<SlowAlertPage>(isAlert, 'as_of') });
  },

  /** Contador del menú (`open`) y la alerta abierta más reciente (aviso en vivo). */
  alertsSummary(signal?: AbortSignal): Promise<SlowAlertSummary> {
    return apiRequest<SlowAlertSummary>(`${BASE}/alerts/summary`, { signal, validate: isSummary });
  },

  alert(id: number, signal?: AbortSignal): Promise<SlowAlertDetail> {
    return apiRequest<SlowAlertDetail>(`${BASE}/alerts/${id}`, { signal, validate: isDetail });
  },

  /** Cambia el seguimiento de una alerta (la pantalla confirma antes: antes → después). */
  setAlertStatus(id: number, status: SlowAlertStatus): Promise<SlowAlertDetail> {
    return apiRequest<SlowAlertDetail>(`${BASE}/alerts/${id}`, { method: 'PATCH', body: { status }, validate: isDetail });
  },
};
