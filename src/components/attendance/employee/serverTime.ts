import { t } from '../../../i18n';
import { formatMinutes } from '../../../utils/format';

/**
 * Tiempo del SERVIDOR en "Mi asistencia": los "cuánto falta" y "cuánto llevas" parten de `today.now`
 * (la hora del servidor al responder), no del reloj del teléfono. La diferencia entre ambos se calcula
 * UNA vez al recibir la respuesta; un teléfono con la hora mal puesta muestra lo mismo que los demás.
 */

const SECOND = 1000;
export const MINUTE = 60 * SECOND;

/** Diferencia (ms) entre la hora del servidor y la del teléfono en el momento de recibir la respuesta. */
export function serverOffset(serverNow: string, receivedAt: number = Date.now()): number {
  return Date.parse(serverNow) - receivedAt;
}

/** La hora del servidor ahora (ms), con la diferencia calculada al recibir la respuesta. */
export function serverNow(offsetMs: number): number {
  return Date.now() + offsetMs;
}

/** Milisegundos que faltan para un instante (negativo si ya pasó), en la hora del servidor. */
export function msUntil(instant: string, offsetMs: number): number {
  return Date.parse(instant) - serverNow(offsetMs);
}

/** Minutos completos entre dos instantes (como los cuenta el servidor). */
export function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.floor((Date.parse(end) - Date.parse(start)) / MINUTE));
}

/** Un instante más unos minutos (ISO): p. ej. cuándo termina el descanso en curso. */
export function addMinutes(instant: string, minutes: number): string {
  return new Date(Date.parse(instant) + minutes * MINUTE).toISOString();
}

/**
 * Lo que falta, redondeado hacia arriba al segundo: "2 d 3 h", "3 h 5 min", "14 min 05 s" o "45 s".
 * Con menos de una hora corren los segundos (como un reloj checador); antes, solo los minutos.
 */
export function countdownText(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / SECOND));
  const days = Math.floor(seconds / 86_400);
  if (days) {
    const hours = Math.floor((seconds % 86_400) / 3600);
    return hours ? t('myAttendance.clock.left.daysHours', { days, hours }) : t('myAttendance.clock.left.days', { days });
  }
  if (seconds >= 3600) return formatMinutes(Math.floor(seconds / 60));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? t('myAttendance.clock.left.minutesSeconds', { minutes, seconds: String(rest).padStart(2, '0') }) : t('myAttendance.clock.left.seconds', { seconds: rest });
}
