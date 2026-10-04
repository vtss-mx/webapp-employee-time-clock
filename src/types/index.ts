import type { ApiKey, ApiKeyStatus, ApiScope } from './apiKeys';
import type { Department, DepartmentRef } from './departments';
import type { ErrorOccurrence, ErrorReport, ErrorSeverity, ErrorStatus } from './errors';
import type { Company, CompanyAdmin } from './platform';
import type { AssignmentState, AttendanceAction, BoardState, ShiftRequestStatus, WorkMode, WorkSessionStatus } from './shifts';

/**
 * Roles. ADMIN: plataforma (da de alta empresas). COMPANY: administra una empresa. EMPLOYEE: empleado.
 * VALIDATOR: validador de identidad de una empresa (tableta o teléfono; identifica a sus empleados).
 */
export type Role = 'ADMIN' | 'COMPANY' | 'EMPLOYEE' | 'VALIDATOR';

export type FaceStatus = 'NOT_ENROLLED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type EnrollmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface UserEmployeeInfo {
  id: number;
  employee_number: string;
  rfc?: string | null;
  curp?: string | null;
  nss?: string | null;
  phone?: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  active: boolean;
  headwear_exempt: boolean;
  face_status: FaceStatus;
  face_rejection_reason: string | null;
}

export interface User {
  id: number;
  email: string;
  /** Teléfono de la persona (E.164); único en la plataforma. */
  phone?: string | null;
  role: Role;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  employee: UserEmployeeInfo | null;
  /** Empresa en la que opera: la suya (COMPANY) o la elegida en la sesión (EMPLOYEE). */
  company?: UserCompanyInfo | null;
  /** Empresas en las que trabaja la persona (EMPLOYEE). Con varias, elige una al entrar. */
  memberships?: UserMembership[];
  /** Preferencias de la interfaz guardadas en la BD (siguen al usuario en cualquier dispositivo). */
  preferences?: UserPreferences;
  /** Módulos del menú que usan sus pantallas, en orden (los envía el backend con `screens`). */
  modules?: MenuModule[];
  /**
   * Pantallas del usuario, en orden: las decide el backend (permiso del rol en la BD y estado del
   * usuario). El menú y las rutas se arman solo con ellas.
   */
  screens: Screen[];
  /** Inicio del usuario (su primera pantalla); null si no tiene ninguna. */
  home: string | null;
  /** Zona horaria del negocio (hora del Centro): fechas y horas se muestran en ella. */
  timezone?: string;
}

/** Pantalla del usuario, tal como la envía el backend (catalog.screens). */
export interface Screen {
  code: string;
  name: string;
  /** Etiqueta corta: título de la barra superior en teléfonos (si no hay, `name`). */
  short_name: string | null;
  /** Ruta base: la opción del menú lleva aquí. */
  path: string;
  /** Nombre del ícono (lucide). */
  icon: string;
  /** Contador que acompaña la opción (p. ej. PENDING_ENROLLMENTS). */
  badge: string | null;
  /** Módulo del menú en que va (el menú lateral agrupa por módulo). */
  module?: string | null;
}

/** Módulo del menú (encabezado que agrupa pantallas), en el orden que envía el backend. */
export interface MenuModule {
  code: string;
  name: string;
  /** Nombre del ícono (lucide). */
  icon: string;
}

export interface UserPreferences {
  sidebar_collapsed: boolean;
}

/** Cuenta recordada en este dispositivo ("Recordar mi cuenta"). */
export interface RememberedAccount {
  email: string;
}

export interface UserCompanyInfo {
  id: number;
  name: string;
  active: boolean;
}

/** Un empleo de la persona (una empresa en la que trabaja). */
export interface UserMembership {
  /** Id del empleado en esa empresa. */
  id: number;
  company: UserCompanyInfo;
  active: boolean;
  face_status: FaceStatus;
}

// ---------- Listados paginados ----------

/** Contrato único de todo listado paginado del backend (`total` sin paginar; `size` = por página). */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/** Página que se pide: número (desde 1) y elementos por página. */
export interface PageQuery {
  page: number;
  size: number;
}

// ---------- Plataforma (ADMIN) ----------

export type CompanyAdminList = Page<CompanyAdmin>;

