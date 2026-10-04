import { CheckCircle2, Palette, RefreshCw, ShieldAlert, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { FlashObservationPanel, FlashReadinessBadge, ReinforcedCompanies, ThresholdList } from '../../components/faceSecurity/FaceSecuritySections';
import { Button } from '../../components/ui/Button';
import { KpiGrid, type Kpi } from '../../components/ui/KpiCard';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { faceSecurityService } from '../../services/faceSecurityService';
import type { FaceSecurityOverview } from '../../types/faceSecurity';
import type { ConfirmInput } from '../../types/confirm';

/** Cada cuánto recalcula la plataforma, legible: "6 h", "1.5 h". */
const hours = (value: number) => `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })} h`;

/** Qué hace "Recalcular ahora": con qué datos y que solo endurece. */
function recalibrateConfirm(overview: FaceSecurityOverview): ConfirmInput {
  return {
    kind: 'action',
    icon: <RefreshCw size={30} />,
    eyebrow: 'Seguridad facial',
    title: '¿Recalcular ahora los umbrales?',
    message: `Se recalculan con los intentos exitosos de los últimos ${overview.window_days} días, lo mismo que hace la plataforma cada ${hours(overview.interval_hours)}.`,
    details: [
      { label: 'Ventana', value: `${overview.window_days} días` },
      { label: 'Mediciones para mover un umbral', value: overview.min_samples.toLocaleString('es-MX') },
    ],
    note: 'Solo endurece: ningún umbral baja de su mínimo ni sube de su tope (para no dejar fuera a personas reales).',
    confirmLabel: 'Recalcular ahora',
    confirmIcon: <RefreshCw size={18} />,
  };
}

/** Cómo se calibra la plataforma (texto bajo los indicadores). */
function calibrationText(overview: FaceSecurityOverview): string {
  if (!overview.autocalibration) return 'La autocalibración está apagada en la configuración del servidor: los umbrales se quedan en su mínimo.';
  return `Cada ${hours(overview.interval_hours)} la plataforma mide los intentos exitosos de los últimos ${overview.window_days} días y sube cada umbral hasta donde casi todas las personas reales pasan con holgura (con al menos ${overview.min_samples.toLocaleString('es-MX')} mediciones). Nunca lo baja.`;
}

/**
 * Seguridad facial de la plataforma (solo el ADMIN): lo que la plataforma endureció sola (umbrales
 * autocalibrados de la prueba de vida y del anti-spoofing), las empresas reforzadas por ataques y lo
 * medido del destello de colores para decidir cuándo exigirlo. "Recalcular ahora" hace lo mismo que
 * el mantenimiento automático (solo endurece).
 */
export function FaceSecurityPage() {
  const { data, setData, error, retry } = useResource((signal) => faceSecurityService.overview(signal), 'face-security', 'No se pudo cargar la seguridad facial');
  const action = useAction();

  const recalibrate = (overview: FaceSecurityOverview) =>
    void action.run(() => faceSecurityService.recalibrate(), {
      confirm: recalibrateConfirm(overview),
      errorTitle: 'No se pudieron recalcular los umbrales',
      success: (result) => ['Umbrales recalculados', result.message],
      onSuccess: (result) => setData(result.overview),
    });

  const kpis: Kpi[] = [
    { key: 'raised', label: 'Umbrales endurecidos', icon: ShieldCheck, value: data?.thresholds.filter((t) => t.raised).length, tile: 'icon-tile--success' },
    { key: 'reinforced', label: 'Empresas reforzadas', icon: ShieldAlert, value: data?.reinforced.length, tile: 'icon-tile--warning' },
    { key: 'measured', label: 'Destellos medidos', icon: Palette, value: data?.flash.measured, tile: '' },
    { key: 'conclusive', label: 'Destellos concluyentes', icon: CheckCircle2, value: data?.flash.conclusive, tile: '' },
  ];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Seguridad facial"
          subtitle="Lo que la plataforma endureció sola, las empresas bajo ataque y lo medido del destello de colores."
          actions={
            <Button variant="primary" icon={<RefreshCw size={18} />} loading={action.busy !== null} disabled={!data} onClick={() => data && recalibrate(data)}>
              Recalcular ahora
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
            <PanelSection title="Umbrales que se endurecen solos" icon={<SlidersHorizontal size={20} />}>
              <ThresholdList thresholds={data.thresholds} />
            </PanelSection>
            <PanelGrid>
              <PanelSection title="Empresas reforzadas por ataques" icon={<ShieldAlert size={20} />}>
                <ReinforcedCompanies companies={data.reinforced} minAttacks={data.escalation_min_attacks} windowMinutes={data.escalation_window_minutes} />
              </PanelSection>
              <PanelSection title="Destello de colores" icon={<Palette size={20} />} aside={<FlashReadinessBadge overview={data} />}>
                <FlashObservationPanel overview={data} />
              </PanelSection>
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
