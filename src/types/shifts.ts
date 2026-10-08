// Turnos de trabajo, sitios con geocerca, asignaciones, solicitudes de cambio y la asistencia por turno.
// El turno dice DÓNDE y CUÁNDO se checa (horario, días, sitios y días remotos); una asignación es solo
// el empleado, el turno y desde cuándo (decisión del dueño del producto).
// Las horas `HH:MM:SS` son de la hora del negocio; las fechas y horas completas viajan en UTC y se
// muestran con `formatDateTime` / `formatTime` (zona del negocio).

import type { WithAvatar } from './avatar';
import type { DayOff } from './calendar';
import type { Address, Page, VerificationResult } from './index';
import type { DeletedFlag, SoftDeleted } from './trash';

/** Días de la semana como los envía el backend: 0 = lunes ... 6 = domingo. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ---------- Sitios de trabajo ----------

/** Sitio de trabajo: checar en sitio es hacerlo a no más de `radius_m` metros de su punto. */
export interface WorkSite extends SoftDeleted {
  id: number;
  name: string;
  address: Address;
  radius_m: number;
  active: boolean;
  /** Empleados que hoy pueden checar en este sitio (su turno vigente lo incluye). */
  employees: number;
  /** Antifraude 2b: la entrada y la salida piden el código que muestra el kiosco del sitio. */
  presence_code: boolean;
  /** Kioscos vigentes del sitio. */
  kiosks: number;
  created_at: string;
}

export type WorkSiteList = Page<WorkSite>;

export interface WorkSitePayload {
  name: string;
  address: Address;
  radius_m: number;
  presence_code: boolean;
}

/** Sitio donde se checa en persona (turnos, "Mi asistencia"): su domicilio, su punto y su radio. */
export interface SiteRef extends DeletedFlag {
  id: number;
  name: string;
  address: Address;
  latitude: number;
  longitude: number;
  radius_m: number;
  /** Desactivado: no acepta registros (el turno lo conserva hasta que la empresa lo quite). */
  active: boolean;
}

// ---------- Turnos ----------

export interface ShiftRef extends DeletedFlag {
  id: number;
  name: string;
  /** "HH:MM:SS" (hora del negocio). */
  start_time: string;
  end_time: string;
  /** Termina al día siguiente (salida igual o antes que la entrada). */
  overnight: boolean;
  weekdays: Weekday[];
  /** Días del turno en que se puede checar remoto; los demás, en uno de sus sitios. */
  remote_weekdays: Weekday[];
}

/** Turno con dónde se checa: su horario, sus días remotos y sus sitios (orden alfabético). */
export interface ShiftSummary extends ShiftRef {
  sites: SiteRef[];
}

export interface Shift extends ShiftSummary, SoftDeleted {
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

/** Alta y edición (el turno completo; "HH:MM"): cuándo y dónde se checa. */
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
  /** Sitios donde se checa en persona (obligatorio si algún día del turno no es remoto). */
  site_ids: number[];
  /** Días del turno en que se puede checar remoto. */
  remote_weekdays: Weekday[];
}

// ---------- Asignaciones ----------

export type AssignmentState = 'CURRENT' | 'SCHEDULED' | 'ENDED';

/** El turno de un empleado desde una fecha: dónde checa lo dice su turno (el de hoy). */
export interface ShiftAssignment extends SoftDeleted {
  id: number;
  shift: ShiftSummary;
  valid_from: string;
  valid_to: string | null;
  state: AssignmentState;
  created_at: string;
}

export type ShiftAssignmentList = Page<ShiftAssignment>;

/** Asignar es solo elegir el turno y desde cuándo. */
export interface AssignmentPayload {
  shift_id: number;
  /** "YYYY-MM-DD": con turno vigente, desde mañana o después. */
  valid_from: string;
}

// ---------- Solicitudes de cambio de turno ----------

export type ShiftRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface EmployeeRef extends DeletedFlag, WithAvatar {
  id: number;
  full_name: string;
  /** Opcional (decisión del dueño del producto): null = sin número. */
  employee_number: string | null;
}

export interface ShiftRequest {
  id: number;
  employee: EmployeeRef;
  /** El turno pedido con su horario y dónde se checa. */
  shift: ShiftSummary;
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

/** Aprobar: sin fecha conserva la pedida; dónde checa lo dice el turno pedido. */
export interface ShiftRequestApproval {
  valid_from?: string;
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
  /** "En revisión" (motor de riesgo; catálogo `attendance_review_statuses`): la empresa la confirma o la rechaza. */
  review_status?: string | null;
  /** Por qué, en términos del negocio (catálogo `review_reasons`); solo lo ve la empresa. */
  review_reasons?: string[];
  reviewed_at?: string | null;
  /** Nota de la empresa al decidir (la ve también el empleado). */
  review_note?: string | null;
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
  /** Hoy puede checar remoto (lo dice su turno); si no, solo en sus sitios. */
  remote_allowed: boolean;
  /** Los sitios activos de su turno. */
  sites: SiteRef[];
  /** Antifraude 2b: la entrada y la salida piden el código del kiosco del sitio (o, si es remoto, "No estoy en el sitio"). */
  site_code: boolean;
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
  /** Se guardó "en revisión" (riesgo alto del motor de riesgo). */
  under_review?: boolean;
}

export interface CompanySessionDetail extends CompanySession {
  events: AttendanceEvent[];
}