/**
 * Empleado de una empresa visto por el ADMIN de la plataforma: solo su ficha de trabajo, de solo
 * lectura (sin RFC, CURP, NSS, fecha de nacimiento ni nada biométrico: el backend no los envía).
 */
export interface CompanyEmployee {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  department_name: string | null;
  email: string;
  phone: string | null;
  active: boolean;
  face_status: FaceStatus;
  /** Cuánto aprendió el reconocimiento de sus identificaciones (solo cuántas muestras y cuándo). */
  face_learned_samples: number;
  face_last_learned_at: string | null;
}

export type CompanyEmployeeList = Page<CompanyEmployee>;

/** Detalle de una empresa: sus administradores se piden aparte, paginados (`adminService.admins`). */
export type CompanyDetail = Company;

export type CompanyList = Page<Company>;

/** Respuesta de /auth/login y /auth/refresh. El refresh token viaja en una cookie HttpOnly. */
export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  /** Segundos de vigencia del access token (12 h). */
  expires_in: number;
  expires_at: string;
  session_id: string;
  user: User;
}

/** Sesión en memoria (nunca se persiste el token). */
export interface Session {
  token: string;
  user: User;
  sessionId: string;
  expiresAt: number; // epoch ms
}

export interface DeviceSession {
  id: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  current: boolean;
}

export type DeviceSessionList = Page<DeviceSession>;

export interface Employee {
  id: number;
  user_id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  birth_date: string;
  /** null solo en empleados registrados antes de existir estos campos. */
  rfc: string | null;
  curp: string | null;
  nss: string | null;
  phone: string | null;
  email: string;
  /** La persona también trabaja en otra empresa con la misma cuenta. */
  shared_account?: boolean;
  active: boolean;
  headwear_exempt: boolean;
  face_status: FaceStatus;
  face_rejection_reason: string | null;
  latest_enrollment_id: number | null;
  has_face: boolean;
  /** Muestras activas del rostro (lo que el reconocimiento aprende del uso lo administra el ADMIN). */
  face_samples: number;
  /** Departamento al que está asignado (a lo más uno). */
  department_id?: number | null;
  department_name?: string | null;
  /** Departamentos de los que es responsable (solo en el detalle). */
  managed_departments?: DepartmentRef[];
  created_at: string;
  updated_at: string;
}

export type EmployeeList = Page<Employee>;

/** Resultado de solicitar nueva verificación de identidad a toda la empresa. */
export interface IdentityReverifySummary {
  /** Empleados con registro facial que deberán registrar su rostro de nuevo. */
  employees: number;
}

export interface EmployeeListParams {
  search?: string;
  active?: boolean;
  /** Solo los asignados a ese departamento. */
  department_id?: number;
  page?: number;
  size?: number;
}

export type DepartmentList = Page<Department>;
/** `as_of`: hora del servidor al armar la lista ("marcar como solucionados" no toca lo posterior). */
export type ErrorReportList = Page<ErrorReport> & { as_of: string };
export type ErrorOccurrenceList = Page<ErrorOccurrence>;

export interface EmployeeFormValues {
  first_name: string;
  last_name: string;
  birth_date: string;
  employee_number: string;
  rfc: string;
  curp: string;
  nss: string;
  /** 10 dígitos, sin espacios. */
  phone: string;
  email: string;
  password: string;
  /** Solo en el cliente: la contraseña repetida (no se envía). */
  password_confirm: string;
}

export type EmployeeUpdatePayload = Partial<EmployeeFormValues> & { headwear_exempt?: boolean };
/** Sin `password` cuando se vincula a una persona que ya tiene cuenta (conserva la suya). */
export type EmployeeCreatePayload = Omit<EmployeeFormValues, 'password' | 'password_confirm'> & { password?: string; headwear_exempt: boolean };

export interface EnrollmentSubmitResponse {
  enrollment_id: number;
  face_status: FaceStatus;
  message: string;
}

export interface FaceEnrollment {
  id: number;
  status: EnrollmentStatus;
  employee_id: number;
  employee_number: string;
  full_name: string;
  email: string;
  birth_date: string;
  employee_active: boolean;
  samples: number;
  quality_score: number;
  liveness_passed: boolean;
  /** Marcas para el revisor: accesorios que el empleado indicó no usar ("MASK"...) o "SPOOF". */
  flagged_accessories: string[];
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
}

