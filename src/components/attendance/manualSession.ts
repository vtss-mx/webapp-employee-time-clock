import { t } from '../../i18n';
import { paths } from '../../routes/paths';
import { fieldErrorsFrom } from '../../services/apiClient';
import type { BreakTimes, ManualTimesPayload, WorkSession } from '../../types';
import type { FieldLabels } from '../../utils/changes';
import { businessTimeZone, localeDateFormat, timeStyle } from '../../utils/format';
import { dateError } from '../calendar/calendarRules';
import { clockMinutes } from '../shifts/shiftRules';
import { pad2 } from '../ui/clock';

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

/**
 * Hora "HH:MM" (24 h) de un instante en la zona del negocio: el valor que captura `TimeField`, igual
 * en todo idioma (la que se MUESTRA es `formatTime` o `clockLabel`, con el formato del idioma).
 */
export function businessClock(instant: string): string {
  const parts = localeDateFormat({ hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: businessTimeZone() }).formatToParts(new Date(instant));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${pad2(Number(value.hour))}:${pad2(Number(value.minute))}`;
}

/** Una hora capturada ("HH:MM") como se lee en el idioma activo: "07:55" (es-MX) o "7:55 AM" (en-US); incompleta, tal cual. */
export function clockLabel(value: string): string {
  const minutes = clockMinutes(value);
  if (minutes === null) return value;
  return localeDateFormat({ ...timeStyle(), timeZone: 'UTC' }).format(Date.UTC(1970, 0, 1, Math.floor(minutes / 60), minutes % 60));
}

function dateProblem(value: string, today: string): string | undefined {
  return dateError(value, t('attendance.manual.validation.dateMissing')) ?? (value > today ? t('attendance.manual.validation.dateFuture') : undefined);
}

/** Errores de lo capturado; `withDate`: al registrar se elige el día (al corregir ya es el de la jornada). */
export function validateManual(values: ManualValues, { today, withDate }: { today: string; withDate: boolean }): ManualErrors {
  return {
    work_date: withDate ? dateProblem(values.work_date, today) : undefined,
    check_in: isClock(values.check_in) ? undefined : t('attendance.manual.validation.checkIn'),
    check_out: values.stillWorking || isClock(values.check_out) ? undefined : t('attendance.manual.validation.checkOut'),
    breaks: values.breaks.every((item) => isClock(item.start) && isClock(item.end)) ? undefined : t('attendance.manual.validation.breaks'),
    reason: normalizeReason(values.reason).length < REASON_MIN ? t('attendance.manual.validation.reason', { min: REASON_MIN }) : undefined,
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
    check_in: businessClock(session.check_in_at),
    check_out: session.check_out_at ? businessClock(session.check_out_at) : '',
    stillWorking: session.status === 'OPEN',
    breaks: session.breaks.map((item) => ({ start: businessClock(item.started_at), end: item.ended_at ? businessClock(item.ended_at) : '' })),
    reason: '',
  };
}

/** Lo que se confirma de la jornada (registrar: lo que se guarda; corregir: lo que cambia). */
export interface ManualFacts {
  check_in: string;
  check_out: string;
  breaks: string;
}

/** Etiquetas de lo que se confirma, en el idioma activo. */
export const manualLabels = (): FieldLabels<ManualFacts> => ({
  check_in: t('attendance.fields.checkIn'),
  check_out: t('attendance.fields.checkOut'),
  breaks: t('attendance.fields.breaks'),
});

/**
 * Entrada, salida (o "Aún no sale") y descansos ("13:00 – 13:30, 16:00 – 16:15" o "Sin descansos"),
 * con las horas como se leen en el idioma activo.
 */
export function manualFacts(values: ManualValues): ManualFacts {
  return {
    check_in: clockLabel(values.check_in),
    check_out: values.stillWorking ? t('attendance.manual.stillWorking') : clockLabel(values.check_out),
    breaks: values.breaks.length ? values.breaks.map((item) => `${clockLabel(item.start)} – ${clockLabel(item.end)}`).join(', ') : t('attendance.breaks.noBreaks'),
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
