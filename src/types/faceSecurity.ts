// Seguridad facial automática de la plataforma (solo el ADMIN): GET /api/admin/face-security.

/** Un umbral de la prueba de vida o del anti-spoofing: el vigente frente a su piso y su tope. */
export interface SecurityThreshold {
  /** LIVENESS_YAW, LIVENESS_PITCH, LIVENESS_CLOSER, FLASH_SCORE, ANTISPOOF_REAL... */
  key: string;
  name: string;
  value: number;
  /** Mínimo de la configuración: la autocalibración nunca baja de aquí. */
  floor: number;
  /** Tope: la autocalibración nunca sube de aquí (para no dejar fuera a personas reales). */
  cap: number;
  /** Intentos exitosos medidos en el último cálculo. */
  samples: number;
  computed_at: string | null;
  /** La plataforma lo endureció por encima del mínimo. */
  raised: boolean;
}

/** Empresa con intentos sospechosos recientes: sus retos piden el máximo de movimientos. */
export interface AttackedCompany {
  company_id: number;
  name: string;
  attacks: number;
}

/** Lo medido del destello de colores en los intentos exitosos de la ventana. */
export interface FlashObservation {
  measured: number;
  conclusive: number;
  /** Con tanta luz ambiente que el destello casi no se notó. */
  inconclusive: number;
  score_median: number | null;
  score_p10: number | null;
  magnitude_median: number | null;
}

export interface FaceSecurityOverview {
  autocalibration: boolean;
  window_days: number;
  min_samples: number;
  interval_hours: number;
  thresholds: SecurityThreshold[];
  escalation_min_attacks: number;
  escalation_window_minutes: number;
  reinforced: AttackedCompany[];
  flash: FlashObservation;
}
