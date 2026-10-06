// Calendario de días libres (festivos, ausencias y días laborables especiales), operaciones para
// varios empleados a la vez y la jornada que registra o corrige la empresa. Las fechas son días del
// calendario de la hora del negocio ("YYYY-MM-DD"); un rango incluye ambos extremos.

import type { Page } from './index';
import type { EmployeeRef, ShiftRequestStatus } from './shifts';
import type { SoftDeleted } from './trash';

/** Tipo de ausencia (catalog.day_off_types); un festivo es HOLIDAY. */
export type DayOffKind = 'HOLIDAY' | 'VACATION' | 'PERMISSION' | 'SICK_LEAVE' | 'OTHER' | (string & {});

/** Por qué un día no se trabaja (lo calcula el servidor). */
export interface DayOff {
  kind: DayOffKind;
  /** Nombre del festivo ("Navidad") o del tipo de ausencia ("Vacaciones"). */
  name: string;
  /** El día al que aplica (el de la jornada: un turno nocturno es del día en que entra). */
  work_date: string;
  starts_on: string;
  ends_on: string;
}

// ---------- Operaciones para varios empleados ----------

export type BulkResultCode = 'DONE' | 'UNCHANGED' | 'SKIPPED';

/** Lo que pasó con un empleado: hecho, sin cambios (ya lo tenía) u omitido con su motivo. */
export interface BulkOutcome {
  employee: EmployeeRef;
  result: BulkResultCode;
  code: string | null;
  message: string | null;
}

export interface BulkResult {
  done: number;
  unchanged: number;
  skipped: number;
  results: BulkOutcome[];
}

/** Ids de los empleados de un filtro del listado (a lo más `limit`) y cuántos son. */
export interface EmployeeIdList {
  ids: number[];
  total: number;
  limit: number;
}

/** El mismo turno desde la misma fecha para varios empleados (dónde checan lo dice el turno). */
export interface BulkAssignmentPayload {
  shift_id: number;
  employee_ids: number[];
  valid_from: string;
}

// ---------- Festivos ----------

export interface Holiday extends SoftDeleted {
  id: number;
  holiday_date: string;
  name: string;
  /** Oficial (Ley Federal del Trabajo, art. 74) o propio de la empresa. */
  official: boolean;
  created_at: string;
}

export type HolidayList = Page<Holiday>;

export interface HolidayPayload {
  holiday_date: string;
  name: string;
}

/** Lo que agregó "Agregar festivos oficiales del año" (solo los que faltaban). */
export interface OfficialHolidaysResult {
  year: number;
  added: Holiday[];
  existing: number;
}

// ---------- Ausencias ----------

export interface Absence {
  id: number;
  employee: EmployeeRef;
  type: DayOffKind;
  starts_on: string;
  ends_on: string;
  days: number;
  note: string | null;
  /** Mismos estados que una solicitud de cambio de turno (catalog.shift_request_statuses). */
  status: ShiftRequestStatus;
  /** La pidió el propio empleado (si no, la registró la empresa). */
  requested_by_employee: boolean;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export type AbsenceList = Page<Absence>;

/** El empleado pide vacaciones o un permiso. */
export interface AbsenceRequestPayload {
  type: string;
  starts_on: string;
  ends_on: string;
  note?: string | null;
}

/** La empresa registra una ausencia (aprobada) para uno o varios empleados. */
export interface AbsencePayload extends AbsenceRequestPayload {
  employee_ids: number[];
}

// ---------- Días laborables especiales ----------

export interface Workday extends SoftDeleted {
  id: number;
  employee: EmployeeRef;
  work_date: string;
  note: string | null;
  created_at: string;
}

export type WorkdayList = Page<Workday>;

export interface WorkdayPayload {
  employee_id: number;
  work_date: string;
  note?: string | null;
}

// ---------- Asistencia registrada por la empresa ----------

/** Un descanso declarado ("HH:MM", hora del negocio). */
export interface BreakTimes {
  start: string;
  end: string;
}

/** Horas de la jornada ("HH:MM"); sin salida queda abierta (o sin salida si ya venció). */
export interface ManualTimesPayload {
  check_in: string;
  check_out: string | null;
  breaks: BreakTimes[];
  reason: string;
}

export interface ManualSessionPayload extends ManualTimesPayload {
  employee_id: number;
  work_date: string;
}
