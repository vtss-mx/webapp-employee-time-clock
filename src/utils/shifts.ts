import type { ShiftRef, Weekday } from '../types';

/**
 * Reglas de presentación de los turnos (puras). Los días viajan como números (0 = lunes ... 6 =
 * domingo) y las horas del turno como "HH:MM:SS" de la hora del negocio; el backend decide todo lo
 * demás (si un turno es nocturno, qué se puede registrar y cuándo).
 */

export const WEEKDAYS: ReadonlyArray<{ value: Weekday; short: string; name: string }> = [
  { value: 0, short: 'Lun', name: 'lunes' },
  { value: 1, short: 'Mar', name: 'martes' },
  { value: 2, short: 'Mié', name: 'miércoles' },
  { value: 3, short: 'Jue', name: 'jueves' },
  { value: 4, short: 'Vie', name: 'viernes' },
  { value: 5, short: 'Sáb', name: 'sábado' },
  { value: 6, short: 'Dom', name: 'domingo' },
];

/** "HH:MM:SS" o "HH:MM" del backend → "HH:MM". */
export function clockOf(value: string): string {
  return value.slice(0, 5);
}

/**
 * Días legibles: "Todos los días", "Lun a vie", "Sáb y dom" o "Lun, mié, vie". Un rango seguido
 * (3 o más días) se resume con "a".
 */
export function weekdaysLabel(days: readonly number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Todos los días';
  if (!sorted.length) return 'Ningún día';
  const names = sorted.map((day) => WEEKDAYS[day].short);
  const consecutive = sorted.every((day, i) => i === 0 || day === sorted[i - 1] + 1);
  if (consecutive && sorted.length >= 3) return `${names[0]} a ${names[names.length - 1].toLowerCase()}`;
  if (names.length === 2) return `${names[0]} y ${names[1].toLowerCase()}`;
  return [names[0], ...names.slice(1).map((name) => name.toLowerCase())].join(', ');
}

/** Horario del turno: "08:00 – 16:00" o "22:00 – 06:00 (día siguiente)". */
export function shiftSchedule(shift: Pick<ShiftRef, 'start_time' | 'end_time' | 'overnight'>): string {
  const range = `${clockOf(shift.start_time)} – ${clockOf(shift.end_time)}`;
  return shift.overnight ? `${range} (día siguiente)` : range;
}