export interface FaceEnrollmentDetail extends FaceEnrollment {
  photo: string | null;
}

export type FaceEnrollmentList = Page<FaceEnrollment>;

/**
 * QR DINÁMICO del empleado (lo genera en su teléfono): vive `lifetime_seconds` y sirve una sola vez.
 * La imagen lleva el token; no se descarga ni se imprime.
 */
export interface DynamicQr {
  id: number;
  employee_number: string;
  created_at: string;
  expires_at: string;
  lifetime_seconds: number;
  /** Lo que codifica el QR ("TCQR2:..."): el teléfono lo dibuja; sirve una sola vez. */
  content: string;
}

/** Estado de un QR emitido: vigente, ya usado, vencido o reemplazado/invalidado. */
export type QrState = 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';

export interface QrStatus {
  id: number;
  status: QrState;
  expires_at: string | null;
  used_at: string | null;
}

/** Para la empresa: solo la actividad del QR dinámico del empleado (no lo ve ni lo descarga). */
export interface EmployeeQrSummary {
  live: boolean;
  live_until: string | null;
  last_issued_at: string | null;
  last_used_at: string | null;
}

/** QR_FACE: doble factor del validador (el QR dice quién es y el rostro lo confirma). */
export type VerificationMethod = 'FACE' | 'QR' | 'QR_FACE';

/**
 * Movimientos que puede pedir la prueba de vida (catálogo `liveness_actions`): girar a la izquierda o
 * a la derecha (de la persona), mirar arriba, mirar abajo o acercarse a la cámara.
 */
export type LivenessAction = 'TURN_LEFT' | 'TURN_RIGHT' | 'LOOK_UP' | 'LOOK_DOWN' | 'MOVE_CLOSER';

/**
 * Reto de prueba de vida (de uso único): la pantalla destella los colores de `flash` (una captura por
 * color) y la persona hace cada movimiento de `actions` (una captura por movimiento), antes de
 * `expires_in` segundos. Los mínimos son los vigentes de la plataforma (se endurecen solos).
 */
export interface FaceChallenge {
  liveness_required: boolean;
  challenge_id: string | null;
  /** Primer movimiento (igual a `actions[0]`). */
  action: LivenessAction | null;
  instruction: string | null;
  /** Movimientos en orden (de uno a tres; nunca el mismo dos veces seguidas). */
  actions: LivenessAction[];
  instructions: string[];
  /** Giro mínimo (nariz respecto a los ojos / distancia entre ojos). */
  min_yaw_ratio: number | null;
  /** Cambio mínimo de la nariz entre ojos y boca al mirar arriba o abajo (contra las frontales). */
  min_pitch_delta: number | null;
  /** Cuántas veces debe crecer el ancho del rostro al acercarse (contra las frontales). */
  min_closer_scale: number | null;
  /** Colores del destello en orden ('#RRGGBB'); vacío si la empresa no lo usa. */
  flash: string[];
  /** El destello es obligatorio (sin él, el servidor responde LIVENESS_REQUIRED); si no, solo se mide. */
  flash_required: boolean;
  /** Segundos de vida del reto (política de la empresa). */
  expires_in: number | null;
}

export interface FaceCheckResult {
  ok: boolean;
  message: string;
  detection_score: number;
  quality_score: number;
  yaw_ratio: number | null;
}

export interface VerificationResult {
  verified: boolean;
  method: VerificationMethod;
  message: string;
  employee_id?: number | null;
  employee_number?: string | null;
  name?: string | null;
  confidence?: number | null;
  verified_at?: string | null;
  /** Validadores: lo que la identificación registró en la asistencia (entrada o salida del turno). */
  attendance?: ValidatorAttendance | null;
}

/** `action`: CHECK_IN o CHECK_OUT; null si no registró nada (sin turno ahora o doble lectura). */
export interface ValidatorAttendance {
  action: 'CHECK_IN' | 'CHECK_OUT' | null;
  message: string;
}

export interface VerificationLog {
  id: number;
  method: VerificationMethod;
  success: boolean;
  score: number | null;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
}

export type VerificationLogList = Page<VerificationLog>;

// ---------- Validadores de identidad (VALIDATOR) ----------

