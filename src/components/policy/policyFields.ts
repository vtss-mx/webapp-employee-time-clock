import { t } from '../../i18n';
import type { AdminPolicyUpdate, AdminVerificationPolicy, PolicyFieldChange } from '../../types';
import type { FieldChange } from '../../types/confirm';
import type { CatalogApi } from '../../utils/catalogs';
import { formatConfidence } from '../../utils/format';
import { formatNumber } from '../../utils/numbers';
import { ruledAccessories } from '../accessories';

/**
 * Nombre y valor legibles de cada campo del historial de la política (`policy.changes`): el backend manda el
 * nombre de la columna (`risk_high_score`, `risk_signals.FLASH_FLAT.mode`) y el valor crudo; aquí se vuelven
 * "Corte del riesgo alto: 60 → 50 puntos" con los mismos textos de la pantalla. Un campo que la app no conoce
 * (otra versión del backend) se muestra tal cual: nunca se oculta un cambio.
 */

/** Interruptores con su texto en `policy.options.<id>.label`. */
const OPTIONS = {
  liveness_challenge: 'livenessChallenge',
  anti_spoofing: 'antiSpoofing',
  qr_enabled: 'qrEnabled',
  validator_mobile_only: 'validatorMobileOnly',
  block_virtual_cameras: 'blockVirtualCameras',
  reject_foreign_images: 'rejectForeignImages',
  detect_static_captures: 'detectStaticCaptures',
  detect_replays: 'detectReplays',
  check_capture_continuity: 'checkCaptureContinuity',
  enforce_human_timing: 'enforceHumanTiming',
  detect_duplicate_faces: 'detectDuplicateFaces',
  lockout_enabled: 'lockoutEnabled',
  validator_device_approval: 'validatorDeviceApproval',
  adaptive_learning: 'adaptiveLearning',
  detect_impossible_travel: 'detectImpossibleTravel',
  qr_only_attendance: 'qrOnlyAttendance',
  risk_engine: 'riskEngine',
  fraud_evidence: 'fraudEvidence',
} as const;

/** Ajustes con su texto en `policy.tuning.<id>.label`. */
const TUNINGS = {
  anti_spoofing_level: 'antiSpoofing',
  liveness_steps: 'steps',
  liveness_timeout_seconds: 'timeout',
  flash_liveness: 'flash',
  min_capture_quality: 'quality',
  lockout_max_failures: 'lockoutFailures',
  lockout_minutes: 'lockoutMinutes',
  qr_lifetime_seconds: 'qrLifetime',
  max_location_accuracy_m: 'accuracy',
  max_travel_kmh: 'speed',
} as const;

/** Campos del motor de riesgo y del antifraude con su texto en `policy.risk.fields.<id>`. */
const RISK = {
  risk_medium_score: 'mediumScore',
  risk_high_score: 'highScore',
  risk_critical_score: 'criticalScore',
  risk_medium_action: 'mediumAction',
  risk_high_action: 'highAction',
  risk_critical_action: 'criticalAction',
  risk_fallback_action: 'fallbackAction',
  duplicate_confidence: 'duplicateConfidence',
  employee_device_mode: 'deviceMode',
  min_confidence: 'minConfidence',
  identify_confidence: 'identifyConfidence',
} as const;

/** Prueba de presencia (antifraude 2b, `PresenceSection`) con su texto en `policy.presence.<id>`. */
export const PRESENCE_FIELDS = {
  validator_signing: 'signing',
  validator_location: 'location',
  site_codes: 'siteCodes',
} as const;

/** Campos cuyo valor es un código de un catálogo (se muestra su nombre). */
const CATALOG_FIELDS: Partial<Record<string, 'antispoof_levels' | 'flash_modes' | 'employee_device_modes' | 'risk_actions' | 'signal_modes'>> = {
  // Prueba de presencia (antifraude 2b): firma por petición, ubicación del validador y código de sitio.
  validator_signing: 'signal_modes',
  validator_location: 'signal_modes',
  site_codes: 'signal_modes',
  anti_spoofing_level: 'antispoof_levels',
  flash_liveness: 'flash_modes',
  employee_device_mode: 'employee_device_modes',
  risk_medium_action: 'risk_actions',
  risk_high_action: 'risk_actions',
  risk_critical_action: 'risk_actions',
  risk_fallback_action: 'risk_actions',
};

