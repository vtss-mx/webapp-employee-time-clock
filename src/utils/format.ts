import { currentLocale, t } from '../i18n/core';
import type { Locale } from '../types/i18n';

/**
 * Zona horaria del NEGOCIO: hora del Centro de México. La envía el backend (`user.timezone`) y se
 * aplica con `setBusinessTimeZone`; todas las fechas y horas se muestran y "hoy" se calcula en
 * ella, no en la del dispositivo (un teléfono en Hermosillo ve la misma hora que la empresa).
 *
 * El IDIOMA de los formatos es el activo (`currentLocale()`): "10 may 2026, 07:55" en es-MX y
 * "May 10, 2026, 7:55 AM" en en-US. Los formatos se crean una vez por idioma, zona y opciones; al
 * cambiar el idioma la siguiente llamada ya usa el nuevo (nada se recarga).
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

/** Hora de un registro: "07:55" (24 h) en es-MX; "7:55 AM" (12 h) en en-US. */
const TIME_STYLE: Record<Locale, Intl.DateTimeFormatOptions> = {
  'es-MX': { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  'en-US': { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' },
};

/** Opciones de la hora en el idioma activo (también para quien arma su propio formato con hora). */
export function timeStyle(): Intl.DateTimeFormatOptions {
  return TIME_STYLE[currentLocale()];
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

/** Hora de un instante en la zona del negocio ("07:55" en es-MX, "7:55 AM" en en-US). */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parsed(value);
  return date ? localeDateFormat({ ...timeStyle(), timeZone: businessZone }).format(date) : value;
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
