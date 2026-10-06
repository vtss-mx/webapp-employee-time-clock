import { t } from '../../i18n';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import type { ConfirmDetail } from '../../types/confirm';
import { formatDate, localeDateFormat } from '../../utils/format';
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

/** El calendario con un día elegido (`?date=`): a donde regresa un formulario abierto desde ese día. */
export const calendarDayPath = (date: string) => `${paths.company.calendar}?date=${date}`;

const DAY_MS = 86_400_000;
const utc = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

/** Días de un rango con ambos extremos ("2026-10-01" a "2026-10-03" son 3). */
export const spanDays = (start: string, end: string) => Math.round((utc(end) - utc(start)) / DAY_MS) + 1;

/** "1 día" / "5 días" (en el idioma activo). */
export const daysText = (days: number) => t('calendar.days', { count: days });

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

/**
 * Las 6 semanas que muestra la cuadrícula del mes, de lunes a domingo, con los días del mes anterior y
 * del siguiente que completan la primera y la última: siempre 42 días, así la altura no cambia de un
 * mes a otro.
 */
export function gridWeeks(year: number, month: number): string[][] {
  const { start } = monthBounds(year, month);
  const first = addDays(start, -weekdayIndex(start));
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(first, week * 7 + day)));
}

/** Sábado o domingo. */
export const isWeekend = (date: string) => weekdayIndex(date) >= 5;

/** El año y el mes (0 = enero) de un día. */
export const monthOf = (date: string) => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 });

/** El día de la URL (`?date=`) si es real y está en los años que acepta el backend; si no, null. */
export function calendarDay(value: string | null): string | null {
  if (!value || !parseIso(value)) return null;
  const { year } = monthOf(value);
  return year >= YEAR_RANGE.from && year <= YEAR_RANGE.to ? value : null;
}

/** El día que se elige al mostrar un mes: hoy si está en él; si no, el primero del mes. */
export function defaultDay(year: number, month: number, today: string): string {
  const { start, end } = monthBounds(year, month);
  return today >= start && today <= end ? today : start;
}

// Los nombres de días y meses salen de `Intl` en el idioma activo; el formato se pide en cada uso
// (en caché por idioma) para que un cambio de idioma se vea en el siguiente dibujo.
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const calendarFormat = (options: Intl.DateTimeFormatOptions) => localeDateFormat({ ...options, timeZone: 'UTC' });

/**
 * El día dentro de una frase: "lunes, 12 de octubre de 2026" (es-MX) o "Monday, October 12, 2026"
 * (en-US), como lo escribe cada idioma (fecha de calendario: no cambia con la zona).
 */
export const inlineDate = (date: string) => calendarFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(utc(date));

/** "Lunes, 12 de octubre de 2026" / "Monday, October 12, 2026" (al inicio de un renglón). */
export const longDate = (date: string) => capitalize(inlineDate(date));

/** "Octubre de 2026" / "October 2026". */
export const monthTitle = (year: number, month: number) => capitalize(calendarFormat({ month: 'long', year: 'numeric' }).format(Date.UTC(year, month, 1)));

/** Nombre del mes (0 = enero): "Octubre" / "October" (largo) u "Oct" (corto, sin punto). */
export const monthName = (month: number, style: 'long' | 'short') => capitalize(calendarFormat({ month: style }).format(Date.UTC(2024, month, 1)).replace('.', ''));

/** Nombre del día de la semana: "Viernes" / "Friday". */
export const weekdayName = (date: string) => capitalize(calendarFormat({ weekday: 'long' }).format(utc(date)));

/**
 * Encabezados de la semana, de lunes a domingo ("Lun" / "lunes"; "Mon" / "Monday"), en el idioma
 * activo. La semana empieza en lunes en los dos idiomas (como las demás semanas de la app). El 1 de
 * enero de 2024 fue lunes.
 */
export function weekdays(): Array<{ short: string; long: string }> {
  const short = calendarFormat({ weekday: 'short' });
  const long = calendarFormat({ weekday: 'long' });
  return Array.from({ length: 7 }, (_, index) => {
    const day = Date.UTC(2024, 0, 1 + index);
    return { short: capitalize(short.format(day).replace('.', '')), long: long.format(day) };
  });
}

/** Lunes = 0 ... domingo = 6. */
export const weekdayIndex = (date: string) => (new Date(utc(date)).getUTCDay() + 6) % 7;

// ---------- Validación (solo UX: el backend vuelve a validar todo) ----------

/** Fecha obligatoria y real. */
export function dateError(value: string, missing: string): string | undefined {
  if (!value) return missing;
  return parseIso(value) ? undefined : t('ui.dateField.invalid');
}

/** Rango de una ausencia: en orden y de hasta ABSENCE_MAX_DAYS días (solo con dos fechas reales). */
export function rangeError(start: string, end: string): string | undefined {
  if (!parseIso(start) || !parseIso(end)) return undefined;
  if (end < start) return t('calendar.validation.rangeOrder');
  return spanDays(start, end) > ABSENCE_MAX_DAYS ? t('calendar.validation.rangeMax', { max: ABSENCE_MAX_DAYS }) : undefined;
}

/** "12 oct 2026" o "12 oct 2026 al 16 oct 2026" (en el idioma activo). */
export const rangeText = (start: string, end: string) => (start === end ? formatDate(start) : t('calendar.range', { start: formatDate(start), end: formatDate(end) }));

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
 * cuántos días son y la nota (si hay), en el idioma activo (se llama al armar la confirmación).
 */
export function absenceFacts(absence: AbsenceLike, typeName: string): ConfirmDetail[] {
  return [
    ...(absence.employee ? [{ label: t('common.fields.employee'), value: `${absence.employee.full_name} · ${absence.employee.employee_number}` }] : []),
    { label: t('calendar.fields.type'), value: typeName },
    { label: t('calendar.fields.dates'), value: `${rangeText(absence.starts_on, absence.ends_on)} · ${daysText(absence.days)}` },
    ...(absence.note?.trim() ? [{ label: t('common.fields.note'), value: absence.note.trim() }] : []),
  ];
}

/**
 * El registro ya cambió en el servidor (otra persona lo eliminó, lo decidió o lo canceló): el popup
 * lo explica y conviene volver a pedir la lista para mostrar lo que hay.
 */
export const isStale = (error: unknown) => error instanceof ApiError && (error.status === 404 || error.code === 'ABSENCE_CLOSED');
