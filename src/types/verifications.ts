/**
 * Verificaciones de identidad de una empresa con dónde se hicieron (pantalla «Verificaciones», mapa de Google Maps).
 * Cada fila trae a la persona con su foto (`avatar`: la empresa ve a su gente, decisión del dueño, 2026-10-06) y, si la
 * verificación llevó ubicación (`verification_location` OBSERVE/ENFORCE), el punto donde ocurrió; sin ella, los campos
 * de ubicación son null y la fila lo dice. La empresa SIEMPRE sale de la sesión (aislamiento por empresa, regla 14): el
 * backend nunca recibe el `company_id` del cliente. Nunca viajan fotos del registro facial (solo el `avatar` de perfil).
 */
import type { WithAvatar } from './avatar';
import type { FraudNetwork, RiskReason } from './fraud';
import type { EmployeeRef, Page, VerificationMethod } from './index';

export interface CompanyVerification extends WithAvatar {
  id: number;
  /** Instante de la verificación (UTC; se muestra en la zona del negocio). */
  created_at: string;
  method: VerificationMethod;
  success: boolean;
  /** Código del catálogo `verification_reasons` cuando no fue exitosa; null si fue exitosa. */
  reason: string | null;
  confidence: number | null;
  /** Empleado identificado (null cuando no se identificó a nadie). */
  employee_id: number | null;
  /** Opcional (decisión del dueño del producto): null = sin número. */
  employee_number: string | null;
  employee_name: string | null;
  /** Dónde se hizo (WGS-84); null cuando la verificación no llevó ubicación («sin ubicación»). */
  latitude: number | null;
  longitude: number | null;
  /** Precisión informada por el dispositivo (m); null sin ubicación. */
  location_accuracy_m: number | null;
}

export type CompanyVerificationList = Page<CompanyVerification>;

/** Filtros del listado (todos opcionales); las fechas son días de la hora del negocio ("YYYY-MM-DD"). */
export interface CompanyVerificationQuery {
  page: number;
  size: number;
  employee_id?: number;
  start?: string;
  end?: string;
  /** `true` solo exitosas, `false` solo fallidas; sin él, todas. */
  success?: boolean;
}

/**
 * Una fila del historial del ADMIN (pantalla `ADMIN_VERIFICATIONS`): lo mismo que ve la empresa de la suya, más DE
 * QUÉ EMPRESA es. La empresa se nombra aunque esté en «Eliminados» (el historial sigue nombrando a quien ya no está).
 */
export interface VerificationHistoryRow extends CompanyVerification {
  company_id: number;
  company_name: string;
}

/** Página del historial, con el periodo que de verdad se consultó y el tope del conteo (los envía el servidor). */
export interface PeriodPage {
  /** Instantes UTC del periodo consultado (sin filtro, los últimos `window_days` días). */
  since: string;
  until: string;
  /** Tope del conteo: `total` nunca pasa de aquí y la lista muestra «10 000+» al llegar (regla 25). */
  count_cap: number;
}

export type VerificationHistoryList = Page<VerificationHistoryRow> & PeriodPage;
export type CompanyVerificationPage = Page<CompanyVerification> & PeriodPage;

/** Conteos del periodo por método, por motivo de rechazo y por nivel de riesgo elevado (agrupados en la base). */
export interface VerificationMethodCount {
  method: VerificationMethod;
  total: number;
  succeeded: number;
}

export interface VerificationReasonCount {
  /** Código del catálogo `verification_reasons`. */
  reason: string;
  total: number;
}

export interface VerificationTierCount {
  /** Código del catálogo `risk_tiers` (solo los niveles elevados: el bajo es el resto). */
  tier: string;
  total: number;
}

/** Resumen del periodo: las tarjetas de la pantalla y los límites que la app dibuja (nunca los calcula). */
export interface VerificationSummary extends PeriodPage {
  total: number;
  succeeded: number;
  failed: number;
  located: number;
  by_method: VerificationMethodCount[];
  by_reason: VerificationReasonCount[];
  by_risk_tier: VerificationTierCount[];
  /** Niveles de riesgo por los que el listado se puede filtrar (los decide el servidor, regla 25). */
  filterable_risk_tiers: string[];
  /** Días que se muestran cuando nadie eligió un periodo. */
  window_days: number;
}

/** Quién operó la cámara: una cuenta (con su rol del catálogo `roles`) o un dispositivo de la API pública. */
export interface VerificationActor {
  role: string | null;
  email: string | null;
  /** Nombre del validador cuando el intento lo hizo uno. */
  name: string | null;
  /** Principio de la huella de la llave del dispositivo (nunca la llave). */
  device: string | null;
}

/** Punto de verificación (sitio) al que se acotó el intento. */
export interface VerificationSite {
  id: number;
  name: string;
  deleted: boolean;
}

