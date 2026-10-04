// Turnos de trabajo, sitios con geocerca, asignaciones, solicitudes de cambio y la asistencia por turno.
// Las horas `HH:MM:SS` son de la hora del negocio; las fechas y horas completas viajan en UTC y se
// muestran con `formatDateTime` / `formatTime` (zona del negocio).

import type { DayOff } from './calendar';
import type { Address, Page, VerificationResult } from './index';

/** Días de la semana como los envía el backend: 0 = lunes ... 6 = domingo. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ---------- Sitios de trabajo ----------

/** Sitio de trabajo: checar en sitio es hacerlo a no más de `radius_m` metros de su punto. */
export interface WorkSite {
  id: number;
  name: string;
  address: Address;
  radius_m: number;
  active: boolean;
  /** Empleados que hoy pueden checar en este sitio (asignaciones vigentes). */
  employees: number;
  created_at: string;
}

export type WorkSiteList = Page<WorkSite>;

export interface WorkSitePayload {
  name: string;
  address: Address;
  radius_m: number;
}

/** Sitio resumido (asignaciones, "Mi asistencia"): su punto y su radio. */
export interface SiteRef {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
}

// ---------- Turnos ----------

export interface ShiftRef {
  id: number;
  name: string;
  /** "HH:MM:SS" (hora del negocio). */
  start_time: string;
  end_time: string;
  /** Termina al día siguiente (salida igual o antes que la entrada). */
  overnight: boolean;
  weekdays: Weekday[];
}

export interface Shift extends ShiftRef {
  breaks_count: number;
  break_minutes: number;
  early_check_in_minutes: number;
  late_tolerance_minutes: number;
  early_check_out_minutes: number;
  late_check_out_minutes: number;
  duration_minutes: number;
  active: boolean;
  /** Empleados con el turno vigente hoy. */
  employees: number;
  created_at: string;
}

export type ShiftList = Page<Shift>;

/** Alta y edición (el turno completo; "HH:MM"). */
export interface ShiftPayload {
  name: string;
  start_time: string;
  end_time: string;
  weekdays: Weekday[];
  breaks_count: number;
  break_minutes: number;
  early_check_in_minutes: number;
  late_tolerance_minutes: number;
  early_check_out_minutes: number;
  late_check_out_minutes: number;
}

// ---------- Asignaciones ----------

export type AssignmentState = 'CURRENT' | 'SCHEDULED' | 'ENDED';

export interface ShiftAssignment {
  id: number;
  shift: ShiftRef;
  valid_from: string;
  valid_to: string | null;
  remote_weekdays: Weekday[];
  sites: SiteRef[];
  state: AssignmentState;
  created_at: string;
}

export type ShiftAssignmentList = Page<ShiftAssignment>;

export interface AssignmentPayload {
  shift_id: number;
  /** "YYYY-MM-DD": con turno vigente, desde mañana o después. */
  valid_from: string;
  remote_weekdays: Weekday[];
  site_ids: number[];
}

// ---------- Solicitudes de cambio de turno ----------

export type ShiftRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface EmployeeRef {
  id: number;
  full_name: string;
  employee_number: string;
}

