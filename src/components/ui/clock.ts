/**
 * Horas del día para `TimeField`: lectura, máscara mientras se escribe, cómo se completa al salir
 * del campo y las opciones del selector. Funciones puras y sin zona horaria: la hora que se captura
 * es la del negocio y nunca se convierte con el reloj del dispositivo.
 *
 * El VALOR siempre es "HH:MM" (24 h, como lo guarda la API). Lo que se ESCRIBE y se VE sigue al
 * idioma (`ClockStyle`): 24 h en es-MX ("19:30") y 12 h con AM/PM en en-US ("07:30 PM").
 */
import { timeStyle } from '../../utils/format';

const MINUTES_PER_HOUR = 60;
export const LAST_MINUTE_OF_DAY = 1439;

/** Cómo se escribe y se ve la hora: 24 h ("19:30") o 12 h con AM/PM ("07:30 PM"). */
export type ClockStyle = 'h23' | 'h12';

/** El estilo del idioma activo: el mismo reloj con que la app muestra las horas (`timeStyle`). */
export const clockStyle = (): ClockStyle => (timeStyle().hourCycle === 'h12' ? 'h12' : 'h23');

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** "HH:MM" (o "HH:MM:SS", como la envía la API) → minutos desde la medianoche; null si no es una hora válida. */
export function parseClock(value: string | undefined): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value ?? '');
  return match ? Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]) : null;
}

/** Marca de 12 h de una hora (0-23): AM antes del mediodía. */
const periodOf = (hours: number) => (hours < 12 ? 'AM' : 'PM');

/** Minutos desde la medianoche → "HH:MM" (24 h; también el valor del formulario) o "hh:mm AM" (12 h). */
export function clockText(minutes: number, style: ClockStyle = 'h23'): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = pad2(minutes % MINUTES_PER_HOUR);
  return style === 'h12' ? `${pad2(hours % 12 || 12)}:${rest} ${periodOf(hours)}` : `${pad2(hours)}:${rest}`;
}

/** Nombre de una hora (0-23) en la columna del selector: "07" (24 h) o "07 AM" (12 h). */
export const hourLabel = (hours: number, style: ClockStyle) => (style === 'h12' ? `${pad2(hours % 12 || 12)} ${periodOf(hours)}` : pad2(hours));

/** La marca escrita en 12 h: la última "a" o "p" (escribir otra la cambia) y la "m" que la sigue, en mayúsculas; "" si no hay. */
function typedPeriod(text: string): string {
  const letters = text.replace(/[^apm]/gi, '').toUpperCase();
  const at = Math.max(letters.lastIndexOf('A'), letters.lastIndexOf('P'));
  if (at < 0) return '';
  return letters[at + 1] === 'M' ? `${letters[at]}M` : letters[at];
}

/**
 * Máscara mientras se escribe: solo dígitos (4 como máximo) y ":" después de la hora ("0730" →
 * "07:30"). En 12 h, además la "a" o la "p" escriben AM o PM ("0730p" → "07:30 P"; se completa al
 * salir); borrar la marca letra por letra funciona porque la "M" solo se agrega al completar.
 */
export function maskClock(text: string, style: ClockStyle = 'h23'): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  const masked = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  return style === 'h12' ? [masked, typedPeriod(text)].filter(Boolean).join(' ') : masked;
}

/**
 * Lo escrito → minutos; null si no es una hora válida. En 12 h, la hora va de 01 a 12 con su marca;
 * sin marca se lee como 24 h (escribir "19:30" también sirve y "07:30" es de la mañana).
 */
export function parseTyped(text: string, style: ClockStyle = 'h23'): number | null {
  if (style === 'h23') return parseClock(text);
  const match = /^(\d{2}):(\d{2})(?: ([AP])M?)?$/.exec(text);
  if (!match) return null;
  const [, hours, minutes, period] = match;
  if (!period) return parseClock(`${hours}:${minutes}`);
  if (Number(hours) > 12 || Number(minutes) >= MINUTES_PER_HOUR) return null;
  return ((Number(hours) % 12) + (period === 'P' ? 12 : 0)) * MINUTES_PER_HOUR + Number(minutes);
}

/** Ya tiene los cuatro dígitos de la hora: desde ahí se valida (mientras se escribe no se regaña). */
export const isComplete = (text: string) => /^\d{2}:\d{2}/.test(text);

/**
 * Lo que se entrega al formulario: la hora completa ("HH:MM", 24 h) o "" mientras está incompleta. Una
 * hora completa que no existe (25:00, 13:00 PM) se entrega tal cual para que la validación la marque.
 */
export function clockValue(text: string, style: ClockStyle = 'h23'): string {
  if (!isComplete(text)) return '';
  const minutes = parseTyped(text, style);
  return minutes === null ? text : clockText(minutes);
}

/** Lo que se ve en el campo para un valor del formulario (normaliza "08:00:00" a "08:00" o "08:00 AM"). */
export function clockDisplay(value: string, style: ClockStyle = 'h23'): string {
  const minutes = parseClock(value);
  return minutes === null ? maskClock(value, style) : clockText(minutes, style);
}

/**
 * Al salir del campo se completa lo que quedó a medias, como haría una persona: "7" → "07:00",
 * "14" → "14:00" y "730" → "07:30" (en 12 h, con su marca: "7p" → "07:00 PM", "19" → "07:00 PM" y,
 * sin marca, de la mañana). Vacío queda igual; una hora que no existe queda escrita para marcarla.
 */
export function completeClock(text: string, style: ClockStyle = 'h23'): string {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 0) return text;
  const split = digits.length === 3 ? 1 : 2;
  const whole = `${digits.slice(0, split).padStart(2, '0')}:${digits.slice(split) || '00'}`;
  if (style === 'h23') return whole;
  const typed = [whole, typedPeriod(text)].filter(Boolean).join(' ');
  const minutes = parseTyped(typed, style);
  return minutes === null ? typed : clockText(minutes, style);
}

/** Límites del campo en minutos (null: sin límite de ese lado). */
export interface ClockRange {
  min: number | null;
  max: number | null;
}

/** El intervalo [from, to] (minutos) toca el rango permitido. */
export const overlapsRange = (from: number, to: number, { min, max }: ClockRange) => (min === null || to >= min) && (max === null || from <= max);

/** Lleva una hora al rango permitido. */
export const clampToRange = (minutes: number, { min, max }: ClockRange) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, minutes));

/**
 * Minutos del selector: cada `step` (5 → 00, 05 … 55) más los que deben verse aunque no caigan en
 * el paso (la hora exacta elegida o escrita, p. ej. 07:33), en orden.
 */
export function minuteOptions(step: number, keep: ReadonlyArray<number | null>): number[] {
  const every = Math.min(MINUTES_PER_HOUR, Math.max(1, Math.floor(step)));
  const minutes = new Set(Array.from({ length: Math.ceil(MINUTES_PER_HOUR / every) }, (_, i) => i * every));
  for (const minute of keep) if (minute !== null) minutes.add(minute);
  return [...minutes].sort((a, b) => a - b);
}
