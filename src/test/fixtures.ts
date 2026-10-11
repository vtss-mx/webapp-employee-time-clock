import type { AdminVerificationPolicy, CheckpointProfile, RiskSignalSetting, Validator, VerificationDetail, VerificationPolicy, VerificationResult, VerificationSummary } from '../types';
import { STRICT_RULES } from '../hooks/useVerificationPolicy';

export const sampleValidator: Validator = {
  id: 3,
  name: 'Recepción planta 1',
  email: 'recepcion@empresa.com',
  mode: 'QR_OR_FACE',
  active: true,
  last_login_at: null,
  identifications_today: 0,
  created_at: '2026-10-01T00:00:00Z',
  address: {
    street: 'Calle Dr. Paliza',
    exterior_number: '71',
    interior_number: null,
    postal_code: '83000',
    country_code: 'MX',
    state: 'Sonora',
    municipality: 'Hermosillo',
    city: 'Hermosillo',
    neighborhood: 'Centro',
    reference_notes: null,
    latitude: 29.0729,
    longitude: -110.9559,
  },
  location_required: false,
  location_radius_m: null,
  devices_pending: 0,
  devices_approved: 1,
};

export const sampleCheckpoint: CheckpointProfile = {
  id: 3,
  name: 'Recepción planta 1',
  mode: 'QR_OR_FACE',
  company: { id: 1, name: 'Mi empresa', active: true },
  liveness_required: true,
  qr_enabled: true,
  device_nonce: null,
  location_required: false,
};

export const identifiedResult: VerificationResult = {
  verified: true,
  verification_status: 'APPROVED',
  method: 'FACE',
  message: 'Identificación exitosa',
  employee_id: 7,
  employee_number: 'EMP-7',
  name: 'Ana Ruiz',
  confidence: 0.9999,
  verified_at: '2026-10-01T10:00:00Z',
};

/** Política de la empresa como la devuelve GET /api/settings/verification (lo más estricto). */
export const samplePolicy: VerificationPolicy = {
  ...STRICT_RULES,
  // Movimientos de la prueba de vida (decisión del dueño, 2026-10-08): por omisión girar a la derecha e izquierda; mirar
  // arriba y abajo nacen apagados (deben quedar al menos dos encendidos).
  enable_turn_right: true,
  enable_turn_left: true,
  enable_look_up: false,
  enable_look_down: false,
  blocked_cameras: ['virtual', 'manycam', 'obs virtual'],
  min_confidence: 0.99999,
  identify_confidence: 0.99999,
  min_capture_quality: 0.4,
  max_location_accuracy_m: 100,
  detect_impossible_travel: true,
  max_travel_kmh: 200,
  liveness_timeout_seconds: 60,
  // Prueba de vida calibrada por el ADMIN (decisión del dueño, 2026-10-08): respaldos del contrato (0.55 s de sostén, 3 reintentos).
  liveness_hold_ms: 550,
  liveness_max_retries: 3,
  flash_liveness: 'OBSERVE',
  updated_at: null,
  updated_by: null,
};

/** Una señal del motor de riesgo como la ve el ADMIN (la de la plataforma, la vigente y su línea base). */
export function riskSignal(code: string, extra: Partial<RiskSignalSetting> = {}): RiskSignalSetting {
  return {
    code,
    name: `Señal ${code}`,
    description: null,
    kind: 'PRESENTATION',
    hard: false,
    client: false,
    default_points: 20,
    default_mode: 'OBSERVE',
    points: 20,
    mode: 'OBSERVE',
    confirmed: 0,
    false_positive: 0,
    ...extra,
  };
}

