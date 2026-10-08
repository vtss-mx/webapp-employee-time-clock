/**
 * Reglas puras de la pantalla «Deriva de señales» (ADMIN): el tono de cada estado, cómo se escribe cada medida y la
 * semana de una fila. Los nombres de las señales vienen del backend; los de plataformas y estados, de los
 * diccionarios (`drift.platforms`, `drift.status`).
 */
import type { StatusTone } from '../types';
import type { CompanyDriftRow, DriftRow, DriftStatus } from '../types/drift';
import { formatNumber, formatRate } from './numbers';

/** Tono de cada estado de una señal (las alertas en rojo; lo que no se puede comparar, apagado). */
export const STATUS_TONE: Record<DriftStatus, StatusTone> = {
  OK: 'success',
  ALERT: 'danger',
  INSUFFICIENT: 'muted',
  NO_BASELINE: 'muted',
  VERSION_CHANGE: 'info',
};

/** Tono de cada estado de una empresa. */
export const COMPANY_TONE: Record<CompanyDriftRow['status'], StatusTone> = {
  OK: 'success',
  ALERT: 'danger',
  INSUFFICIENT: 'muted',
};

/** Una medida de una señal con hasta tres decimales; sin valor, un guion. */
export function measure(value: number | null): string {
  return value === null ? '—' : formatNumber(value, 3);
}

/** El PSI con dos decimales (0.20 es el umbral típico). */
export function psiText(value: number | null): string {
  return value === null ? '—' : formatNumber(value, 2);
}

/** Un cambio relativo (fracción) como porcentaje con signo: +12.5 %, −20 %. */
export function changeText(value: number | null): string {
  if (value === null) return '—';
  const percent = formatRate(Math.abs(value) * 100, 1);
  return value < 0 ? `−${percent}` : value > 0 ? `+${percent}` : percent;
}

/** Una tasa (fracción) como porcentaje; sin valor, un guion. */
export function rateText(value: number | null): string {
  return value === null ? '—' : formatRate(value * 100, 1);
}

/** La cola que vigila una fila: la llave del diccionario según sea el 10 % más bajo o el más alto. */
export function tailKey(row: Pick<DriftRow, 'tail_percentile'>): 'drift.tailLow' | 'drift.tailHigh' {
  return row.tail_percentile === 90 ? 'drift.tailHigh' : 'drift.tailLow';
}
