// Antifraude de identidad: motor de riesgo, casos de fraude (los revisa el ADMIN) y gobierno de la política.
import type { CatalogItem, Page, PageQuery, StatusItem } from './index';

/** Una señal del motor de riesgo en un intento: lo medido, su umbral, sus puntos y su modo (solo la ve el ADMIN). */
export interface RiskReason {
  code: string;
  /** Nombre de la señal (catálogo `risk_signals`, que no viaja a la app: lo pone el servidor). */
  name: string;
  /** Qué mide y por qué delata un fraude (la explicación del catálogo, en el idioma de la petición). */
  description?: string | null;
  points: number;
  /** OFF | OBSERVE | ENFORCE (catálogo `signal_modes`). */
  mode: string;
  /** Tipo de fraude que sugiere (catálogo `fraud_kinds`). */
  kind: string;
  value: number | null;
  threshold: number | null;
}

/** Un caso en la bandeja del ADMIN. */
export interface FraudCase {
  id: number;
  company_id: number;
  company_name: string;
  /** Catálogo `fraud_case_statuses`. */
  status: string;
  /** Catálogo `fraud_kinds`. */
  kind: string;
  /** Lo que abrió el caso: el motivo de un candado o la señal que más pesó (código y su nombre). */
  reason: string;
  reason_name: string;
  /** La ficha de trabajo del empleado (nombre y número) o, si no se supo quién era, la cuenta que operó la cámara. */
  employee: { id: number; full_name: string; employee_number: string } | null;
  actor: string | null;
  attempts: number;
  max_score: number | null;
  /** Catálogo `risk_tiers`. */
  tier: string | null;
  evidence: number;
  created_at: string;
  last_attempt_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

export type FraudCaseList = Page<FraudCase>;

/** Un intento del caso con la copia de lo que se midió (sobrevive a la retención de la bitácora). */
export interface FraudCaseAttempt {
  id: number;
  attempted_at: string;
  success: boolean;
  reason: string | null;
  score: number | null;
  action: string | null;
  signals: RiskReason[];
  metrics: Record<string, number | string>;
  /** Huellas de sus capturas (pasan a la lista de bloqueo si se confirma el fraude). */
  signatures: number;
  camera: string | null;
  ip_address: string | null;
  /** Red de su IP según la base local DB-IP Lite (la IP nunca sale del servidor); null sin base o con IP privada. */
  network?: FraudNetwork | null;
  user_agent: string | null;
}

/** País, sistema autónomo y si es de una nube o un centro de datos (VPN, servidor intermediario o un programa). */
export interface FraudNetwork {
  country: string | null;
  asn: number | null;
  organization: string | null;
  hosting: boolean;
}

export interface FraudCaseEvent {
  id: number;
  created_at: string;
  /** Catálogo `fraud_case_event_kinds`. */
  kind: string;
  actor: string | null;
  status_from: string | null;
  status_to: string | null;
  note: string | null;
}

/** Un fotograma de evidencia (la imagen se pide aparte, por la API: nunca una URL del bucket). */
export interface FraudEvidenceItem {
  id: number;
  /** FRONTAL, STEP (movimiento del reto) o FLASH (color del destello). */
  kind: string;
  position: number;
  created_at: string;
}

export interface FraudCaseDetail extends FraudCase {
  attempts_detail: FraudCaseAttempt[];
  events: FraudCaseEvent[];
  evidence_items: FraudEvidenceItem[];
}

/** Un fotograma descifrado (en base64 dentro del contrato único). */
export interface FraudEvidenceImage {
  id: number;
  kind: string;
  position: number;
  content_type: string;
  data: string;
}

/** Cómo queda un caso: tomarlo (IN_REVIEW) o decidirlo; confirmar o descartar llevan una nota. */
export interface FraudCaseDecisionInput {
  status: string;
  note?: string | null;
}

/** Filtros de la bandeja: un estado del catálogo o `ALL` (sin él, los casos por revisar). */
export interface FraudCaseQuery extends PageQuery {
  status?: string;
  kind?: string;
  company_id?: number;
}

/** Un empleado aprobado cuyo rostro se parece al del registro (marca POSSIBLE_DUPLICATE). */
export interface SimilarEmployee {
  employee_id: number;
  full_name: string;
  employee_number: string;
  /** Similitud de 0 a 1. */
  similarity: number;
}

/**
 * Catálogos del antifraude: tipos de fraude, modos de una señal, motivos de una revisión (lo que ve la empresa),
 * niveles y acciones de riesgo, estados de un registro en revisión, modos del dispositivo del empleado, niveles
 * predefinidos de la política y estados de un cambio y de un caso (las señales del motor no viajan aquí).
 */
export interface AntifraudCatalogs {
  fraud_kinds: CatalogItem[];
  signal_modes: CatalogItem[];
  review_reasons: CatalogItem[];
  risk_tiers: StatusItem[];
  risk_actions: CatalogItem[];
  attendance_review_statuses: StatusItem[];
  employee_device_modes: CatalogItem[];
  policy_presets: CatalogItem[];
  policy_change_statuses: StatusItem[];
  fraud_case_statuses: StatusItem[];
  fraud_case_event_kinds: CatalogItem[];
}
