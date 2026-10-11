import type { AdminVerificationPolicy } from '../../types';
import { useT } from '../../i18n';
import { formatCount } from '../../utils/numbers';

/** Diagnóstico visible del servidor; nunca se deduce preparación contando señales. */
export function RiskReadinessNotice({ policy }: { policy: AdminVerificationPolicy }) {
  const t = useT();
  const ready = policy.risk_readiness;
  if (!ready) return null;
  return (
    <div className="callout" role="note">
      <strong>{t('policy.risk.readiness.title')}</strong>
      <p>{t('policy.risk.readiness.score', { maximum: formatCount(ready.maximum_score), observed: formatCount(ready.observed_signals), enforced: formatCount(ready.enforced_signals) })}</p>
      {!ready.score_can_reject && <p>{t('policy.risk.readiness.cannotReject')}</p>}
      {ready.calibration_required && <p>{t('policy.risk.readiness.calibration')}</p>}
      {Object.keys(ready.critical_controls).length > 0 && <p>{t('policy.risk.readiness.independent')}</p>}
    </div>
  );
}
