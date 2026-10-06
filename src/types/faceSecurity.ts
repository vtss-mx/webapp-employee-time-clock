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
  /** La plataforma lo endureció (un mínimo que subió o, si es un máximo, que bajó). */
  raised: boolean;
  /** Es un MÁXIMO (el moiré, antifraude 2a): parte de su tope y se endurece bajando hacia su piso. */
  upper?: boolean;
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
  /** Cociente rostro/fondo de las mediciones concluyentes (≈ 1: una pantalla o un papel; un rostro real, más). */
  ratio_median: number | null;
  ratio_p10: number | null;
}

/** Lo medido del protocolo de captura (antifraude 2a) en los intentos exitosos de la ventana. */
export interface CaptureProtocolObservation {
  /** Intentos con destello medido; de ellos, dictados por el servidor y fuera de su ventana. */
  flash_attempts: number;
  paced: number;
  late: number;
  /** Respuesta de un color dictado (ms; la más lenta de cada intento): típica y del 95 %, y la ventana. */
  pace_p50_ms: number | null;
  pace_p95_ms: number | null;
  window_ms: number;
  /** Intentos con prueba de vida (debían traer ráfaga) y cuántos la trajeron. */
  liveness_attempts: number;
  bursts: number;
  /** Pulso por video (solo se mide): medidos, vistos y su nitidez mediana (dB). */
  pulse_measured: number;
  pulse_seen: number;
  pulse_median_snr: number | null;
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
  /** Antifraude 2a: el destello dictado por el servidor y la ráfaga de recortes del rostro. */
  protocol?: CaptureProtocolObservation;
  /** Antifraude 1b: la base local de IP del servidor (país y red de cada intento; DB-IP Lite). */
  ip_database?: IpDatabaseStatus;
}

/** Un archivo de la base local de IP: su tipo y cuándo lo construyó DB-IP. */
export interface IpDatabaseFile {
  database_type: string;
  built_at: string;
}

/** La base local de IP (la IP nunca sale del servidor): sin ella, las señales de red no se miden. */
export interface IpDatabaseStatus {
  refresh_enabled: boolean;
  refresh_days: number;
  country: IpDatabaseFile | null;
  asn: IpDatabaseFile | null;
}
