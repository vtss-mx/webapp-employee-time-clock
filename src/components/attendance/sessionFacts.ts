import { Briefcase, Coffee, LogIn, LogOut, type LucideIcon } from 'lucide-react';
import type { AttendanceAction, WorkSession } from '../../types';
import { businessToday, formatDate, formatTime } from '../../utils/format';

/**
 * Reglas de presentación de una jornada (puras, compartidas por la empresa y el empleado). Los
 * instantes llegan en UTC y se muestran SIEMPRE en la hora del negocio (`utils/format.ts`); todo lo
 * que se calcula (retardo, salida anticipada, minutos de más) ya lo decidió el backend.
 */

/** Ícono de cada registro (entrada, inicio y fin de descanso, salida). */
export const ACTION_ICONS: Record<AttendanceAction, LucideIcon> = {
  CHECK_IN: LogIn,
  BREAK_START: Coffee,
  BREAK_END: Briefcase,
  CHECK_OUT: LogOut,
};

/** Color del punto de cada registro en la línea de tiempo (clases `att-step--*`). */
export type StepTone = 'in' | 'break' | 'out' | 'current' | 'pending' | 'missed';

export const ACTION_TONES: Record<AttendanceAction, StepTone> = {
  CHECK_IN: 'in',
  BREAK_START: 'break',
  BREAK_END: 'break',
  CHECK_OUT: 'out',
};

/** Horario programado: "08:00 – 16:00" (un turno nocturno termina al día siguiente con la misma regla). */
export function scheduleRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/**
 * Hora de un registro dentro de su jornada: "07:55"; si cayó en otro día que el de la jornada (la
 * salida de un turno nocturno), con su fecha: "06:02 · 4 oct 2026". El día se calcula en la zona del
 * negocio, nunca en la del dispositivo.
 */
export function clockOn(instant: string, workDate: string): string {
  const day = businessToday(new Date(instant));
  return day === workDate ? formatTime(instant) : `${formatTime(instant)} · ${formatDate(day)}`;
}

/** Minutos de descanso de más en la jornada (la suma de lo que excedió cada descanso). */
export function exceededMinutes(session: Pick<WorkSession, 'breaks'>): number {
  return session.breaks.reduce((total, item) => total + item.exceeded_minutes, 0);
}

/** Descansos usados de los permitidos: "1/2 descansos" (o "Sin descansos" si el turno no tiene). */
export function breaksUsed(session: Pick<WorkSession, 'breaks' | 'breaks_allowed'>): string {
  if (!session.breaks_allowed) return 'Sin descansos';
  return `${session.breaks.length}/${session.breaks_allowed} descansos`;
}

/** Distancia legible: "12 m", "1.5 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`;
}

/**
 * Enlace externo para ver un punto en Google Maps (se abre en otra pestaña solo si la persona lo
 * pide; la app no incrusta el mapa ni envía nada por su cuenta).
 */
export function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