/** QR, rostro, cualquiera de los dos (el operador elige) o ambos (el rostro confirma al dueño del QR). */
export type ValidatorMode = 'QR' | 'FACE' | 'QR_OR_FACE' | 'QR_AND_FACE';

export interface Validator {
  id: number;
  name: string;
  email: string;
  mode: ValidatorMode;
  active: boolean;
  last_login_at: string | null;
  identifications_today: number;
  created_at: string;
  /** null: dado de alta antes de pedir el domicilio (se completa al editarlo). */
  address: Address | null;
  location_required: boolean;
  location_radius_m: number | null;
  /** Dispositivos por autorizar y autorizados. */
  devices_pending: number;
  devices_approved: number;
}

export type ValidatorList = Page<Validator>;

/** Estado de un dispositivo de validador (catálogo device_statuses). */
export type DeviceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

/** Tableta o teléfono en que inició sesión un validador (la empresa lo autoriza). */
export interface ValidatorDevice {
  id: number;
  name: string;
  user_agent: string | null;
  status: DeviceStatus;
  created_at: string;
  last_seen_at: string | null;
  last_ip: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export type ValidatorDeviceList = Page<ValidatorDevice>;

/** Domicilio con su punto en el mapa (contrato del backend: `app/schemas/address.py`). */
export interface Address {
  street: string;
  exterior_number: string;
  interior_number: string | null;
  postal_code: string;
  /** ISO 3166-1 alfa-2 (catálogo de países). */
  country_code: string;
  state: string;
  municipality: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}

/** Datos del validador que se guardan en el alta y la edición (sin la cuenta). */
export interface ValidatorSettings {
  name: string;
  mode: ValidatorMode;
  address: Address;
  /** Solo inicia sesión a no más de `location_radius_m` metros del punto del domicilio. */
  location_required: boolean;
  location_radius_m: number | null;
}

export interface ValidatorCreatePayload extends ValidatorSettings {
  email: string;
  password: string;
}

/** Configuración del validador autenticado. */
export interface CheckpointProfile {
  id: number;
  name: string;
  mode: ValidatorMode;
  company: UserCompanyInfo;
  liveness_required: boolean;
  qr_enabled: boolean;
}

/** Dueño de un QR (paso 1 del modo QR y rostro). */
export interface CheckpointEmployee {
  employee_id: number;
  name: string;
  employee_number: string;
}

export interface CheckpointEvent {
  id: number;
  created_at: string;
  method: VerificationMethod;
  success: boolean;
  reason: string | null;
  confidence: number | null;
  employee_name: string | null;
  employee_number: string | null;
}

export type CheckpointEventList = Page<CheckpointEvent>;

// ---------- Catálogos de la BD (GET /api/catalogs) ----------

/**
 * Registro de un catálogo. Las listas llegan ordenadas por `sort_order` e incluyen los inactivos,
 * que solo sirven para nombrar registros históricos (nunca se ofrecen en listas de selección).
 */
export interface CatalogItem<Code extends string = string> {
  code: Code;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

/** Tono visual de un estado; la clase CSS de cada tono vive en el código. */
export type StatusTone = 'muted' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusItem<Code extends string = string> extends CatalogItem<Code> {
  tone: StatusTone;
}

/** `description` es el texto para la empresa; `employee_note`, el del propio empleado. */
export interface FaceStatusItem extends StatusItem<FaceStatus> {
  employee_note: string;
}

export interface ValidatorModeItem extends CatalogItem<ValidatorMode> {
  /** Métodos de identificación que permite el modo, en orden (códigos de verification_methods). */
  methods: VerificationMethod[];
}

/** `name` es la etiqueta corta de la bitácora; `message`, lo que ve la persona. */
export interface ReasonItem extends CatalogItem {
  message: string;
}

export interface AccessoryItem extends CatalogItem {
  /** Con artículo, para armar frases: "los lentes", "la gorra o sombrero". */
  phrase: string;
}

export interface CountryItem extends CatalogItem {
  /** Lada con "+": "+52". `code` es el ISO alfa-2. */
  dial_code: string;
  /** País frecuente: va primero en el selector de lada. */
  featured: boolean;
}

/** Nivel de confianza; `sort_order` es su posición en el control (80 … 100). */
export interface ConfidenceLevelItem extends CatalogItem {
  value: number;
  similarity: number;
  /** % de impostores aceptados y % de capturas legítimas rechazadas (medidos en LFW). */
  false_accept_rate: number;
  rejection_rate: number;
}

/** Sensibilidad del anti-spoofing que la empresa puede exigir. */
export interface AntispoofLevelItem extends CatalogItem {
  /** Probabilidad de rostro real por debajo de la cual una captura parece foto, pantalla o video. */
  threshold: number;
  /** Basta una sola captura sospechosa para rechazar (si no, decide la mayoría). */
  any_frame: boolean;
}

export interface FaceErrorItem extends ReasonItem {
  /** La persona puede corregir (luz, pose, accesorios...) y volver a intentar. */
  retryable: boolean;
}

/** Tipo de ausencia: `phrase` es lo que se le dice al empleado; `requestable`, si él lo puede pedir. */
export interface DayOffTypeItem extends StatusItem {
  phrase: string;
  requestable: boolean;
}

export interface Catalogs {
  roles: CatalogItem<Role>[];
  verification_methods: CatalogItem<VerificationMethod>[];
  validator_modes: ValidatorModeItem[];
  face_statuses: FaceStatusItem[];
  enrollment_statuses: StatusItem<EnrollmentStatus>[];
  device_statuses: StatusItem<DeviceStatus>[];
  /** Permisos que puede tener una llave de la API de integración. */
  api_scopes: CatalogItem<ApiScope>[];
  api_key_statuses: StatusItem<ApiKeyStatus>[];
  /** Seguimiento y gravedad de los errores del sistema (pantalla del ADMIN). */
  error_statuses: StatusItem<ErrorStatus>[];
  error_severities: StatusItem<ErrorSeverity>[];
  verification_reasons: ReasonItem[];
  accessories: AccessoryItem[];
  countries: CountryItem[];
  enrollment_rejection_reasons: CatalogItem[];
  reverification_reasons: CatalogItem[];
  confidence_levels: ConfidenceLevelItem[];
  antispoof_levels: AntispoofLevelItem[];
  /** Destello de colores de la prueba de vida: apagado, solo medir u obligatorio (con su descripción). */
  flash_modes: CatalogItem[];
  face_errors: FaceErrorItem[];
  /** Marcas del registro facial para el revisor (códigos de `flagged_accessories`). */
  enrollment_flags: CatalogItem[];
  /** Asistencia por turno: cómo se checó, cada registro, el estado de la jornada y de una solicitud. */
  work_modes: CatalogItem<WorkMode>[];
  attendance_actions: CatalogItem<AttendanceAction>[];
  work_session_statuses: StatusItem<WorkSessionStatus>[];
  shift_request_statuses: StatusItem<ShiftRequestStatus>[];
  /** En qué va cada empleado en el tablero del día y la vigencia de una asignación de turno. */
  board_states: StatusItem<BoardState>[];
  assignment_states: StatusItem<AssignmentState>[];
  /** Calendario: tipos de ausencia y motivos sugeridos al registrar o corregir una jornada. */
  day_off_types: DayOffTypeItem[];
  attendance_edit_reasons: CatalogItem[];
}

export type CatalogKey = keyof Catalogs;
export type CatalogEntry<K extends CatalogKey> = Catalogs[K][number];

export type { ApiKey, ApiKeyCreated, ApiKeyCreatePayload, ApiKeyStatus, ApiScope } from './apiKeys';
export type { FaceLearningSummary, VerificationPolicy, VerificationPolicyUpdate, VerificationRules } from './policy';
export type { Department, DepartmentPayload, DepartmentPerson, DepartmentRef } from './departments';
export type { ApiDemand, ErrorContext, ErrorOccurrence, ErrorReport, ErrorReportDetail, ErrorSeverity, ErrorStatus, ErrorSummary, ServerStatus } from './errors';
export type { Company, CompanyAdmin, CompanyFormValues, CompanyListParams, PlatformStats } from './platform';
export type { AvailabilityResult, AvailabilityState, AvailabilityStatus, EmployeeUniqueField, FieldStatus, LiveChecks } from './forms';

export type ApiKeyList = Page<ApiKey>;
// Turnos, sitios, asignaciones, solicitudes de cambio y asistencia por turno.
export type * from './shifts';
// Calendario de días libres, operaciones masivas y jornadas que registra la empresa.
export type * from './calendar';
