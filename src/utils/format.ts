/**
 * Zona horaria del NEGOCIO: hora del Centro de México. La envía el backend (`user.timezone`) y se
 * aplica con `setBusinessTimeZone`; todas las fechas y horas se muestran y "hoy" se calcula en
 * ella, no en la del dispositivo (un teléfono en Hermosillo ve la misma hora que la empresa).
 */
export const DEFAULT_TIME_ZONE = 'America/Mexico_City';

function formattersFor(timeZone: string) {
  return {
    timeZone,
    date: new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone }),
    dateTime: new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone }),
    // Año-mes-día y hora del momento en la zona del negocio (en-CA da YYYY-MM-DD).
    day: new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }),
    hour: new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }),
  };
}

let zone = formattersFor(DEFAULT_TIME_ZONE);
// Fechas de calendario ("YYYY-MM-DD", p. ej. nacimiento): no son un instante, no cambian con la zona.
const calendarFormatter = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' });

/** Usa la zona horaria del negocio que envía el backend (una desconocida se ignora). */
export function setBusinessTimeZone(timeZone: string | null | undefined): void {
  if (!timeZone || timeZone === zone.timeZone) return;
  try {
    zone = formattersFor(timeZone);
  } catch {
    // Zona que el navegador no conoce: se conserva la del Centro.
  }
}

export function businessTimeZone(): string {
  return zone.timeZone;
}

/** Hoy (YYYY-MM-DD) en la zona del negocio. */
export function businessToday(now: Date = new Date()): string {
  return zone.day.format(now);
}

/** Hoy en la zona del negocio como fecha local (para calcular con getFullYear/getMonth/getDate). */
export function businessDate(now: Date = new Date()): Date {
  const [year, month, day] = businessToday(now).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Hora (0-23) en la zona del negocio. */
export function businessHour(now: Date = new Date()): number {
  return Number(zone.hour.format(now));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  if (value.length === 10) {
    const day = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(day.getTime()) ? value : calendarFormatter.format(day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : zone.date.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : zone.dateTime.format(date);
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
  return `${percent.toLocaleString('es-MX', { maximumFractionDigits: 3 })} %`;
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
  const t = businessDate();
  let age = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--;
  return age;
}

const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });

export function timeAgo(value: string | null | undefined): string {
  if (!value) return '—';
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'hace un momento';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDate(value);
}