const CONFIDENCE_FIELDS = new Set(['min_confidence', 'identify_confidence', 'duplicate_confidence']);

const has = <T extends object>(map: T, key: string): key is Extract<keyof T, string> => Object.hasOwn(map, key);

/** El nombre de una señal del motor (lo trae la política del ADMIN); sin ella, su código. */
function signalName(code: string, policy: Pick<AdminVerificationPolicy, 'risk_signals'>): string {
  return policy.risk_signals.find((signal) => signal.code === code)?.name ?? code;
}

/** Nombre legible del campo, en el idioma activo. */
export function fieldLabel(field: string, policy: Pick<AdminVerificationPolicy, 'risk_signals'>, catalogs: Pick<CatalogApi, 'accessories'>): string {
  if (has(OPTIONS, field)) return t(`policy.options.${OPTIONS[field]}.label`);
  if (has(TUNINGS, field)) return t(`policy.tuning.${TUNINGS[field]}.label`);
  if (has(RISK, field)) return t(`policy.risk.fields.${RISK[field]}`);
  if (has(PRESENCE_FIELDS, field)) return t(`policy.presence.${PRESENCE_FIELDS[field]}.label`);
  const accessory = ruledAccessories(catalogs.accessories).find((a) => a.rule === field);
  if (accessory) return t('policy.accessories.remove', { phrase: accessory.item.phrase });
  const signal = /^risk_signals\.([A-Z0-9_]+)\.(mode|points)$/.exec(field);
  if (signal) return t(signal[2] === 'mode' ? 'policy.risk.signals.modeOf' : 'policy.risk.signals.pointsOf', { signal: signalName(signal[1], policy) });
  return field;
}

/** Valor legible: interruptores, niveles de confianza, códigos de catálogo, puntos y números. */
export function fieldValue(field: string, value: unknown, catalogs: Pick<CatalogApi, 'nameOf'>): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return t(value ? 'policy.toggle.on' : 'policy.toggle.off');
  if (typeof value === 'number') {
    if (CONFIDENCE_FIELDS.has(field)) return formatConfidence(value);
    if (field.endsWith('.points') || field.endsWith('_score')) return t('policy.risk.points', { points: formatNumber(value) });
    return formatNumber(value);
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const catalog = CATALOG_FIELDS[field];
  if (catalog) return catalogs.nameOf(catalog, text);
  return field.endsWith('.mode') ? catalogs.nameOf('signal_modes', text) : text;
}

/** Un cambio del historial como "Campo: antes → después" (la confirmación de aprobarlo lo muestra igual). */
export function describeFieldChange(change: PolicyFieldChange, policy: Pick<AdminVerificationPolicy, 'risk_signals'>, catalogs: Pick<CatalogApi, 'accessories' | 'nameOf'>): FieldChange {
  return { label: fieldLabel(change.field, policy, catalogs), before: fieldValue(change.field, change.before, catalogs), after: fieldValue(change.field, change.after, catalogs) };
}

/**
 * La política como queda si el servidor acepta el cambio (vista optimista mientras se guarda): los campos directos
 * se reemplazan y el ajuste de cada señal (`risk_signals: { CÓDIGO: { mode, points } }`) se aplica sobre su fila.
 */
export function withChanges(policy: AdminVerificationPolicy, changes: AdminPolicyUpdate): AdminVerificationPolicy {
  const { risk_signals: signals, reason: _reason, ...fields } = changes;
  return {
    ...policy,
    ...fields,
    risk_signals: signals ? policy.risk_signals.map((signal) => ({ ...signal, ...signals[signal.code] })) : policy.risk_signals,
  };
}
