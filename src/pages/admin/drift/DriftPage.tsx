import { AlertTriangle, Building2, CalendarRange, Calculator, GitCommitVertical, HelpCircle, TrendingDown } from 'lucide-react';
import { useId, useState } from 'react';
import { DriftCompaniesTab, DriftSignalsTab, DriftVersions } from '../../../components/drift/DriftParts';
import { Button } from '../../../components/ui/Button';
import { KpiGrid, type Kpi } from '../../../components/ui/KpiCard';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { Select } from '../../../components/ui/Select';
import { TabPanel, Tabs, type TabItem } from '../../../components/ui/Tabs';
import { useAction } from '../../../hooks/useAction';
import { useQueryOption } from '../../../hooks/useQueryOption';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { driftService } from '../../../services/driftService';
import type { DriftPlatform, DriftStatus, DriftSummary } from '../../../types/drift';
import type { ConfirmInput } from '../../../types/confirm';
import { formatDate } from '../../../utils/format';
import { formatCount, formatNumber, formatRate } from '../../../utils/numbers';

type DriftTab = 'signals' | 'companies' | 'versions';
const TABS: readonly DriftTab[] = ['signals', 'companies', 'versions'];
const PLATFORMS: readonly DriftPlatform[] = ['IOS_SAFARI', 'ANDROID_CHROME', 'DESKTOP', 'OTHER'];
const STATUSES: readonly DriftStatus[] = ['OK', 'ALERT', 'INSUFFICIENT', 'NO_BASELINE', 'VERSION_CHANGE'];
const LATEST = 'latest';
const loadError = () => t('drift.loadError');
const computeError = () => t('drift.computeError');
const computed = () => t('drift.computed');

/** Qué hace «Calcular ahora»: repite el cálculo de la última semana completa, solo mide y avisa. */
function computeConfirm(): ConfirmInput {
  return {
    kind: 'action',
    icon: <Calculator size={30} />,
    eyebrow: t('drift.computeAsk.eyebrow'),
    title: t('drift.computeAsk.title'),
    message: t('drift.computeAsk.message'),
    note: t('drift.computeAsk.note'),
    confirmLabel: t('drift.computeAsk.confirm'),
    confirmIcon: <Calculator size={18} />,
  };
}

/** La regla de la alerta y la ventana, con lo configurado en el servidor. */
function ruleText(summary: DriftSummary): string {
  return t('drift.rule', {
    psi: formatNumber(summary.psi_alert, 2),
    drop: formatRate(summary.tail_drop_alert * 100, 0),
    samples: formatCount(summary.min_samples),
    days: summary.window_days,
  });
}

/** Los indicadores de la semana más reciente (alertas en rojo solo cuando las hay). */
function driftKpis(data: DriftSummary | null): Kpi[] {
  return [
    { key: 'alerts', label: t('drift.kpis.alerts'), icon: AlertTriangle, value: data?.alerts, tile: data?.alerts ? 'icon-tile--danger' : 'icon-tile--success' },
    { key: 'insufficient', label: t('drift.kpis.insufficient'), icon: HelpCircle, value: data?.insufficient, tile: '' },
    { key: 'companies', label: t('drift.kpis.companies'), icon: Building2, value: data?.companies_alerted, tile: data?.companies_alerted ? 'icon-tile--warning' : '' },
    { key: 'weeks', label: t('drift.kpis.weeks'), icon: CalendarRange, value: data?.weeks.length, tile: '' },
  ];
}

interface FiltersProps {
  weeks: string[];
  week: string;
  onWeek: (week: string) => void;
  /** Solo la pestaña de señales filtra por plataforma y estado. */
  signals: boolean;
  platform: DriftPlatform | 'all';
  onPlatform: (platform: DriftPlatform | 'all') => void;
  status: DriftStatus | 'all';
  onStatus: (status: DriftStatus | 'all') => void;
}