/** La política completa que lee el ADMIN (GET /api/admin/companies/{id}/verification-policy). */
export const sampleAdminPolicy: AdminVerificationPolicy = {
  ...samplePolicy,
  duplicate_confidence: 0.99,
  employee_device_mode: 'OBSERVE',
  preset: 'STANDARD',
  risk_engine: true,
  risk_medium_score: 30,
  risk_high_score: 60,
  risk_critical_score: 80,
  risk_medium_action: 'STEP_UP',
  risk_high_action: 'REVIEW',
  risk_critical_action: 'DENY',
  risk_fallback_action: 'ALERT',
  risk_failure_policy: 'INCONCLUSIVE',
  fraud_evidence: true,
  // Destello dictado por el servidor (antifraude 2a): interruptor del ADMIN, apagado por omisión como en el backend.
  flash_paced: false,
  capture_burst: true,
  voice_verification: true,
  validator_signing: 'OBSERVE',
  validator_location: 'OBSERVE',
  site_codes: 'OBSERVE',
  risk_signals: [
    riskSignal('SPOOF_PROB_LOW', { name: 'Probabilidad de rostro real baja', mode: 'ENFORCE', default_mode: 'ENFORCE', confirmed: 2, false_positive: 1 }),
    riskSignal('REPLAY_PERCEPTUAL', { name: 'Reenvío perceptual', kind: 'REPLAY', hard: true, points: 60, default_points: 60 }),
    riskSignal('CAMERA_LABEL_MISSING', { name: 'Cámara sin nombre', kind: 'INJECTION', client: true }),
  ],
  pending_changes: 0,
  two_person_rule: true,
};

/**
 * Historial de verificaciones (migración 0106 del backend): el resumen del periodo y el detalle de un intento con
 * todo lo que se midió. Son NÚMEROS, códigos y veredictos: ninguna imagen, ninguna plantilla (regla 13).
 */
export const sampleVerificationSummary: VerificationSummary = {
  since: '2026-09-05T06:00:00Z',
  until: '2026-10-05T06:00:00Z',
  total: 12,
  succeeded: 10,
  failed: 2,
  located: 11,
  by_method: [{ method: 'FACE', total: 11, succeeded: 10 }, { method: 'QR', total: 1, succeeded: 0 }],
  by_reason: [{ reason: 'NO_MATCH', total: 2 }],
  by_risk_tier: [{ tier: 'HIGH', total: 1 }],
  count_cap: 10000,
  filterable_risk_tiers: ['MEDIUM', 'HIGH', 'CRITICAL'],
  window_days: 30,
};

export const sampleVerificationDetail: VerificationDetail = {
  id: 1,
  created_at: '2026-10-05T10:00:00Z',
  method: 'FACE',
  success: true,
  reason: null,
  confidence: 0.99,
  company_id: 1,
  company_name: 'Acme',
  employee: { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7', deleted: false, avatar: null },
  actor: { role: 'EMPLOYEE', email: 'ana@acme.mx', name: null, device: null },
  place: {
    latitude: 29.1,
    longitude: -110.9,
    location_accuracy_m: 12,
    site: { id: 1, name: 'Planta Hermosillo', deleted: false },
    presence_code_used: true,
    ip_address: '187.188.1.10',
    network: { country: 'MX', asn: 22884, organization: 'Acme Networks', hosting: false },
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
  },
  measurement: {
    steps: 2,
    flash_mode: 'OFF',
    response_seconds: 1.4,
    frontal_real_min: 0.91,
    frontal_real_mean: 0.95,
    step_real_min: 0.9,
    yaw_min: 0.3,
    pitch_min: null,
    closer_min: null,
    flash_score: null,
    flash_magnitude: null,
    flash_background: null,
    flash_ratio: null,
    quality_mean: 0.77,
    brightness_mean: 120,
    burst_frames: 8,
    burst_motion: 0.4,
    pulse_snr: null,
    moire: 0.12,
    noise_ratio: 1.1,
    parallax: 0.6,
    flash_pace_ms: null,
    burst_consensus: 0.88,
    platform: 'IOS_SAFARI',
    pad: { texture: 0.12 },
    fraud_label: null,
  },
  risk: {
    score: 20,
    tier: 'LOW',
    action: 'ALLOW',
    step_up: false,
    fallback: false,
    policy_version: 'abc123',
    engine: 'rules',
    fraud_label: null,
    signals: [{ code: 'MOIRE_HIGH', name: 'Moiré alto', description: null, points: 20, mode: 'ENFORCE', kind: 'PRESENTATION', value: 0.8, threshold: 0.5 }],
  },
  case: null,
};
