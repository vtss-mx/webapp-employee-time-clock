// Política de verificación de la empresa y evolución de su reconocimiento facial.

/** Política de verificación de la empresa (editable por COMPANY en Configuración). */
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
  // --- Candados contra engaños (cada uno lo activa o desactiva la empresa) ---
  /** Sensibilidad del anti-spoofing: código del catálogo antispoof_levels. */
  anti_spoofing_level: string;
  /** Giros aleatorios de la prueba de vida (1 o 2). */
  liveness_steps: number;
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
  /** Nombres de cámaras virtuales que no se aceptan (la app avisa antes de capturar). */
  blocked_cameras: string[];
  updated_at: string | null;
  updated_by: string | null;
}

export type VerificationPolicyUpdate = Partial<Omit<VerificationPolicy, 'updated_at' | 'updated_by' | 'blocked_cameras'>>;

/** Reglas que la app aplica en pantalla (el umbral de confianza solo lo evalúa el servidor). */
export type VerificationRules = Omit<VerificationPolicy, 'min_confidence' | 'updated_at' | 'updated_by'>;

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
