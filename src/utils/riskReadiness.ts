import { isRecord } from './guards';

const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const cap = (value: unknown): value is number => count(value) && value >= 1 && value <= 100;

/** Opciones de negocio publicadas por el servidor, incluidas las versiones anteriores sin este campo. */
function validFamilyCap(value: Record<string, unknown>): boolean {
  return (value.risk_family_max_points === undefined || cap(value.risk_family_max_points)) &&
    (value.risk_family_max_points_options === undefined || (Array.isArray(value.risk_family_max_points_options) && value.risk_family_max_points_options.every(cap)));
}

/** Datos aditivos del motor: se tolera ausencia en un servidor anterior, nunca una forma inválida. */
export function isRiskPolicyMetadata(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!validFamilyCap(value)) return false;
  if (value.risk_failure_policy !== undefined && (typeof value.risk_failure_policy !== 'string' || !value.risk_failure_policy)) return false;
  if (!Array.isArray(value.risk_signals) || !value.risk_signals.every((signal: unknown) =>
    isRecord(signal) &&
    (signal.critical_action == null || typeof signal.critical_action === 'string') &&
    (signal.calibration_required === undefined || typeof signal.calibration_required === 'boolean'),
  )) return false;
  const ready = value.risk_readiness;
  if (ready === undefined) return true;
  return isRecord(ready) && count(ready.maximum_score) && count(ready.observed_signals) && count(ready.enforced_signals) &&
    typeof ready.score_can_reject === 'boolean' && typeof ready.calibration_required === 'boolean' &&
    isRecord(ready.critical_controls) && Object.values(ready.critical_controls).every((action) => typeof action === 'string');
}
