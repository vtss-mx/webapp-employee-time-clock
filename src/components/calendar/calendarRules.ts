import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import type { ConfirmDetail } from '../../types/confirm';
import { formatDate } from '../../utils/format';
import { parseIso, toIso } from '../ui/DateField';

/**
 * Reglas y fechas del calendario de días libres (presentación pura). Las fechas son días del
 * calendario de la hora del negocio ("YYYY-MM-DD"); un rango incluye ambos extremos.
 */

/** Años que acepta el backend en el calendario (los mismos límites de su consulta `year`). */
export const YEAR_RANGE = { from: 2000, to: 2100 } as const;

/** Lo más que dura una ausencia (el mismo tope del backend: ABSENCE_MAX_DAYS). */
export const ABSENCE_MAX_DAYS = 366;

/** Lo que pide el calendario del mes a la vez (la página más grande de la API). */
export const MONTH_DATA_LIMIT = 50;

/** Pestañas de la pantalla "Calendario" (`?tab=`); sin ella, los festivos. */
export const CALENDAR_TABS = ['holidays', 'absences', 'requests', 'workdays'] as const;
export type CalendarTab = (typeof CALENDAR_TABS)[number];

/** La pestaña de la URL si es una conocida; si no, los festivos. */
export const tabFrom = (value: string | null): CalendarTab => CALENDAR_TABS.find((tab) => tab === value) ?? 'holidays';

/** Ruta de una pestaña del calendario (a donde regresan sus formularios). */
export const calendarPath = (tab: CalendarTab) => (tab === 'holidays' ? paths.company.calendar : `${paths.company.calendar}?tab=${tab}`);

const DAY_MS = 86_400_000;
const utc = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

/** Días de un rango con ambos extremos ("2026-10-01" a "2026-10-03" son 3). */
export const spanDays = (start: string, end: string) => Math.round((utc(end) - utc(start)) / DAY_MS) + 1;

/** "1 día" / "5 días". */
export const daysText = (days: number) => (days === 1 ? '1 día' : `${days} días`);

/** El día `days` días después (o antes, si es negativo). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return toIso(new Date(year, month - 1, day + days));
}

/** El mismo día `months` meses después (el 31 pasa al último día de un mes más corto). */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const last = new Date(year, month - 1 + months + 1, 0).getDate();
  return toIso(new Date(year, month - 1 + months, Math.min(day, last)));
}

/** Primer y último día de un mes (`month`: 0 = enero). */
export function monthBounds(year: number, month: number): { start: string; end: string } {
  return { start: toIso(new Date(year, month, 1)), end: toIso(new Date(year, month + 1, 0)) };
}

/** Todos los días de un rango, en orden. */
export function datesBetween(start: string, end: string): string[] {
  return Array.from({ length: Math.max(0, spanDays(start, end)) }, (_, index) => addDays(start, index));
}

/** El día que se elige al mostrar un mes: hoy si está en él; si no, el primero del mes. */
export function defaultDay(year: number, month: number, today: string): string {
  const { start, end } = monthBounds(year, month);
  return today >= start && today <= end ? today : start;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const longDay = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekdayShort = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' });
const weekdayLong = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'UTC' });

/** "Lunes, 12 de octubre de 2026" (fecha de calendario: no cambia con la zona). */
export const longDate = (date: string) => capitalize(longDay.format(utc(date)));

/** "Octubre de 2026". */
export const monthTitle = (year: number, month: number) => capitalize(monthYear.format(Date.UTC(year, month, 1)));

/** Encabezados de la semana, de lunes a domingo ("Lun" / "lunes"). El 1 de enero de 2024 fue lunes. */
export const WEEKDAYS = Array.from({ length: 7 }, (_, index) => {
  const day = Date.UTC(2024, 0, 1 + index);
  return { short: capitalize(weekdayShort.format(day).replace('.', '')), long: weekdayLong.format(day) };
});

/** Lunes = 0 ... domingo = 6. */
export const weekdayIndex = (date: string) => (new Date(utc(date)).getUTCDay() + 6) % 7;

// ---------- Validación (solo UX: el backend vuelve a validar todo) ----------

/** Fecha obligatoria y real. */
export function dateError(value: string, missing: string): string | undefined {
  if (!value) return missing;
  return parseIso(value) ? undefined : 'Escribe una fecha válida (dd/mm/aaaa)';
}

/** Rango de una ausencia: en orden y de hasta ABSENCE_MAX_DAYS días (solo con dos fechas reales). */
export function rangeError(start: string, end: string): string | undefined {
  if (!parseIso(start) || !parseIso(end)) return undefined;
  if (end < start) return 'La fecha final no puede ser anterior a la inicial';
  return spanDays(start, end) > ABSENCE_MAX_DAYS ? `Una ausencia dura a lo más ${ABSENCE_MAX_DAYS} días` : undefined;
}

/** "12 oct 2026" o "12 oct 2026 al 16 oct 2026". */
export const rangeText = (start: string, end: string) => (start === end ? formatDate(start) : `${formatDate(start)} al ${formatDate(end)}`);

/** Una ausencia para su confirmación (registrar, pedir, aprobar, rechazar o cancelar). */
interface AbsenceLike {
  starts_on: string;
  ends_on: string;
  days: number;
  note?: string | null;
  employee?: { full_name: string; employee_number: string };
}

/**
 * Lo que se confirma de una ausencia: el empleado (si ya es de alguien), el tipo, las fechas con
 * cuántos días son y la nota (si hay).
 */
export function absenceFacts(absence: AbsenceLike, typeName: string): ConfirmDetail[] {
  return [
    ...(absence.employee ? [{ label: 'Empleado', value: `${absence.employee.full_name} · ${absence.employee.employee_number}` }] : []),
    { label: 'Tipo', value: typeName },
    { label: 'Fechas', value: `${rangeText(absence.starts_on, absence.ends_on)} · ${daysText(absence.days)}` },
    ...(absence.note?.trim() ? [{ label: 'Nota', value: absence.note.trim() }] : []),
  ];
}

/**
 * El registro ya cambió en el servidor (otra persona lo eliminó, lo decidió o lo canceló): el popup
 * lo explica y conviene volver a pedir la lista para mostrar lo que hay.
 */
export const isStale = (error: unknown) => error instanceof ApiError && (error.status === 404 || error.code === 'ABSENCE_CLOSED');