export interface ShiftRequest {
  id: number;
  employee: EmployeeRef;
  shift: ShiftRef;
  /** El turno que tenía al pedirlo (null si no tenía). */
  current_shift: ShiftRef | null;
  valid_from: string;
  reason: string;
  status: ShiftRequestStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type ShiftRequestList = Page<ShiftRequest>;

export interface ShiftRequestPayload {
  shift_id: number;
  valid_from: string;
  reason: string;
}

/** Aprobar: sin datos conserva la fecha pedida, los días remotos y los sitios que apliquen. */
export interface ShiftRequestApproval {
  valid_from?: string;
  remote_weekdays?: Weekday[];
  site_ids?: number[];
}

// ---------- Asistencia ----------

export type AttendanceAction = 'CHECK_IN' | 'BREAK_START' | 'BREAK_END' | 'CHECK_OUT';
/** COMPANY: lo registró o corrigió la empresa (sin rostro ni ubicación), con su motivo. */
export type WorkMode = 'ON_SITE' | 'REMOTE' | 'VALIDATOR' | 'COMPANY';
export type WorkSessionStatus = 'OPEN' | 'CLOSED' | 'MISSED_CHECKOUT';
/** En qué va cada empleado en el tablero del día. */
export type BoardState = 'SCHEDULED' | 'MISSING' | 'WORKING' | 'ON_BREAK' | 'DONE' | 'MISSED_CHECKOUT' | 'ABSENT' | 'DAY_OFF';

export interface WorkBreak {
  started_at: string;
  ended_at: string | null;
  minutes: number;
  exceeded_minutes: number;
}

/** La jornada de un turno (con lo programado al momento de entrar). */
export interface WorkSession {
  id: number;
  work_date: string;
  shift_name: string;
  scheduled_start: string;
  scheduled_end: string;
  check_out_deadline: string;
  status: WorkSessionStatus;
  check_in_at: string;
  check_in_mode: WorkMode;
  check_in_site: string | null;
  check_out_at: string | null;
  check_out_mode: WorkMode | null;
  check_out_site: string | null;
  late_minutes: number;
  early_leave_minutes: number;
  break_minutes: number;
  worked_minutes: number | null;
  breaks_allowed: number;
  break_minutes_allowed: number;
  breaks: WorkBreak[];
  /** La empresa la registró o la corrigió: cuándo y por qué (el empleado también lo ve). */
  edited_at?: string | null;
  edit_reason?: string | null;
}

/** Una jornada programada: su entrada, su salida y la ventana para checar. */
export interface Occurrence {
  work_date: string;
  start: string;
  end: string;
  /** Desde cuándo se puede checar la entrada. */
  opens: string;
  /** Límite para checar la salida. */
  deadline: string;
}

/** Cuándo puede tomar sus descansos: cuando quiera, dentro de su horario y mientras le queden. */
export interface BreakWindow {
  starts_at: string;
  ends_at: string;
  /** Minutos de cada descanso y cuántos le quedan. */
  minutes: number;
  remaining: number;
}

/** Qué puede hacer el empleado ahora y por qué (todo lo decide el servidor). */
export interface AttendanceToday {
  /** Hora del servidor (para mostrar cuánto falta sin confiar en el reloj del teléfono). */
  now: string;
  shift: ShiftRef | null;
  occurrence: Occurrence | null;
  next_occurrence: Occurrence | null;
  session: WorkSession | null;
  actions: AttendanceAction[];
  /** Hoy puede checar remoto; si no, solo en sus sitios. */
  remote_allowed: boolean;
  sites: SiteRef[];
  message: string;
  /** Hoy (o sus próximos días) no trabaja: festivo o ausencia aprobada. */
  day_off?: DayOff | null;
  /** Con jornada abierta: la ventana de sus descansos. */
  break_window?: BreakWindow | null;
}

/** Resultado de un registro: primero la verificación facial; si pasó, lo registrado. */
export interface AttendanceActionResult {
  verified: boolean;
  message: string;
  action: AttendanceAction;
  verification: VerificationResult;
  session: WorkSession | null;
}

export type AttendanceHistory = Page<WorkSession>;

export interface BoardRow {
  employee: EmployeeRef;
  department: string | null;
  shift_name: string;
  scheduled_start: string;
  scheduled_end: string;
  state: BoardState;
  session: WorkSession | null;
  /** Por qué no trabaja ese día (con DAY_OFF). */
  day_off?: DayOff | null;
}

/** El tablero de un día: los empleados con turno ese día y los conteos de sus jornadas. */
export interface AttendanceBoard extends Page<BoardRow> {
  work_date: string;
  working: number;
  on_break: number;
  done: number;
  missed_checkout: number;
  /** Quienes tienen turno ese día pero no lo trabajan (festivo o ausencia aprobada). */
  day_off?: number;
}

export interface CompanySession extends WorkSession {
  employee: EmployeeRef;
}

export type CompanySessionList = Page<CompanySession>;

/** Un registro de la bitácora (la evidencia de la jornada). */
export interface AttendanceEvent {
  action: AttendanceAction;
  mode: WorkMode;
  site: string | null;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  distance_m: number | null;
  /** Confianza de la verificación facial que lo respaldó. */
  confidence: number | null;
  /** Quién operó: el empleado (su correo), el validador (su nombre) o la empresa (su correo). */
  operator: string | null;
  /** Motivo de un registro de la empresa (modalidad COMPANY). */
  note?: string | null;
}

export interface CompanySessionDetail extends CompanySession {
  events: AttendanceEvent[];
}