/** Semana (la más reciente o una calculada), plataforma y estado, con listas propias. */
function DriftFilters({ weeks, week, onWeek, signals, platform, onPlatform, status, onStatus }: FiltersProps) {
  const t = useT();
  const weekOptions = [{ value: LATEST, label: t('drift.filters.latest') }, ...weeks.map((value) => ({ value, label: t('drift.weekOf', { date: formatDate(value) }) }))];
  return (
    <div className="toolbar">
      <Select<string> value={week} onChange={onWeek} aria-label={t('drift.filters.week')} icon={<CalendarRange size={16} />} options={weekOptions} />
      {signals && (
        <>
          <Select<DriftPlatform | 'all'>
            value={platform}
            onChange={onPlatform}
            aria-label={t('drift.filters.platform')}
            options={[{ value: 'all', label: t('drift.filters.allPlatforms') }, ...PLATFORMS.map((value) => ({ value, label: t(`drift.platforms.${value}`) }))]}
          />
          <Select<DriftStatus | 'all'>
            value={status}
            onChange={onStatus}
            aria-label={t('drift.filters.status')}
            options={[{ value: 'all', label: t('drift.filters.allStatuses') }, ...STATUSES.map((value) => ({ value, label: t(`drift.status.${value}`) }))]}
          />
        </>
      )}
    </div>
  );
}

function driftTabs(): Array<TabItem<DriftTab>> {
  return [
    { key: 'signals', label: t('drift.tabs.signals'), icon: <TrendingDown size={16} /> },
    { key: 'companies', label: t('drift.tabs.companies'), icon: <Building2 size={16} /> },
    { key: 'versions', label: t('drift.tabs.versions'), icon: <GitCommitVertical size={16} /> },
  ];
}

/**
 * Deriva de las señales del motor facial (ADMIN, antifraude fase 3): cada semana, por señal y plataforma, los intentos
 * genuinos frente a la semana anterior (mediana, cola y PSI), por empresa la tasa de casos y las revisiones aprobadas
 * sin mirar, y la bitácora de versiones del motor. Filtros de semana, plataforma y estado; listas paginadas en el
 * backend; «Calcular ahora» repite el cálculo de la última semana completa (confirmado, solo mide y avisa).
 */
export function DriftPage() {
  const t = useT();
  const idBase = useId();
  const [tab, setTab] = useQueryOption<DriftTab>('tab', TABS, 'signals');
  const [week, setWeek] = useState<string>(LATEST);
  const [platform, setPlatform] = useState<DriftPlatform | 'all'>('all');
  const [status, setStatus] = useState<DriftStatus | 'all'>('all');
  const summary = useResource((signal) => driftService.summary(signal), 'drift-summary', loadError);
  const action = useAction();
  const data = summary.data;
  const chosenWeek = week === LATEST ? (data?.latest_week ?? null) : week;

  const compute = () =>
    void action.run(() => driftService.compute(), {
      confirm: computeConfirm,
      errorTitle: computeError,
      success: (result) => [computed(), result.message],
      onSuccess: (result) => summary.setData(result.summary),
    });


  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('drift.title')}
          subtitle={t('drift.subtitle')}
          actions={
            <Button variant="primary" icon={<Calculator size={18} />} loading={action.busy !== null} disabled={!data} onClick={compute}>
              {t('drift.compute')}
            </Button>
          }
        />
        <PanelSection>
          {Boolean(summary.error) && !data && <RetryState onRetry={summary.retry} />}
          <KpiGrid kpis={driftKpis(data)} />
          {data && <p className="muted small">{ruleText(data)}</p>}
        </PanelSection>
        <PanelSection>
          <DriftFilters weeks={data?.weeks ?? []} week={week} onWeek={setWeek} signals={tab === 'signals'} platform={platform} onPlatform={setPlatform} status={status} onStatus={setStatus} />
          <Tabs items={driftTabs()} value={tab} onChange={setTab} label={t('drift.sections')} idBase={idBase} className="perf-tabs" />
          <TabPanel idBase={idBase} tab={tab}>
            {tab === 'signals' && <DriftSignalsTab week={chosenWeek} platform={platform} status={status} />}
            {tab === 'companies' && <DriftCompaniesTab week={chosenWeek} quickSeconds={data?.quick_review_seconds} />}
            {tab === 'versions' && <DriftVersions versions={data?.versions ?? []} />}
          </TabPanel>
        </PanelSection>
      </Panel>
    </div>
  );
}
