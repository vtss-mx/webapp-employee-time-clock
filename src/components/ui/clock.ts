/**
 * Horas del día "HH:MM" (24 h) para `TimeField`: lectura, máscara mientras se escribe, cómo se
 * completa al salir del campo y las opciones del selector. Funciones puras y sin zona horaria: la
 * hora que se captura es la del negocio y nunca se convierte con el reloj del dispositivo.
 */

const MINUTES_PER_HOUR = 60;
export const LAST_MINUTE_OF_DAY = 1439;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** "HH:MM" (o "HH:MM:SS", como la envía la API) → minutos desde la medianoche; null si no es una hora válida. */
export function parseClock(value: string | undefined): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value ?? '');
  return match ? Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]) : null;
}

/** Minutos desde la medianoche → "HH:MM". */
export const clockText = (minutes: number) => `${pad2(Math.floor(minutes / MINUTES_PER_HOUR))}:${pad2(minutes % MINUTES_PER_HOUR)}`;

/** Máscara mientras se escribe: solo dígitos (4 como máximo) y ":" después de la hora. "0730" → "07:30". */
export function maskClock(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/**
 * Lo que se entrega al formulario: la hora completa ("HH:MM") o "" mientras está incompleta. Una
 * hora completa que no existe (25:00) se entrega tal cual para que la validación la marque.
 */
export const clockValue = (text: string) => (text.length === 5 ? text : '');

/** Lo que se ve en el campo para un valor del formulario (normaliza "08:00:00" a "08:00"). */
export function clockDisplay(value: string): string {
  const minutes = parseClock(value);
  return minutes === null ? maskClock(value) : clockText(minutes);
}

/**
 * Al salir del campo se completa lo que quedó a medias, como haría una persona: "7" → "07:00",
 * "14" → "14:00" y "730" → "07:30". Vacío o completo, queda igual.
 */
export function completeClock(text: string): string {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 0 || digits.length === 4) return text;
  const [hours, minutes] = digits.length === 3 ? [digits.slice(0, 1), digits.slice(1)] : [digits, '00'];
  return `${hours.padStart(2, '0')}:${minutes}`;
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
