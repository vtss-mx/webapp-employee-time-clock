import { BellRing, Database, DatabaseBackup, Gauge, MonitorSmartphone, Route, Workflow } from 'lucide-react';
import { useId } from 'react';
import { AlertsTab } from '../../../components/performance/AlertsTab';
import { BrowserTab } from '../../../components/performance/BrowserTab';
import { ContinuityTab } from '../../../components/performance/ContinuityTab';
import { MetricsTab } from '../../../components/performance/MetricsTab';
import { PeriodPicker } from '../../../components/performance/PerformanceParts';
import { StatementsTab } from '../../../components/performance/StatementsTab';
import { SummaryTab } from '../../../components/performance/SummaryTab';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { TabPanel, Tabs, type TabItem } from '../../../components/ui/Tabs';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useQueryOption } from '../../../hooks/useQueryOption';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { continuityService } from '../../../services/continuityService';
import { performanceService } from '../../../services/performanceService';
import { config } from '../../../utils/config';
import { formatDuration } from '../../../utils/numbers';
import { DEFAULT_PERIOD, PERIOD_KEYS, PERIODS } from '../../../utils/performance';

type PerfTab = 'summary' | 'routes' | 'functions' | 'browser' | 'sql' | 'alerts' | 'continuity';
const TABS: readonly PerfTab[] = ['summary', 'routes', 'functions', 'browser', 'sql', 'alerts', 'continuity'];
const overviewError = () => t('performance.loadError');
const continuityError = () => t('continuity.loadError');

/** Pestañas (sus nombres se piden al dibujar: siguen al idioma activo); Alertas lleva cuántas siguen abiertas. */
function perfTabs(openAlerts: number | undefined, overdueDrills: number | undefined): Array<TabItem<PerfTab>> {
  return [
    { key: 'summary', label: t('performance.tabs.summary'), icon: <Gauge size={16} /> },
    { key: 'routes', label: t('performance.tabs.routes'), icon: <Route size={16} /> },
    { key: 'functions', label: t('performance.tabs.functions'), icon: <Workflow size={16} /> },
    { key: 'browser', label: t('performance.tabs.browser'), icon: <MonitorSmartphone size={16} /> },
    { key: 'sql', label: t('performance.tabs.sql'), icon: <Database size={16} /> },
    { key: 'alerts', label: t('performance.tabs.alerts'), icon: <BellRing size={16} />, count: openAlerts, countLabel: t('performance.tabs.open') },
    // Continuidad (migración 0097): reutiliza esta pantalla a propósito, para no agregar una al contrato de pantallas.
    { key: 'continuity', label: t('performance.tabs.continuity'), icon: <DatabaseBackup size={16} />, count: overdueDrills, countLabel: t('performance.tabs.overdue') },
  ];
}

/**
 * Rendimiento de la plataforma (ADMIN): en el periodo de `?period=` (1 h a 90 días), el resumen, las rutas del
 * servidor, las funciones clave, lo que vive el navegador (Web Vitals y APIs), las consultas de la base y las
 * alertas de peticiones lentas, en pestañas (`?tab=`). Todo se actualiza solo mientras se ve; el resumen se pide
 * siempre (subtítulo y contador de Alertas) y cada pestaña pide su lista.
 */
export function PerformancePage() {
  const t = useT();
  const idBase = useId();
  const [tab, setTab] = useQueryOption<PerfTab>('tab', TABS, 'summary');
  const [period, setPeriod] = useQueryOption('period', PERIODS, DEFAULT_PERIOD);
  const overview = useResource((signal) => performanceService.overview(period, signal), period, overviewError);
  // La continuidad se pide aquí (no dentro de su pestaña) para que «vencido» —y «nunca ensayado», que cuenta como
  // vencido— se vea en el contador de la pestaña sin tener que abrirla, y para pedirla UNA vez (regla 6).
  const continuity = useResource((signal) => continuityService.overview(signal), 'continuity', continuityError);
  useAutoRefresh(overview.retry, config.performanceRefreshMs);
  const data = overview.data;

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('performance.title')}
          subtitle={data ? t('performance.subtitle', { period: t(`performance.period.long.${PERIOD_KEYS[period]}`), threshold: formatDuration(data.slow_threshold_ms), face: formatDuration(data.slow_face_threshold_ms) }) : t('common.states.loading')}
        />
        <PanelSection>
          <PeriodPicker value={period} onChange={setPeriod} />
          <Tabs items={perfTabs(data?.open_alerts, continuity.data?.overdue_count)} value={tab} onChange={setTab} label={t('performance.sections')} idBase={idBase} className="perf-tabs" />
          <TabPanel idBase={idBase} tab={tab}>
            {tab === 'summary' && <SummaryTab period={period} data={data} error={overview.error} retry={overview.retry} />}
            {tab === 'routes' && <MetricsTab kind="HTTP" period={period} />}
            {tab === 'functions' && <MetricsTab kind="FUNCTION" period={period} />}
            {tab === 'browser' && <BrowserTab period={period} />}
            {tab === 'sql' && <StatementsTab />}
            {tab === 'alerts' && <AlertsTab />}
            {tab === 'continuity' && <ContinuityTab data={continuity.data} error={continuity.error} retry={continuity.retry} />}
          </TabPanel>
        </PanelSection>
      </Panel>
    </div>
  );
}
