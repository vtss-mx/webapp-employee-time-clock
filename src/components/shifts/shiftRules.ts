import type { ShiftAssignment, Weekday } from '../../types';
import { businessDate, formatDate } from '../../utils/format';
import { weekdaysLabel } from '../../utils/shifts';
import { toIso } from '../ui/DateField';

/**
 * Reglas puras de los formularios de turnos (solo para guiar: el backend vuelve a validar todo).
 * Los límites son los mismos que el backend (`app/models/shift.py`); las horas son "HH:MM" de la
 * hora del negocio y los cálculos se hacen en minutos desde la medianoche.
 */

export const SHIFT_NAME_MAX = 80;
export const SITE_NAME_MAX = 120;
export const MAX_BREAKS = 6;
export const BREAK_MINUTES_MIN = 5;
export const BREAK_MINUTES_MAX = 240;
export const TOLERANCE_MAX = 240;
export const CHECK_OUT_WINDOW_MAX = 720;
const MINUTES_PER_DAY = 1440;

/** "HH:MM" (o "HH:MM:SS") → minutos desde la medianoche; null si no es una hora completa. */
export function clockMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Una hora del turno y el día en que cae respecto al día en que empieza (−1, 0 o +1). */
export interface Moment {
  clock: string;
  day: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Minutos desde la medianoche del día del turno (pueden ser negativos o pasar de un día) → su hora. */
export function momentAt(minutes: number): Moment {
  const day = Math.floor(minutes / MINUTES_PER_DAY);
  const rest = minutes - day * MINUTES_PER_DAY;
  return { clock: `${pad(Math.floor(rest / 60))}:${pad(rest % 60)}`, day };
}

/** "07:45", "23:45 del día anterior" o "01:00 del día siguiente". */
export function momentText({ clock, day }: Moment): string {
  if (day < 0) return `${clock} del día anterior`;
  return day > 0 ? `${clock} del día siguiente` : clock;
}

/** Horario y tolerancias del turno en minutos (lo que se captura en el formulario). */
export interface ShiftTimes {
  start: number;
  end: number;
  breaksCount: number;
  breakMinutes: number;
  earlyCheckIn: number;
  lateTolerance: number;
  earlyCheckOut: number;
  lateCheckOut: number;
}

/** La jornada que resulta: duración, si termina al día siguiente y las ventanas para checar. */
export interface ShiftTimeline {
  duration: number;
  overnight: boolean;
  /** Desde cuándo se puede checar la entrada. */
  opens: Moment;
  /** Después de esta hora la entrada es retardo. */
  lateAfter: Moment;
  /** Desde cuándo puede checar la salida sin que cuente como salida anticipada. */
  leavesFrom: Moment;
  /** Límite para checar la salida. */
  deadline: Moment;
  /** Minutos desde que abre la entrada hasta el límite de la salida (debe ser menor a un día). */
  window: number;
}

/** Igual que el backend: salida igual o antes que la entrada = termina al día siguiente. */
export function shiftTimeline(times: ShiftTimes): ShiftTimeline {
  const overnight = times.end <= times.start;
  const duration = overnight ? times.end + MINUTES_PER_DAY - times.start : times.end - times.start;
  const endsAt = times.start + duration;
  return {
    duration,
    overnight,
    opens: momentAt(times.start - times.earlyCheckIn),
    lateAfter: momentAt(times.start + times.lateTolerance),
    leavesFrom: momentAt(endsAt - times.earlyCheckOut),
    deadline: momentAt(endsAt + times.lateCheckOut),
    window: times.earlyCheckIn + duration + times.lateCheckOut,
  };
}

/** La ventana completa de una jornada no alcanza a la siguiente (menos de 24 h). */
export const fitsInADay = (timeline: ShiftTimeline) => timeline.window < MINUTES_PER_DAY;

/** Minutos enteros dentro de un rango (descansos y tolerancias). */
export function validateMinutes(value: string, min: number, max: number): string | undefined {
  const text = value.trim();
  if (!text) return 'Indica los minutos';
  const minutes = Number(text);
  if (!Number.isInteger(minutes)) return 'Escribe minutos enteros';
  return minutes < min || minutes > max ? `Entre ${min} y ${max} min` : undefined;
}

/** Nombre de un turno o un sitio: obligatorio (2 caracteres o más) y con su máximo. */
export function validateName(value: string, max: number, example: string): string | undefined {
  const name = value.trim();
  if (name.length < 2) return `Escribe un nombre (p. ej. "${example}")`;
  return name.length > max ? `Máximo ${max} caracteres` : undefined;
}

/** Días ordenados y sin repetir (como los guarda el backend). */
export const sortedDays = (days: Iterable<Weekday>): Weekday[] => [...new Set(days)].sort((a, b) => a - b);

/** Mañana (YYYY-MM-DD) en la zona del negocio: un cambio de turno se programa con un día de anticipación. */
export function businessTomorrow(now: Date = new Date()): string {
  const today = businessDate(now);
  return toIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
}

/** Radio de un sitio: "100 m" o "1.5 km". */
export function metersText(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toLocaleString('es-MX')} km` : `${meters.toLocaleString('es-MX')} m`;
}

/** Descansos de un turno: "Sin descansos", "1 × 30 min" o "2 × 15 min". */
export function breaksText(count: number, minutes: number): string {
  return count > 0 ? `${count} × ${minutes} min` : 'Sin descansos';
}

/** Vigencia de una asignación: "Desde el 5 oct 2026" o "Del 1 sep 2026 al 4 oct 2026". */
export function periodText({ valid_from, valid_to }: Pick<ShiftAssignment, 'valid_from' | 'valid_to'>): string {
  return valid_to ? `Del ${formatDate(valid_from)} al ${formatDate(valid_to)}` : `Desde el ${formatDate(valid_from)}`;
}

/** Dónde checa: "Remoto: Lun y mié · En sitio: Planta Norte" o "Solo en sitio: Planta Norte". */
export function placeText({ remote_weekdays, sites }: Pick<ShiftAssignment, 'remote_weekdays' | 'sites'>): string {
  const onSite = sites.length ? sites.map((site) => site.name).join(', ') : 'ningún sitio';
  return remote_weekdays.length ? `Remoto: ${weekdaysLabel(remote_weekdays)} · En sitio: ${onSite}` : `Solo en sitio: ${onSite}`;
}
