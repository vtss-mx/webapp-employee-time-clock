import { t } from '../../../i18n';
import { ATTENDANCE_SLUGS } from '../../../services/attendanceService';
import type { AttendanceAction, AttendanceToday, BoardState, WorkBreak, WorkSession } from '../../../types';
import { formatMinutes, formatTime } from '../../../utils/format';
import { addMinutes } from './serverTime';

/**
 * Presentación de "Mi asistencia" a partir de lo que respondió el servidor (puras). Nada de esto
 * decide qué se puede registrar (`today.actions`); solo cómo se muestra y cuándo volver a preguntar.
 * Los textos salen en el idioma activo: se piden al dibujar (nunca se guardan).
 */

/** La acción de la ruta ("check-in" → CHECK_IN); null si la ruta no corresponde a ninguna. */
export function actionFromSlug(slug: string | undefined): AttendanceAction | null {
  const actions = Object.keys(ATTENDANCE_SLUGS) as AttendanceAction[];
  return actions.find((action) => ATTENDANCE_SLUGS[action] === slug) ?? null;
}

/** "Registrar entrada", "Registrar inicio de descanso"... a partir del nombre del catálogo. */
export function recordLabel(actionName: string): string {
  return t('myAttendance.record.label', { action: actionName.toLowerCase() });
}

/** El descanso en curso de la jornada (a lo más uno). */
export function openBreak(session: WorkSession): WorkBreak | undefined {
  return session.breaks.find((item) => !item.ended_at);
}

const isAfter = (instant: string, today: AttendanceToday) => Date.parse(instant) > Date.parse(today.now);

/**
 * En qué va la jornada, con los estados del tablero de la empresa (catálogo board_states: su nombre y
 * su color vienen de la BD). Un festivo o una ausencia aprobada es DAY_OFF (no es una falta). null: no
 * hay turno que mostrar.
 */
export function clockState(today: AttendanceToday): BoardState | null {
  const { session, occurrence } = today;
  if (session) {
    if (session.status === 'OPEN') return openBreak(session) ? 'ON_BREAK' : 'WORKING';
    return session.status === 'CLOSED' ? 'DONE' : 'MISSED_CHECKOUT';
  }
  if (today.day_off) return 'DAY_OFF';
  if (occurrence) return isAfter(occurrence.start, today) ? 'SCHEDULED' : 'MISSING';
  return today.next_occurrence ? 'SCHEDULED' : null;
}

export interface ClockCountdown {
  /** Instante al que se cuenta (hora del servidor). */
  until: string;
  label: string;
  /** Lo que se dice al llegar. */
  done: string;
}

/** Lo que corre en la tarjeta: cuánto falta para la siguiente hora importante de la jornada. */
export function clockCountdown(today: AttendanceToday): ClockCountdown | null {
  const { session, occurrence } = today;
  if (session?.status === 'OPEN') {
    const pause = openBreak(session);
    return pause
      ? { until: addMinutes(pause.started_at, session.break_minutes_allowed), label: t('myAttendance.clock.countdown.breakEnds'), done: t('myAttendance.clock.countdown.breakOver') }
      : { until: session.scheduled_end, label: t('myAttendance.clock.countdown.checkOutIn'), done: t('myAttendance.clock.countdown.checkOutNow') };
  }
  if (session) return null;
  if (occurrence) {
    return isAfter(occurrence.start, today) ? { until: occurrence.start, label: t('myAttendance.clock.countdown.shiftStarts'), done: t('myAttendance.clock.countdown.shiftStarted') } : null;
  }
  const next = today.next_occurrence;
  return next ? { until: next.opens, label: t('myAttendance.clock.countdown.opensIn'), done: t('myAttendance.clock.countdown.open') } : null;
}

/**
 * Cuándo cambia lo que el servidor permite (se abre la ventana para checar, empieza el turno, se cierra
 * la entrada, se abre o se cierra la ventana de los descansos o vence el límite de la salida): en ese
 * momento se vuelve a preguntar "hoy". null: nada que esperar.
 */
export function refreshAt(today: AttendanceToday): string | null {
  const { session, occurrence } = today;
  const moments =
    session?.status === 'OPEN'
      ? [session.scheduled_start, session.scheduled_end, session.check_out_deadline]
      : [occurrence?.start, occurrence?.end, occurrence?.deadline, today.next_occurrence?.opens];
  const upcoming = moments.filter((moment): moment is string => moment !== undefined && isAfter(moment, today));
  return upcoming.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
}

/** El botón destacado: la salida si ya pasó la hora de salir; si no, la primera acción permitida. */
export function primaryAction(today: AttendanceToday): AttendanceAction | undefined {
  const { session, actions } = today;
  if (session && actions.includes('CHECK_OUT') && !isAfter(session.scheduled_end, today)) return 'CHECK_OUT';
  return actions[0];
}

/**
 * Lo que se dice de los descansos con la jornada abierta, solo con lo que respondió el servidor
 * (`break_window`, `actions` y `now`): disponible y hasta cuándo, desde cuándo podrá, que su horario
 * ya terminó o que ya los tomó. Nada en descanso (corre su cuenta regresiva) ni sin descansos.
 */
export function breakWindowText(today: AttendanceToday): string | null {
  const { session, break_window: window } = today;
  if (session?.status !== 'OPEN' || !window || !session.breaks_allowed || openBreak(session)) return null;
  if (window.remaining === 0) return t('myAttendance.clock.breakWindow.taken');
  if (today.actions.includes('BREAK_START')) return t('myAttendance.clock.breakWindow.available', { time: formatTime(window.ends_at), duration: formatMinutes(window.minutes) });
  if (isAfter(window.starts_at, today)) return t('myAttendance.clock.breakWindow.opensAt', { time: formatTime(window.starts_at) });
  return isAfter(window.ends_at, today) ? null : t('myAttendance.clock.breakWindow.closed');
}
