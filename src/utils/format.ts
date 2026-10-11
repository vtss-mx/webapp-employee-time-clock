import { currentLocale, t } from '../i18n/core';
import type { Locale } from '../types/i18n';

/**
 * Zona horaria del NEGOCIO: hora del Centro de México. La envía el backend (`user.timezone`) y se
 * aplica con `setBusinessTimeZone`; todas las fechas y horas se muestran y "hoy" se calcula en
 * ella, no en la del dispositivo (un teléfono en Hermosillo ve la misma hora que la empresa).
 *
 * El IDIOMA de los formatos es el activo (`currentLocale()`): "10 may 2026, 07:55" en es-MX,
 * "May 10, 2026, 7:55 AM" en en-US, "10 de mai. de 2026, 07:55" en pt-BR, "10.05.2026, 07:55" en de-DE...
 * (`Intl` con el idioma activo; reloj de 12 horas solo en en-US). Los formatos se crean una vez por idioma,
 * zona y opciones; al cambiar el idioma la siguiente llamada ya usa el nuevo (nada se recarga).
 */
export const DEFAULT_TIME_ZONE = 'America/Mexico_City';

let businessZone = DEFAULT_TIME_ZONE;
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function cachedDateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, format);
  }
  return format;
}

/** Fecha numérica de calendario (día y mes de dos dígitos, año completo) en el orden y con el separador del idioma: `DateField` y las validaciones. */
export const NUMERIC_DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' };

/**
 * Formato de fechas en el idioma activo (en caché). Para fechas de calendario ("YYYY-MM-DD") se
 * pasa `timeZone: 'UTC'`; para instantes, `businessTimeZone()`. Se pide en cada uso (no se guarda
 * en una constante del módulo: quedaría en el idioma con que se cargó).
 */
export function localeDateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return cachedDateFormat(currentLocale(), options);
}

/** Zona horaria del negocio vigente (la del Centro hasta que el backend envíe otra). */
export function businessTimeZone(): string {
  return businessZone;
}

/** Usa la zona horaria del negocio que envía el backend (una desconocida se ignora). */
export function setBusinessTimeZone(timeZone: string | null | undefined): void {
  if (!timeZone || timeZone === businessZone) return;
  try {
    cachedDateFormat('en-US', { timeZone });
    businessZone = timeZone;
  } catch {
    // Zona que el navegador no conoce: se conserva la del Centro.
  }
}

/** Año-mes-día y hora del momento en la zona del negocio (formatos de máquina, no del idioma). */
const machineDay = () => cachedDateFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: businessZone });
const machineHour = () => cachedDateFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: businessZone });

/** Hoy (YYYY-MM-DD) en la zona del negocio. */
export function businessToday(now: Date = new Date()): string {
  return machineDay().format(now);
}

/** Hoy en la zona del negocio como fecha local (para calcular con getFullYear/getMonth/getDate). */
export function businessDate(now: Date = new Date()): Date {
  const [year, month, day] = businessToday(now).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Hora (0-23) en la zona del negocio. */
export function businessHour(now: Date = new Date()): number {
  return Number(machineHour().format(now));
}

/** Año, mes, día, hora y minuto de un instante en la zona del negocio (formato de máquina). */
const machineStamp = () =>
  cachedDateFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: businessZone });

/**
 * Lo que hay que SUMAR al instante para leer su hora de pared en la zona del negocio (en milisegundos).
 *
 * La hora de pared se lee con precisión de MINUTO, así que se compara contra el instante truncado al minuto: si no,
 * los segundos y los milisegundos del instante se colarían en el desfase (el fin del día, 23:59:59.999, se corría
 * casi un minuto).
 */
function businessOffsetMs(at: Date): number {
  const parts = machineStamp().formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const minute = Math.floor(at.getTime() / 60_000) * 60_000;
  return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute')) - minute;
}

/**
 * El instante (ISO con zona) de una hora de pared de la zona del NEGOCIO: lo que necesita un filtro de periodo
 * para que el día que la persona elige sea el día de la empresa, no el del dispositivo ni UTC.
 *
 * Dos pasadas: la primera estima el desfase con la hora pedida leída como UTC y la segunda lo corrige con el
 * instante estimado, que es el que de verdad decide si hay horario de verano. Un día inválido devuelve null (el
 * filtro simplemente no se envía).
 */