/** DÓNDE se hizo: el punto con su precisión, el sitio, la red de la IP y el navegador. */
export interface VerificationPlace {
  latitude: number | null;
  longitude: number | null;
  location_accuracy_m: number | null;
  site: VerificationSite | null;
  /** El intento confirmó la presencia con el código rotativo del sitio (nunca el código). */
  presence_code_used: boolean;
  ip_address: string | null;
  network: FraudNetwork | null;
  user_agent: string | null;
}

/**
 * Lo que se MIDIÓ del intento facial: solo números, nunca una imagen (regla 13). Cada campo puede faltar (un QR no
 * mide nada) y la pantalla solo dibuja los que llegaron.
 */
export interface VerificationMeasurement {
  steps: number | null;
  flash_mode: string | null;
  response_seconds: number | null;
  frontal_real_min: number | null;
  frontal_real_mean: number | null;
  step_real_min: number | null;
  yaw_min: number | null;
  pitch_min: number | null;
  closer_min: number | null;
  flash_score: number | null;
  flash_magnitude: number | null;
  flash_background: number | null;
  flash_ratio: number | null;
  quality_mean: number | null;
  brightness_mean: number | null;
  burst_frames: number | null;
  burst_motion: number | null;
  pulse_snr: number | null;
  moire: number | null;
  noise_ratio: number | null;
  parallax: number | null;
  flash_pace_ms: number | null;
  burst_consensus: number | null;
  /** Categoría gruesa de la plataforma del navegador (IOS_SAFARI, ANDROID_CHROME, DESKTOP, OTHER). */
  platform: string | null;
  /** Los números por familia de la detección de presentación; nunca los rasgos crudos. */
  pad: Record<string, number> | null;
  /** Lo que decidió la revisión de un caso sobre este intento (FRAUD, GENUINE o null). */
  fraud_label: string | null;
}

/** La decisión del motor de riesgo del intento, con CADA señal que sumó (su valor, su umbral, su modo y sus puntos). */
export interface VerificationRisk {
  score: number;
  tier: string;
  action: string;
  step_up: boolean;
  fallback: boolean;
  policy_version: string;
  engine: string;
  fraud_label: string | null;
  signals: RiskReason[];
}

/** El caso de fraude que abrió el intento: solo el enlace y su estado (sus fotogramas viven en su pantalla). */
export interface VerificationCase {
  id: number;
  status: string;
  kind: string;
}

/** Estados técnicos emitidos por el orquestador; PASS de una etapa no aprueba una identidad. */
export type VerificationModuleStatus = 'PASS' | 'FAIL' | 'ERROR' | 'TIMEOUT' | 'NOT_SUPPORTED' | 'SKIPPED_BY_POLICY' | 'NOT_APPLICABLE';
export type VerificationModuleCode = 'SESSION' | 'POLICY' | 'AUTHORIZATION' | 'CAPTURE' | 'LIVENESS' | 'MATCH' | 'RISK' | 'WEIGHTED_RISK';
export interface VerificationFlowTrace {
  version: string;
  method: VerificationMethod;
  session_id: string | null;
  policy_version: string;
  modules: {
    code: VerificationModuleCode;
    status: VerificationModuleStatus;
    mandatory: boolean;
    duration_ms: number;
    reason: string | null;
    score: number | null;
    version: string;
  }[];
  capture_manifest: { kind: string; index: number; sha256: string; bytes: number }[];
}

/**
 * Un intento con TODO el detalle que la plataforma midió, sin un solo dato biométrico (regla 13): números, códigos
 * y veredictos, más la foto de PERFIL de la persona. `company_id`/`company_name` solo llegan al ADMIN.
 */
export interface VerificationDetail {
  /** Evidencia del intento: ausente o nula en registros que nunca la capturaron. */
  flow_trace?: VerificationFlowTrace | null;
  trace_id?: string | null;
  kiosk_id?: number | null;
  api_key_prefix?: string | null;
  match_thresholds?: Record<string, number> | null;
  challenge_actions?: string[] | null;
  model_name?: string | null;
  policy_version?: string | null;

  id: number;
  created_at: string;
  method: VerificationMethod;
  success: boolean;
  reason: string | null;
  confidence: number | null;
  company_id: number | null;
  company_name: string | null;
  employee: EmployeeRef | null;
  actor: VerificationActor | null;
  place: VerificationPlace;
  measurement: VerificationMeasurement | null;
  risk: VerificationRisk | null;
  case: VerificationCase | null;
}

/** Filtros del historial (todos opcionales); las fechas son días de la hora del negocio ("YYYY-MM-DD"). */
export interface VerificationFilters {
  start?: string;
  end?: string;
  employee_id?: number;
  method?: VerificationMethod;
  success?: boolean;
  reason?: string;
  site_id?: number;
  located?: boolean;
  /** Solo un nivel ELEVADO de los que publica el resumen (`filterable_risk_tiers`). */
  risk_tier?: string;
  /** Solo el ADMIN: una empresa o, sin él, todas. */
  company_id?: number;
}
