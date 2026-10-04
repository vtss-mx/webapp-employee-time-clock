import { paths } from '../../routes/paths';
import { fieldErrorsFrom } from '../../services/apiClient';
import type { BreakTimes, ManualTimesPayload, WorkSession } from '../../types';
import type { FieldLabels } from '../../utils/changes';
import { formatTime } from '../../utils/format';
import { clockMinutes } from '../shifts/shiftRules';
import { parseIso } from '../ui/DateField';

/**
 * Reglas puras de la jornada que registra o corrige la empresa (solo para guiar: el backend vuelve a
 * validar todo con las mismas reglas del registro en vivo). Las horas son "HH:MM" de la hora del
 * negocio; las de un turno nocturno después de medianoche son del día siguiente (lo resuelve el
 * servidor), por eso aquí no se comparan entre sí.
 */

/** Lo que se captura: el día (solo al registrar), entrada, salida (o "aún no sale"), descansos y motivo. */
export interface ManualValues {
  work_date: string;
  check_in: string;
  check_out: string;
  /** Sin salida: la jornada queda abierta (o "Sin salida" si ya venció su límite). */
  stillWorking: boolean;
  breaks: BreakTimes[];
  reason: string;
}

export type ManualField = 'work_date' | 'check_in' | 'check_out' | 'breaks' | 'reason';
export type ManualErrors = Partial<Record<ManualField, string>>;

const FIELDS: readonly ManualField[] = ['work_date', 'check_in', 'check_out', 'breaks', 'reason'];

/** Mínimo del motivo (el mismo del backend; el máximo, 500, lo limita el campo). */
export const REASON_MIN = 5;

/** Registrar la asistencia de un empleado en un día (enlace del tablero). */
export function newSessionPath(employeeId: number, workDate: string): string {
  return `${paths.company.newAttendanceSession}?${new URLSearchParams({ employee: String(employeeId), date: workDate }).toString()}`;
}

/** El motivo como lo guarda el backend: sin espacios de más. */
export const normalizeReason = (reason: string) => reason.trim().replace(/\s+/g, ' ');

const isClock = (value: string) => clockMinutes(value) !== null;

function dateProblem(value: string, today: string): string | undefined {
  if (!value) return 'Elige el día que trabajó';
  if (!parseIso(value)) return 'Escribe una fecha válida (dd/mm/aaaa)';
  return value > today ? 'No puede ser un día futuro' : undefined;
}

/** Errores de lo capturado; `withDate`: al registrar se elige el día (al corregir ya es el de la jornada). */
export function validateManual(values: ManualValues, { today, withDate }: { today: string; withDate: boolean }): ManualErrors {
  return {
    work_date: withDate ? dateProblem(values.work_date, today) : undefined,
    check_in: isClock(values.check_in) ? undefined : 'Indica la hora de entrada',
    check_out: values.stillWorking || isClock(values.check_out) ? undefined : 'Indica la hora de salida o marca «Aún no sale»',
    breaks: values.breaks.every((item) => isClock(item.start) && isClock(item.end)) ? undefined : 'Indica el inicio y el fin de cada descanso (o quítalo)',
    reason: normalizeReason(values.reason).length < REASON_MIN ? `Explica brevemente el motivo (al menos ${REASON_MIN} caracteres)` : undefined,
  };
}

/** Lo que se envía: las horas, la salida (null si aún no sale), los descansos y el motivo. */
export function manualTimes(values: ManualValues): ManualTimesPayload {
  return {
    check_in: values.check_in,
    check_out: values.stillWorking ? null : values.check_out,
    breaks: values.breaks.map(({ start, end }) => ({ start, end })),
    reason: normalizeReason(values.reason),
  };
}

/** Un registro nuevo: solo el día; las horas y el motivo los escribe la empresa. */
export const emptyValues = (workDate: string): ManualValues => ({ work_date: workDate, check_in: '', check_out: '', stillWorking: false, breaks: [], reason: '' });

/**
 * Corregir: lo registrado, en la hora del negocio. Una jornada abierta sigue sin salida ("Aún no
 * sale"); una que venció sin salida espera que se escriba. Un descanso en curso queda sin fin.
 */
export function sessionValues(session: WorkSession): ManualValues {
  return {
    work_date: session.work_date,
    check_in: formatTime(session.check_in_at),
    check_out: session.check_out_at ? formatTime(session.check_out_at) : '',
    stillWorking: session.status === 'OPEN',
    breaks: session.breaks.map((item) => ({ start: formatTime(item.started_at), end: item.ended_at ? formatTime(item.ended_at) : '' })),
    reason: '',
  };
}

/** Lo que se confirma de la jornada (registrar: lo que se guarda; corregir: lo que cambia). */
export interface ManualFacts {
  check_in: string;
  check_out: string;
  breaks: string;
}

export const MANUAL_LABELS: FieldLabels<ManualFacts> = { check_in: 'Entrada', check_out: 'Salida', breaks: 'Descansos' };

/** Entrada, salida (o "Aún no sale") y descansos ("13:00 – 13:30, 16:00 – 16:15" o "Sin descansos"). */
export function manualFacts(values: ManualValues): ManualFacts {
  return {
    check_in: values.check_in,
    check_out: values.stillWorking ? 'Aún no sale' : values.check_out,
    breaks: values.breaks.length ? values.breaks.map((item) => `${item.start} – ${item.end}`).join(', ') : 'Sin descansos',
  };
}

/**
 * Errores del servidor en su campo: los de cada hora (`check_in`, `check_out`, `breaks` o
 * `breaks.0.end`) y los del día (sin turno, día libre, ya registrada) en el día.
 */
export function manualServerErrors(error: unknown): ManualErrors {
  const raw = fieldErrorsFrom<Record<string, string>>(error, { NO_SHIFT_THAT_DAY: 'work_date', DAY_OFF: 'work_date', ATTENDANCE_SESSION_EXISTS: 'work_date' });
  const errors: ManualErrors = {};
  for (const [field, message] of Object.entries(raw)) {
    const key = FIELDS.find((name) => field.split('.')[0] === name);
    if (key) errors[key] ??= message;
  }
  return errors;
}
