import { Aperture, CheckCircle2, Globe, Palette, RefreshCw, ShieldAlert, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { CaptureProtocolPanel, ProtocolReadinessBadge } from '../../components/faceSecurity/CaptureProtocolPanel';
import { FlashObservationPanel, FlashReadinessBadge, IpDatabasePanel, ReinforcedCompanies, ThresholdList } from '../../components/faceSecurity/FaceSecuritySections';
import { Button } from '../../components/ui/Button';
import { KpiGrid, type Kpi } from '../../components/ui/KpiCard';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { faceSecurityService } from '../../services/faceSecurityService';
import type { FaceSecurityOverview } from '../../types/faceSecurity';
import type { ConfirmInput } from '../../types/confirm';
import { formatCount, formatNumber } from '../../utils/numbers';

/** Cada cuánto recalcula la plataforma, legible: "6 h", "1.5 h" (la unidad es la misma en ambos idiomas). */
const hours = (value: number) => `${formatNumber(value, 1)} h`;

/** Qué hace "Recalcular ahora": con qué datos y que solo endurece. */
function recalibrateConfirm(overview: FaceSecurityOverview): ConfirmInput {
  return {
    kind: 'action',
    icon: <RefreshCw size={30} />,
    eyebrow: t('faceSecurity.confirm.eyebrow'),
    title: t('faceSecurity.confirm.title'),
    message: t('faceSecurity.confirm.message', { count: overview.window_days, hours: hours(overview.interval_hours) }),
    details: [
      { label: t('faceSecurity.confirm.window'), value: t('faceSecurity.confirm.days', { count: overview.window_days }) },
      { label: t('faceSecurity.confirm.samples'), value: formatCount(overview.min_samples) },
    ],
    note: t('faceSecurity.confirm.note'),
    confirmLabel: t('faceSecurity.recalibrate'),
    confirmIcon: <RefreshCw size={18} />,
  };
}

/** Cómo se calibra la plataforma (texto bajo los indicadores). */
function calibrationText(overview: FaceSecurityOverview): string {
  if (!overview.autocalibration) return t('faceSecurity.calibrationOff');
  return t('faceSecurity.calibration', { count: overview.window_days, hours: hours(overview.interval_hours), samples: formatCount(overview.min_samples) });
}

/* Títulos y avisos que se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const loadError = () => t('faceSecurity.loadError');
const recalibrateError = () => t('faceSecurity.recalibrateError');
const recalibrated = () => t('faceSecurity.recalibrated');

/**
 * Seguridad facial de la plataforma (solo el ADMIN): lo que la plataforma endureció sola (umbrales
 * autocalibrados de la prueba de vida y del anti-spoofing), las empresas reforzadas por ataques y lo
 * medido del destello de colores para decidir cuándo exigirlo. "Recalcular ahora" hace lo mismo que
 * el mantenimiento automático (solo endurece).
 */
export function FaceSecurityPage() {
  const t = useT();
  const { data, setData, error, retry } = useResource((signal) => faceSecurityService.overview(signal), 'face-security', loadError);
  const action = useAction();

  const recalibrate = (overview: FaceSecurityOverview) =>
    void action.run(() => faceSecurityService.recalibrate(), {
      confirm: () => recalibrateConfirm(overview),
      errorTitle: recalibrateError,
      success: (result) => [recalibrated(), result.message],
      onSuccess: (result) => setData(result.overview),
    });

  const kpis: Kpi[] = [
    { key: 'raised', label: t('faceSecurity.kpis.raised'), icon: ShieldCheck, value: data?.thresholds.filter((item) => item.raised).length, tile: 'icon-tile--success' },
    { key: 'reinforced', label: t('faceSecurity.kpis.reinforced'), icon: ShieldAlert, value: data?.reinforced.length, tile: 'icon-tile--warning' },
    { key: 'measured', label: t('faceSecurity.kpis.measured'), icon: Palette, value: data?.flash.measured, tile: '' },
    { key: 'conclusive', label: t('faceSecurity.kpis.conclusive'), icon: CheckCircle2, value: data?.flash.conclusive, tile: '' },
  ];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('faceSecurity.title')}
          subtitle={t('faceSecurity.subtitle')}
          actions={
            <Button variant="primary" icon={<RefreshCw size={18} />} loading={action.busy !== null} disabled={!data} onClick={() => data && recalibrate(data)}>
              {t('faceSecurity.recalibrate')}
            </Button>
          }
        />
        <PanelSection>
          {Boolean(error) && !data && <RetryState onRetry={retry} />}
          <KpiGrid kpis={kpis} />
          {data && <p className="muted small">{calibrationText(data)}</p>}
        </PanelSection>
        {data ? (
          <>
            <PanelSection title={t('faceSecurity.thresholdsSection')} icon={<SlidersHorizontal size={20} />}>
              <ThresholdList thresholds={data.thresholds} />
            </PanelSection>
            <PanelGrid>
              <PanelSection title={t('faceSecurity.reinforcedSection')} icon={<ShieldAlert size={20} />}>
                <ReinforcedCompanies companies={data.reinforced} minAttacks={data.escalation_min_attacks} windowMinutes={data.escalation_window_minutes} />
              </PanelSection>
              <PanelSection title={t('faceSecurity.flashSection')} icon={<Palette size={20} />} aside={<FlashReadinessBadge overview={data} />}>
                <FlashObservationPanel overview={data} />
              </PanelSection>
              {data.protocol && (
                <PanelSection title={t('faceSecurity.protocolSection')} icon={<Aperture size={20} />} aside={<ProtocolReadinessBadge overview={data} />}>
                  <CaptureProtocolPanel overview={{ ...data, protocol: data.protocol }} />
                </PanelSection>
              )}
              {data.ip_database && (
                <PanelSection title={t('faceSecurity.ipSection')} icon={<Globe size={20} />}>
                  <IpDatabasePanel status={data.ip_database} />
                </PanelSection>
              )}
            </PanelGrid>
          </>
        ) : (
          !error && (
            <PanelSection>
              <SkeletonRows rows={3} />
            </PanelSection>
          )
        )}
      </Panel>
    </div>
  );
}
