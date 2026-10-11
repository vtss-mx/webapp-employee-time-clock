import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { VerificationDetail } from '../../types';
import { formatBytes, formatCount, formatDuration, formatNumber } from '../../utils/numbers';

/** Evidencia capturada en ese intento: nunca se consulta la política actual para rellenar el pasado. */
export function VerificationEvidence({ detail }: { detail: VerificationDetail }) {
  const t = useT();
  const catalogs = useCatalogs();
  const missing = t('verification.detail.evidenceMissing');
  const facts = [
    [t('verification.detail.traceId'), detail.trace_id],
    [t('verification.detail.kioskId'), detail.kiosk_id == null ? null : formatCount(detail.kiosk_id)],
    [t('verification.detail.apiKeyPrefix'), detail.api_key_prefix],
    [t('verification.detail.modelName'), detail.model_name],
    [t('verification.detail.policyVersion'), detail.policy_version],
  ];
  return (
    <dl className="details">
      {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? missing}</dd></div>)}
      <div>
        <dt>{t('verification.detail.flow.title')}</dt>
        <dd>{detail.flow_trace == null ? missing : <>
          <span className="inline-note">{t('verification.detail.flow.version', { value: detail.flow_trace.version })}</span>
          <span className="inline-note">{t('verification.detail.flow.policy', { value: detail.flow_trace.policy_version })}</span>
          <ol>{detail.flow_trace.modules.map((module, index) => <li key={index}>
            {t(`verification.detail.flow.modules.${module.code}`)}: {t(`verification.detail.flow.statuses.${module.status}`)}
            <span className="inline-note">{t('verification.detail.flow.version', { value: module.version })}</span>
            <span className="inline-note">{t(module.mandatory ? 'verification.detail.flow.required' : 'verification.detail.flow.optional')}</span>
            <span className="inline-note">{t('verification.detail.flow.duration', { value: formatDuration(module.duration_ms) })}</span>
            {module.score !== null && <span className="inline-note">{t('verification.detail.flow.score', { value: formatNumber(module.score) })}</span>}
          </li>)}</ol>
          <span className="inline-note">{t('verification.detail.flow.captures', { count: detail.flow_trace.capture_manifest.length, size: formatBytes(detail.flow_trace.capture_manifest.reduce((total, capture) => total + capture.bytes, 0)) })}</span>
        </>}</dd>
      </div>
      <div>
        <dt>{t('verification.detail.matchThresholds')}</dt>
        <dd>{detail.match_thresholds == null ? missing : Object.entries(detail.match_thresholds).map(([model, value]) => <span className="inline-note" key={model}><code>{model}</code>: {formatNumber(value)}</span>)}</dd>
      </div>
      <div>
        <dt>{t('verification.detail.challengeActions')}</dt>
        <dd>{detail.challenge_actions == null ? missing : <ol>{detail.challenge_actions.map((action, i) => <li key={i}>{catalogs.nameOf('liveness_actions', action)}</li>)}</ol>}</dd>
      </div>
    </dl>
  );
}
