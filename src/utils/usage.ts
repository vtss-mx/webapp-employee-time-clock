import { parseIso, toIso } from '../components/ui/DateField';
import { t } from '../i18n/core';
import { quickRanges, type QuickRange } from './dateRanges';
import { businessDate, localeDateFormat } from './format';

/**
 * Reglas puras del consumo: el rango de días que se consulta (rangos de un clic, validación y
 * cuántos días abarca) y la etiqueta corta de cada día de las gráficas.
 */

export interface DayRange {
  start: string;
  end: string;
}

/** Máximo que acepta el backend (422 RANGE_TOO_LONG). */
export const MAX_RANGE_DAYS = 366;

const PRESET_KEYS = ['today', 'month', 'last-month'];

/**
 * Rangos de un clic del consumo: hoy, este mes (el del backend por omisión) y el mes pasado. Sin
 * repetir un rango: el día 1, "Este mes" es lo mismo que "Hoy" y se ofrece una sola vez.
 */
export function usagePresets(today?: Date): QuickRange[] {
  const ranges = quickRanges(today).filter((range) => PRESET_KEYS.includes(range.key));
  return ranges.filter((range, index) => ranges.findIndex((other) => other.start === range.start && other.end === range.end) === index);
}

/** "Este mes" (del día 1 a hoy, en la zona del negocio): el rango por omisión, el mismo del backend. */
export function defaultRange(today: Date = businessDate()): DayRange {
  return { start: toIso(new Date(today.getFullYear(), today.getMonth(), 1)), end: toIso(today) };
}

const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;

/** Días que abarca el rango, contando ambos extremos. */
export const rangeDays = ({ start, end }: DayRange) => dayNumber(end) - dayNumber(start) + 1;

/** Qué impide consultar el rango (fecha inválida, al revés o de más de 366 días); vacío si está bien. */
export function rangeErrors(range: DayRange): Partial<Record<keyof DayRange, string>> {
  const invalid = t('usage.range.invalidDate');
  if (!parseIso(range.start) || !parseIso(range.end)) {
    return { start: parseIso(range.start) ? undefined : invalid, end: parseIso(range.end) ? undefined : invalid };
  }
  if (range.start > range.end) return { end: t('usage.range.endBeforeStart') };
  return rangeDays(range) > MAX_RANGE_DAYS ? { end: t('usage.range.tooLong', { days: MAX_RANGE_DAYS }) } : {};
}

/** "4 oct" / "Oct 4": etiqueta corta de un día en el idioma activo (fecha de calendario, no cambia con la zona). */
export function dayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : localeDateFormat({ day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date).replace('.', '');
}
