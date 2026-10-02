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

// ---------- Plataforma (ADMIN) ----------

export interface Company {
  id: number;
  name: string;
  legal_name: string | null;
  rfc: string | null;
  contact_email: string | null;
  phone: string | null;
  active: boolean;
  max_employees: number | null;
  employee_count: number;
  admin_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyAdmin {
  id: number;
  email: string;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface CompanyDetail extends Company {
  admins: CompanyAdmin[];
}

export interface CompanyList {
  items: Company[];
  total: number;
  page: number;
  size: number;
}

export interface CompanyListParams {
  search?: string;
  active?: boolean;
  page?: number;
  size?: number;
}

/** Formulario de empresa; los datos del administrador solo se capturan al dar de alta. */
export interface CompanyFormValues {
  name: string;
  legal_name: string;
  rfc: string;
  contact_email: string;
  /** 10 dígitos. */
  phone: string;
  /** Vacío = sin límite. */
  max_employees: string;
  admin_email: string;
  admin_password: string;
}

export interface PlatformStats {
  companies: number;
  active_companies: number;
  employees: number;
  company_admins: number;
}

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
  face_samples: number;
  has_active_qr: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeList {
  items: Employee[];
  total: number;
  page: number;
  size: number;
}

export interface EmployeeListParams {
  search?: string;
  active?: boolean;
  page?: number;
  size?: number;
}

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
}

export type EmployeeUpdatePayload = Partial<EmployeeFormValues> & { headwear_exempt?: boolean };
/** Sin `password` cuando se vincula a una persona que ya tiene cuenta (conserva la suya). */
export type EmployeeCreatePayload = Omit<EmployeeFormValues, 'password'> & { password?: string; headwear_exempt: boolean };

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

export interface FaceEnrollmentList {
  items: FaceEnrollment[];
  total: number;
  page: number;
  size: number;
}

export interface EmployeeQr {
  id: number;
  employee_id: number;
  employee_number: string;
  active: boolean;
  created_at: string;
  expires_at: string | null;
  image_base64: string;
  file_name: string;
}

/** QR_FACE: doble factor del validador (el QR dice quién es y el rostro lo confirma). */
export type VerificationMethod = 'FACE' | 'QR' | 'QR_FACE';

export type TurnAction = 'TURN_LEFT' | 'TURN_RIGHT';

export interface FaceChallenge {
  liveness_required: boolean;
  challenge_id: string | null;
  action: TurnAction | null;
  instruction: string | null;
  min_yaw_ratio: number | null;
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

/** Política de verificación de la empresa (editable por COMPANY en Configuración). */
export interface VerificationPolicy {
  block_glasses: boolean;
  block_headwear: boolean;
  block_mask: boolean;
  liveness_challenge: boolean;
  anti_spoofing: boolean;
  qr_enabled: boolean;
  employee_mobile_only: boolean;
  /** Los validadores de identidad solo operan desde una tableta o un teléfono. */
  validator_mobile_only: boolean;
  /** Confianza mínima (0.80-0.999) para aceptar el reconocimiento facial. */
  min_confidence: number;
  updated_at: string | null;
  updated_by: string | null;
}

export type VerificationPolicyUpdate = Partial<Omit<VerificationPolicy, 'updated_at' | 'updated_by'>>;

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
}

export interface ValidatorFormValues {
  name: string;
  email: string;
  password: string;
  mode: ValidatorMode;
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
