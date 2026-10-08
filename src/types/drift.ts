// Deriva de las señales del motor facial (antifraude fase 3, pantalla ADMIN_DRIFT): contrato de `/api/admin/drift`.
import type { Page } from './index';

/** Plataformas en que se agrupan los intentos (las decide el servidor a partir del navegador). */
export type DriftPlatform = 'IOS_SAFARI' | 'ANDROID_CHROME' | 'DESKTOP' | 'OTHER';

/**
 * Estado de una fila: OK (sin deriva), ALERT (PSI o cola fuera de umbral: el ADMIN ya tiene su aviso),
 * INSUFFICIENT (pocos intentos para comparar), NO_BASELINE (sin ventana anterior) y VERSION_CHANGE (cambió el motor
 * o los modelos: la línea base no es comparable).
 */
export type DriftStatus = 'OK' | 'ALERT' | 'INSUFFICIENT' | 'NO_BASELINE' | 'VERSION_CHANGE';

/** Una señal × plataforma en una ventana (semana), comparada con la ventana anterior. */
export interface DriftRow {
  id: number;
  week_start: string;
  signal: string;
  /** Nombre de la señal, traducido por el servidor. */
  signal_name: string;
  platform: DriftPlatform;
  samples: number;
  baseline_samples: number;
  median: number | null;
  baseline_median: number | null;
  /** La cola que vigila la señal: el p10 de un mínimo o el p90 de un máximo (`tail_percentile`). */
  tail: number | null;
  baseline_tail: number | null;
  tail_percentile: 10 | 90;
  /** Cambio de la cola respecto a la línea base (fracción; negativo = cayó). */
  tail_change: number | null;
  /** Índice de estabilidad de población entre las dos ventanas. */
  psi: number | null;
  status: DriftStatus;
  /** Un máximo (el moiré): lo sospechoso está por encima y la cola vigilada es el p90. */
  upper: boolean;
  computed_at: string;
}

export type DriftPage = Page<DriftRow>;

/** Una empresa en una ventana: su tasa de casos y cuántas revisiones aprobó "sin mirar". */
export interface CompanyDriftRow {
  id: number;
  week_start: string;
  company_id: number;
  company_name: string;
  attempts: number;
  fraud_cases: number;
  /** Casos por intento (fracción; null sin intentos). */
  case_rate: number | null;
  reviews: number;
  approved: number;
  /** Aprobadas en menos de `quick_review_seconds` desde que se abrió la revisión. */
  quick_approvals: number;
  quick_rate: number | null;
  status: 'OK' | 'ALERT' | 'INSUFFICIENT';
  computed_at: string;
}

export type CompanyDriftPage = Page<CompanyDriftRow>;

/** Un cambio de versión anotado en la bitácora del motor (la línea base no mezcla versiones). */
export interface EngineVersion {
  id: number;
  /** `risk_engine`, `face_models`, `api` o `webapp` (uno nuevo del servidor se muestra tal cual). */
  component: string;
  version: string;
  noted_at: string;
}

export interface DriftSummary {
  window_days: number;
  psi_alert: number;
  tail_drop_alert: number;
  min_samples: number;
  quick_review_seconds: number;
  quick_approval_ratio: number;
  /** Ventanas calculadas (fecha de inicio), la más reciente primero. */
  weeks: string[];
  latest_week: string | null;
  /** De la ventana más reciente: filas con alerta, sin datos suficientes y empresas con alerta. */
  alerts: number;
  insufficient: number;
  companies_alerted: number;
  platforms: DriftPlatform[];
  versions: EngineVersion[];
  computed_at: string | null;
}
