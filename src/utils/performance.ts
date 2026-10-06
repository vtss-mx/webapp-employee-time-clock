import { t } from '../i18n/core';
import { paths } from '../routes/paths';
import type { MetricKind, PerfPeriod, Vital, VitalRating } from '../types/performance';
import { businessTimeZone, localeDateFormat, timeStyle } from './format';
import { formatDuration, formatNumber } from './numbers';

/**
 * Reglas puras de la pantalla Rendimiento (ADMIN): periodos, etiquetas del eje de tiempo, enlaces a una métrica y
 * cómo se leen las Web Vitals. Los números los calcula el backend (percentiles, tasas, calificaciones); aquí solo
 * se muestran.
 */

export const PERIODS: readonly PerfPeriod[] = ['1h', '6h', '24h', '7d', '30d', '90d'];
export const DEFAULT_PERIOD: PerfPeriod = '24h';
export const METRIC_KINDS: readonly MetricKind[] = ['HTTP', 'FUNCTION', 'WEB_API'];

/** Llave de cada periodo en los diccionarios (las llaves van en camelCase: "1h" no sirve). */
export const PERIOD_KEYS: Record<PerfPeriod, 'h1' | 'h6' | 'h24' | 'd7' | 'd30' | 'd90'> = { '1h': 'h1', '6h': 'h6', '24h': 'h24', '7d': 'd7', '30d': 'd30', '90d': 'd90' };

/** El periodo de la URL; uno desconocido es el de por omisión (24 h). */
export const periodFrom = (value: string | null): PerfPeriod => PERIODS.find((period) => period === value) ?? DEFAULT_PERIOD;

/** El tipo de métrica de la URL; uno desconocido es null (no se consulta nada). */
export const kindFrom = (value: string | null): MetricKind | null => METRIC_KINDS.find((kind) => kind === value) ?? null;

/** Periodos de horas: el eje muestra la hora; 7 días, el día y la hora; más, solo el día. */
const HOURS: ReadonlySet<PerfPeriod> = new Set(['1h', '6h', '24h']);

/** Etiqueta de un punto de la serie (inicio de su intervalo) en la zona del negocio y el idioma activo. */
export function pointLabel(at: string, period: PerfPeriod): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  const day: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const options = HOURS.has(period) ? timeStyle() : period === '7d' ? { ...day, ...timeStyle() } : day;
  return localeDateFormat({ ...options, timeZone: businessTimeZone() }).format(date);
}

/** Enlace al detalle de una métrica (ruta, función o API del navegador) en un periodo. */
export function metricLink(kind: MetricKind, name: string, period: PerfPeriod): string {
  return `${paths.admin.performanceMetric}?${new URLSearchParams({ kind, name, period }).toString()}`;
}

/** Enlace a una pestaña de la pantalla (no el resumen) en un periodo (el de por omisión no se escribe en la URL). */
export function tabLink(tab: string, period: PerfPeriod): string {
  const query = new URLSearchParams({ tab });
  if (period !== DEFAULT_PERIOD) query.set('period', period);
  return `${paths.admin.performance}?${query.toString()}`;
}

/** Pestaña de la pantalla donde se lista cada tipo de métrica (la API del navegador va en "Navegador"). */
export const KIND_TABS: Record<MetricKind, string> = { HTTP: 'routes', FUNCTION: 'functions', WEB_API: 'browser' };

/** Clase del tono de cada calificación de Google (sin el punto que late: no es un estado en espera). */
export const RATING_CLASS: Record<VitalRating, string> = {
  GOOD: 'badge--success',
  NEEDS_IMPROVEMENT: 'badge--warning',
  POOR: 'badge--danger',
};

/** Valor de una Web Vital: milisegundos legibles o el puntaje sin unidad (CLS, con 3 decimales). */
export function vitalValue(value: number, unit: Vital['unit']): string {
  return unit === 'ms' ? formatDuration(value) : formatNumber(value, 3);
}

/** Umbrales de Google de una métrica: "Bueno ≤ 2.5 s · Deficiente > 4 s". */
export function vitalThresholds(vital: Vital): string {
  return t('performance.vitals.thresholds', { good: vitalValue(vital.good, vital.unit), poor: vitalValue(vital.poor, vital.unit) });
}

/** Peticiones por minuto con un decimal ("12.5/min"). */
export function perMinute(value: number): string {
  return t('performance.perMinute', { value: formatNumber(value, 1) });
}
