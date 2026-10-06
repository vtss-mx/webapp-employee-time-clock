import { t } from '../i18n/core';
import type { ShiftRef, Weekday } from '../types';
import { localeDateFormat, timeStyle } from './format';
import { formatList } from './numbers';

/**
 * Reglas de presentación de los turnos (puras). Los días viajan como números (0 = lunes ... 6 =
 * domingo) y las horas del turno como "HH:MM:SS" de la hora del negocio; el backend decide todo lo
 * demás (si un turno es nocturno, qué se puede registrar y cuándo). Los nombres de los días y el
 * formato de la hora son los del idioma activo (`Intl`): se calculan en cada uso, así siguen al idioma.
 */

const DAY_MS = 86_400_000;
/** El 1 de enero de 2024 fue lunes: la referencia para nombrar cada día (0 = lunes). */
const MONDAY = Date.UTC(2024, 0, 1);

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** Nombre de un día en el idioma activo: "lun"/"lunes" (es-MX) o "Mon"/"Monday" (en-US). */
export function weekdayName(day: number, width: 'short' | 'long'): string {
  return localeDateFormat({ weekday: width, timeZone: 'UTC' }).format(MONDAY + day * DAY_MS).replace('.', '');
}

/** Los días de la semana de lunes a domingo, con su abreviatura ("Lun", "Mon") y su nombre ("lunes", "Monday"). */
export function weekdayOptions(): Array<{ value: Weekday; short: string; name: string }> {
  return ([0, 1, 2, 3, 4, 5, 6] as const).map((value) => ({ value, short: capitalize(weekdayName(value, 'short')), name: weekdayName(value, 'long') }));
}

/** "HH:MM:SS" o "HH:MM" del backend → "HH:MM" (el valor de los campos de hora). */
export function clockOf(value: string): string {
  return value.slice(0, 5);
}

/** Una hora del turno ("HH:MM" o "HH:MM:SS") como se lee en el idioma activo: "08:00" (es-MX) o "8:00 AM" (en-US). */
export function clockLabel(value: string): string {
  const [hours, minutes] = clockOf(value).split(':').map(Number);
  return localeDateFormat({ ...timeStyle(), timeZone: 'UTC' }).format(Date.UTC(1970, 0, 1, hours, minutes));
}

/**
 * Días legibles: "Todos los días", "Lun a vie", "Sáb y dom" o "Lun, mié, vie" (en-US: "Every day",
 * "Mon–Fri", "Sat and Sun", "Mon, Wed, Fri"). Un rango seguido (3 o más días) se resume.
 */
export function weekdaysLabel(days: readonly number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return t('shifts.days.all');
  if (!sorted.length) return t('shifts.days.none');
  // El primero con mayúscula; los demás, como se escriben dentro de la frase ("vie" en español, "Fri" en inglés).
  const names = sorted.map((day, i) => (i === 0 ? capitalize(weekdayName(day, 'short')) : weekdayName(day, 'short')));
  const consecutive = sorted.every((day, i) => i === 0 || day === sorted[i - 1] + 1);
  if (consecutive && sorted.length >= 3) return t('shifts.days.range', { from: names[0], to: names[names.length - 1] });
  return names.length === 2 ? formatList(names) : names.join(', ');
}

/** Horario del turno: "08:00 – 16:00" o "22:00 – 06:00 (día siguiente)" (en-US: "10:00 PM – 6:00 AM (next day)"). */
export function shiftSchedule(shift: Pick<ShiftRef, 'start_time' | 'end_time' | 'overnight'>): string {
  const range = `${clockLabel(shift.start_time)} – ${clockLabel(shift.end_time)}`;
  return shift.overnight ? t('shifts.schedule.overnight', { range }) : range;
}
