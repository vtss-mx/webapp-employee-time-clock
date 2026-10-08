// Política de verificación de la empresa y evolución de su reconocimiento facial.
import type { Page } from './index';

/** Política de verificación de la empresa (la configura el ADMIN de la plataforma; la empresa solo la lee). */
export interface VerificationPolicy {
  block_glasses: boolean;
  block_headwear: boolean;
  block_mask: boolean;
  liveness_challenge: boolean;
  anti_spoofing: boolean;
  qr_enabled: boolean;
  /** Los validadores de identidad solo operan desde una tableta o un teléfono. */
  validator_mobile_only: boolean;
  /** Confianza mínima: exactamente el `value` de un nivel activo del catálogo confidence_levels. */
  min_confidence: number;
  /** Confianza al identificar entre toda la plantilla (1:N, validadores); nunca rige por debajo de la 1:1. */
  identify_confidence: number;
  /** Calidad mínima de cada captura (0 = sin mínimo): detección, nitidez y luz combinadas. */
  min_capture_quality: number;
  // --- Candados contra engaños (cada uno se activa o desactiva por empresa) ---
  /** Sensibilidad del anti-spoofing: código del catálogo antispoof_levels. */
  anti_spoofing_level: string;
  /** Movimientos aleatorios de la prueba de vida (1 a 3: girar, mirar arriba o abajo, acercarse). */
  liveness_steps: number;
  /**
   * Movimientos de cabeza que la prueba de vida puede pedir (el servidor arma el reto con ellos). El ADMIN enciende o
   * apaga cada uno por empresa; deben quedar al menos DOS activos (el servidor responde 422 `LIVENESS_MOVES_MIN` si se
   * intenta dejar menos). Apagar uno relaja la seguridad (`SAFER_WHEN_ON`): pasa por la regla de dos personas.
   */
  enable_turn_right: boolean;
  enable_turn_left: boolean;
  enable_look_up: boolean;
  enable_look_down: boolean;
  /** Segundos para responder el reto completo (destello y movimientos; 20 a 180). */
  liveness_timeout_seconds: number;
  /** Destello de colores en la pantalla: código del catálogo flash_modes (OFF, OBSERVE, ENFORCE). */
  flash_liveness: string;
  block_virtual_cameras: boolean;
  reject_foreign_images: boolean;
  detect_static_captures: boolean;
  detect_replays: boolean;
  check_capture_continuity: boolean;
  enforce_human_timing: boolean;
  detect_duplicate_faces: boolean;
  lockout_enabled: boolean;
  lockout_max_failures: number;
  lockout_minutes: number;
  /** Cada dispositivo de un validador lo autoriza la empresa antes de operar. */
  validator_device_approval: boolean;
  /** Segundos que vive cada QR dinámico del empleado antes de renovarse solo. */
  qr_lifetime_seconds: number;
  /** Aprendizaje continuo: cada identificación segura enseña a la galería del empleado. */
  adaptive_learning: boolean;
  /**
   * Registro facial (decisión del dueño, 2026-10-06): tras las fotos, tres preguntas en video sobre los datos del
   * empleado (voz y rostro comparados en el servidor; la empresa revisa el video al validar).
   */
  voice_verification: boolean;
  /**
   * Guía por voz del registro facial (decisión del dueño, 2026-10-08): lee las indicaciones en voz alta con la síntesis
   * del propio dispositivo (sin servicios externos; regla 13). Es NEUTRAL: no es un candado de seguridad ni entra en la
   * regla de dos personas; la empresa y su personal la leen, el ADMIN la configura.
   */
  voice_guidance_enabled: boolean;
  /**
   * Voz con que se dictan las indicaciones: código del catálogo `voice_profiles`. Cada perfil fija género, tono y ritmo
   * en la app (`PROFILE_PARAMS` de `utils/speech.ts`); el servidor solo valida el código contra el catálogo.
   */
  voice_profile: string;
  // --- Ubicación de los registros de asistencia (las evalúa solo el servidor) ---
  /** Precisión mínima (m) que debe informar el navegador; más imprecisa, se pide repetir. */
  max_location_accuracy_m: number;
  /** Rechazar un registro a una distancia imposible de recorrer desde el anterior. */
  detect_impossible_travel: boolean;
  /** Velocidad máxima creíble entre dos registros (km/h). */
  max_travel_kmh: number;
  /**
   * Ubicación de cada verificación de identidad (empleado, validador y API pública), modo del catálogo `signal_modes`:
   * `OFF` no la pide, `OBSERVE` la registra (la empresa ve dónde se hizo cada verificación en el mapa) y `ENFORCE` la
   * exige —el servidor no completa una verificación sin una ubicación válida—. La define el ADMIN por empresa; la
   * decisión de bloquear la toma siempre el servidor (la app solo la envía). Distinto de `validator_location`, que es la
   * prueba de presencia del dispositivo del validador (antifraude 2b).
   */
  verification_location: string;
  /** Nombres de cámaras virtuales que no se aceptan (la app avisa antes de capturar). */
  blocked_cameras: string[];
  /** Un validador en modo QR registra asistencia con el QR solo (decisión del dueño: apagado en empresas nuevas). */
  qr_only_attendance: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

/** Una señal del motor de riesgo en esta empresa: la de la plataforma, la vigente y su línea base de casos. */
export interface RiskSignalSetting {
  code: string;
  name: string;
  description: string | null;
  /** Tipo de fraude que sugiere (catálogo `fraud_kinds`): su familia suma con tope. */
  kind: string;
  /** Regla dura: obligatoria, niega sin importar el puntaje. */
  hard: boolean;
  /** La informa el dispositivo (menos confiable). */
  client: boolean;
  default_points: number;
  default_mode: string;
  points: number;
  mode: string;
  confirmed: number;
  false_positive: number;
  /** Solo se mide: no se puede exigir (el pulso por video, hasta calibrarlo). */
  measure_only?: boolean;
}

/**
 * La política completa que configura el ADMIN: además de lo que leen la empresa y su personal, el motor de
 * riesgo y los controles antifraude (nunca viajan a la empresa).
 */
export interface AdminVerificationPolicy extends VerificationPolicy {
  /** Nivel de SOSPECHA de duplicado al registrarse (solo marca para la revisión): un `value` de confidence_levels. */
  duplicate_confidence: number;
  /** Dispositivo del empleado (catálogo `employee_device_modes`; la vinculación llega en la fase 2). */
  employee_device_mode: string;
  /** Último nivel predefinido aplicado (catálogo `policy_presets`); null = a la medida. */
  preset: string | null;
  risk_engine: boolean;
  risk_medium_score: number;
  risk_high_score: number;
  risk_critical_score: number;
  /** Acción de cada nivel (catálogo `risk_actions`). */
  risk_medium_action: string;
  risk_high_action: string;
  risk_critical_action: string;
  /** Si el motor falla: permitir, permitir y avisar o un paso más. */
  risk_fallback_action: string;
  /** Guardar fotogramas de evidencia de los intentos sospechosos (cifrados en el bucket). */
  fraud_evidence: boolean;
  /** Antifraude 2a: destello dictado por el servidor y ráfaga de recortes del rostro (nacen midiendo). */
  flash_paced: boolean;
  capture_burst: boolean;
  /**
   * Antifraude 2b (códigos del catálogo `signal_modes`): firma de cada identificación con la llave del dispositivo
   * del validador, su ubicación en cada identificación y el código de sitio al checar la entrada y la salida.
   */
  validator_signing: string;
  validator_location: string;
  site_codes: string;
  risk_signals: RiskSignalSetting[];
  /** Cambios que relajan la seguridad y esperan la aprobación de otro ADMIN. */
  pending_changes: number;
  /** La regla de dos personas está activa en la plataforma. */
  two_person_rule: boolean;
}

/** El ajuste de una señal (lo omitido queda como estaba). */
export interface RiskSignalUpdate {
  mode?: string;
  points?: number;
}

export type VerificationPolicyUpdate = Partial<Omit<VerificationPolicy, 'updated_at' | 'updated_by' | 'blocked_cameras'>>;

/** Cambio de la política del ADMIN (cualquier control, también el motor de riesgo) y su motivo opcional. */
export type AdminPolicyUpdate = VerificationPolicyUpdate &
  Partial<
    Pick<
      AdminVerificationPolicy,
      | 'duplicate_confidence'
      | 'employee_device_mode'
      | 'risk_engine'
      | 'risk_medium_score'
      | 'risk_high_score'
      | 'risk_critical_score'
      | 'risk_medium_action'
      | 'risk_high_action'
      | 'risk_critical_action'
      | 'risk_fallback_action'
      | 'fraud_evidence'
      | 'flash_paced'
      | 'capture_burst'
      | 'voice_verification'
      | 'validator_signing'
      | 'validator_location'
      | 'site_codes'
    >
  > & { risk_signals?: Record<string, RiskSignalUpdate>; reason?: string };

/** Un campo que cambió: antes → después y si relaja la seguridad (`risk_signals.<código>.<mode|points>`). */
export interface PolicyFieldChange {
  field: string;
  before: unknown;
  after: unknown;
  relaxes: boolean;
}

/** Cuántos intentos terminaron (o terminarían) en cada acción del motor. */
export interface SimulationActions {
  allow: number;
  alert: number;
  step_up: number;
  review: number;
  deny: number;
}

/** "¿Qué habría pasado en los últimos días con esta política?" (solo con lo que se midió en su momento). */
export interface RiskSimulation {
  days: number;
  evaluated: number;
  capped: boolean;
  current: SimulationActions;
  candidate: SimulationActions;
  stricter: number;
  looser: number;
  frauds_stopped: number;
  frauds: number;
  genuine_affected: number;
  top_reasons: { code: string; count: number }[];
}

/** Un cambio del historial de la política (catálogo `policy_change_statuses`). */
export interface PolicyChange {
  id: number;
  status: string;
  relaxes: boolean;
  preset: string | null;
  changes: PolicyFieldChange[];
  reason: string | null;
  simulation: RiskSimulation | null;
  requested_by: string;
  /** Lo pidió quien lo ve: puede cancelarlo, pero no aprobarlo ni rechazarlo. */
  requested_by_me: boolean;
  created_at: string;
  /** Hasta cuándo se puede aprobar (solo los pendientes). */
  expires_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

/** La política tras pedir un cambio y el cambio que quedó (null si no cambiaba nada; PENDING si relaja). */
export interface PolicyUpdateResult {
  policy: AdminVerificationPolicy;
  change: PolicyChange | null;
}

/** La configuración de riesgo que se quiere probar (lo omitido queda como la vigente). */
export type RiskPolicyCandidate = Partial<
  Pick<
    AdminVerificationPolicy,
    'risk_engine' | 'risk_medium_score' | 'risk_high_score' | 'risk_critical_score' | 'risk_medium_action' | 'risk_high_action' | 'risk_critical_action'
  >
> & { risk_signals?: Record<string, RiskSignalUpdate> };

/**
 * Reglas que la app aplica en pantalla (el umbral de confianza solo lo evalúa el servidor; la vida del
 * reto y el destello llegan en cada reto, `FaceChallenge`).
 */
export type VerificationRules = Omit<
  VerificationPolicy,
  | 'min_confidence'
  | 'identify_confidence'
  | 'min_capture_quality'
  | 'max_location_accuracy_m'
  | 'detect_impossible_travel'
  | 'max_travel_kmh'
  | 'liveness_timeout_seconds'
  | 'flash_liveness'
  // Los movimientos de la prueba de vida los decide el servidor en cada reto (`FaceChallenge`), no la app en pantalla.
  | 'enable_turn_right'
  | 'enable_turn_left'
  | 'enable_look_up'
  | 'enable_look_down'
  | 'qr_only_attendance'
  | 'updated_at'
  | 'updated_by'
>;

/** Evolución del reconocimiento facial de la empresa: lo que su galería aprendió del uso. */
export interface FaceLearningSummary {
  /** La empresa tiene activo el aprendizaje continuo. */
  enabled: boolean;
  approved_employees: number;
  /** Empleados con al menos una muestra aprendida. */
  employees_learning: number;
  learned_samples: number;
  /** Identificaciones exitosas decididas por las muestras vigentes. */
  identifications: number;
  /** De ellas, las que decidió una muestra aprendida. */
  learned_identifications: number;
  last_learned_at: string | null;
}

export type PolicyChangeList = Page<PolicyChange>;
