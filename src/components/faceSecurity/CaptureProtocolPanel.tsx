import { HeartPulse } from 'lucide-react';
import { useT } from '../../i18n';
import type { CaptureProtocolObservation, FaceSecurityOverview } from '../../types/faceSecurity';
import { formatMs, protocolReadiness } from '../../utils/faceSecurity';
import { formatCount, formatNumber } from '../../utils/numbers';
import { FactList } from '../performance/PerformanceParts';
import { ReadinessCallout } from './FaceSecuritySections';

/** Estado del protocolo de captura: listo para exigirlo o midiendo (insignia de la sección). */
export function ProtocolReadinessBadge({ overview }: { overview: FaceSecurityOverview }) {
  const t = useT();
  const { ready } = protocolReadiness(overview);
  return <span className={`badge ${ready ? 'badge--success' : 'badge--warning'}`}>{t(ready ? 'faceSecurity.protocol.ready' : 'faceSecurity.protocol.calibrating')}</span>;
}

/** Los números del destello dictado, de la ráfaga y del pulso (que solo se mide). */
function protocolStats(protocol: CaptureProtocolObservation, t: ReturnType<typeof useT>) {
  const rows: [string, string][] = [
    [t('faceSecurity.protocol.flashAttempts'), formatCount(protocol.flash_attempts)],
    [t('faceSecurity.protocol.paced'), formatCount(protocol.paced)],
    [t('faceSecurity.protocol.late'), formatCount(protocol.late)],
    [t('faceSecurity.protocol.paceTypical'), formatMs(protocol.pace_p50_ms)],
    [t('faceSecurity.protocol.paceSlow'), formatMs(protocol.pace_p95_ms)],
    [t('faceSecurity.protocol.window'), formatMs(protocol.window_ms)],
    [t('faceSecurity.protocol.livenessAttempts'), formatCount(protocol.liveness_attempts)],
    [t('faceSecurity.protocol.bursts'), formatCount(protocol.bursts)],
    [t('faceSecurity.protocol.pulseMeasured'), formatCount(protocol.pulse_measured)],
    [t('faceSecurity.protocol.pulseSeen'), formatCount(protocol.pulse_seen)],
    [t('faceSecurity.protocol.pulseSnr'), protocol.pulse_median_snr === null ? '—' : `${formatNumber(protocol.pulse_median_snr, 1)} dB`],
  ];
  return rows.map(([label, value]) => ({ label, value }));
}

/**
 * El protocolo de captura (antifraude 2a) en los intentos exitosos: cuántos destellos dictó el servidor y qué tan
 * rápido se respondieron, cuántos intentos trajeron la ráfaga y el pulso que se midió, con cuándo conviene exigirlo
 * (`protocolReadiness`). Solo dibuja lo que manda el backend.
 */
export function CaptureProtocolPanel({ overview }: { overview: FaceSecurityOverview & { protocol: CaptureProtocolObservation } }) {
  const t = useT();
  const { ready, pending } = protocolReadiness(overview);
  return (
    <>
      <p className="muted small">
        {t('faceSecurity.flash.window', { count: overview.window_days })} {t('faceSecurity.protocol.explain')}
      </p>
      <FactList items={protocolStats(overview.protocol, t)} />
      <p className="muted small">
        <HeartPulse size={14} aria-hidden /> {t('faceSecurity.protocol.pulseNote')}
      </p>
      <ReadinessCallout
        ready={ready}
        title={t(ready ? 'faceSecurity.protocol.canEnforce' : 'faceSecurity.protocol.notYet')}
        advice={t('faceSecurity.protocol.advice')}
        pending={pending}
      />
    </>
  );
}
