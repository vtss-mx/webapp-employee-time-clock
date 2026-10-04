// Política de verificación de la empresa y evolución de su reconocimiento facial.

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
  // --- Ubicación de los registros de asistencia (las evalúa solo el servidor) ---
  /** Precisión mínima (m) que debe informar el navegador; más imprecisa, se pide repetir. */
  max_location_accuracy_m: number;
  /** Rechazar un registro a una distancia imposible de recorrer desde el anterior. */
  detect_impossible_travel: boolean;
  /** Velocidad máxima creíble entre dos registros (km/h). */
  max_travel_kmh: number;
  /** Nombres de cámaras virtuales que no se aceptan (la app avisa antes de capturar). */
  blocked_cameras: string[];
  updated_at: string | null;
  updated_by: string | null;
}

export type VerificationPolicyUpdate = Partial<Omit<VerificationPolicy, 'updated_at' | 'updated_by' | 'blocked_cameras'>>;

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