function businessInstant(day: string, hour: number, minute: number, second: number, ms: number): string | null {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return null;
  const wanted = Date.UTC(year, month - 1, date, hour, minute, second, ms);
  // Un año fuera de lo que JavaScript puede representar da NaN: el filtro simplemente no se envía.
  if (Number.isNaN(wanted)) return null;
  const once = wanted - businessOffsetMs(new Date(wanted));
  return new Date(wanted - businessOffsetMs(new Date(once))).toISOString();
}

/** Inicio ("YYYY-MM-DD" a las 00:00 del negocio) de un día de calendario, como instante ISO con zona. */
export function businessDayStart(day: string): string | null {
  return businessInstant(day, 0, 0, 0, 0);
}

/** Fin del día (23:59:59.999 del negocio), para que un periodo incluya el día elegido completo. */
export function businessDayEnd(day: string): string | null {
  return businessInstant(day, 23, 59, 59, 999);
}

/** Hora de un registro: "07:55" (reloj de 24 horas) en todos los idiomas salvo en-US ("7:55 AM"). */
const TWENTY_FOUR_HOURS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
const TWELVE_HOURS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' };
/** Los idiomas que leen la hora en un reloj de 12 horas (los demás, 24: es, pt, fr, de, it). */
const TWELVE_HOUR_LOCALES: ReadonlySet<Locale> = new Set<Locale>(['en-US']);

/** Opciones de la hora en el idioma activo (también para quien arma su propio formato con hora). */
export function timeStyle(): Intl.DateTimeFormatOptions {
  return TWELVE_HOUR_LOCALES.has(currentLocale()) ? TWELVE_HOURS : TWENTY_FOUR_HOURS;
}

function parsed(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  // Fechas de calendario ("YYYY-MM-DD", p. ej. nacimiento): no son un instante, no cambian con la zona.
  if (value.length === 10) {
    const day = parsed(`${value}T00:00:00Z`);
    return day ? localeDateFormat({ dateStyle: 'medium', timeZone: 'UTC' }).format(day) : value;
  }
  const date = parsed(value);
  return date ? localeDateFormat({ dateStyle: 'medium', timeZone: businessZone }).format(date) : value;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parsed(value);
  return date ? localeDateFormat({ dateStyle: 'medium', timeStyle: 'short', timeZone: businessZone }).format(date) : value;
}

/** Duración legible: "45 min", "8 h", "7 h 20 min". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return t('format.minutes', { minutes: rest });
  return rest ? t('format.hoursMinutes', { hours, minutes: rest }) : t('format.hours', { hours });
}

export function formatPercent(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`;
}

/**
 * Confianza con hasta 3 decimales, truncada (nunca redondea hacia arriba): 0.999996 → "99.999 %",
 * no "100 %", que ningún sistema biométrico puede garantizar.
 */
export function formatConfidence(value: number | null | undefined): string {
  if (value == null) return '—';
  // Tope en 99.999 %: una similitud perfecta (misma imagen) tampoco se presenta como certeza.
  const percent = Math.min(Math.floor(value * 100_000), 99_999) / 1000;
  return t('format.percent', { value: percent.toLocaleString(currentLocale(), { maximumFractionDigits: 3 }) });
}

export function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/** Edad cumplida hoy (en la zona del negocio). */
export function ageFrom(birthDate: string): number {
  const d = new Date(`${birthDate}T00:00:00`);
  const today = businessDate();
  let age = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
  return age;
}

const relativeFormats = new Map<Locale, Intl.RelativeTimeFormat>();

function relativeFormat(): Intl.RelativeTimeFormat {
  const locale = currentLocale();
  let format = relativeFormats.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeFormats.set(locale, format);
  }
  return format;
}

/** "hace 5 minutos" / "5 minutes ago"; más de un mes, la fecha. */
export function timeAgo(value: string | null | undefined): string {
  if (!value) return '—';
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return t('format.justNow');
  if (abs < 3600) return relativeFormat().format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return relativeFormat().format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return relativeFormat().format(Math.round(diff / 86400), 'day');
  return formatDate(value);
}
