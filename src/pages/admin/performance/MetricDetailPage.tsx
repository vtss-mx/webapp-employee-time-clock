import { Activity, ArrowDownToLine, ArrowUpFromLine, BellRing, ChartLine, Database, SearchX, ServerCrash, Timer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { LatencyChart, PeriodPicker, VolumeChart } from '../../../components/performance/PerformanceParts';
import { ButtonLink } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { KpiGrid, type Kpi } from '../../../components/ui/KpiCard';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useQueryOption } from '../../../hooks/useQueryOption';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { performanceService } from '../../../services/performanceService';
import type { MetricKind, MetricRow } from '../../../types/performance';
import { config } from '../../../utils/config';
import { formatBytes, formatCount, formatDuration, formatNumber, formatRate } from '../../../utils/numbers';
import { DEFAULT_PERIOD, KIND_TABS, kindFrom, PERIOD_KEYS, PERIODS, tabLink } from '../../../utils/performance';

const loadError = () => t('performance.metric.loadError');

/** Totales de la métrica en el periodo; las rutas del servidor llevan además base de datos y datos movidos. */
function MetricKpis({ totals }: { totals: MetricRow | undefined }) {
  const t = useT();
  const kpis: Kpi[] = [
    { key: 'calls', label: t('performance.kpis.calls'), icon: Activity, value: totals?.count, format: formatCount },
    {
      key: 'errors',
      label: t('performance.kpis.errorRate'),
      icon: ServerCrash,
      value: totals?.error_rate,
      format: formatRate,
      tile: totals?.errors ? 'icon-tile--danger' : 'icon-tile--success',
      hint: totals && t('performance.kpis.errorRateHint', { count: totals.errors }),
    },
    { key: 'p50', label: t('performance.kpis.p50'), icon: Timer, value: totals?.p50_ms, format: formatDuration, hint: t('performance.kpis.p50Hint') },
    { key: 'p95', label: t('performance.kpis.p95'), icon: Timer, value: totals?.p95_ms, format: formatDuration, hint: t('performance.kpis.p95Hint') },
    { key: 'p99', label: t('performance.kpis.p99'), icon: Timer, value: totals?.p99_ms, format: formatDuration },
    { key: 'avg', label: t('performance.kpis.average'), icon: Timer, value: totals?.avg_ms, format: formatDuration, hint: totals && t('performance.kpis.averageHint', { max: formatDuration(totals.max_ms) }) },
  ];
  if (totals?.kind === 'HTTP') {
    kpis.push(
      {
        key: 'db',
        label: t('performance.kpis.dbShare'),
        icon: Database,
        value: totals.db_share ?? 0,
        format: formatRate,
        hint: t('performance.metrics.queries', { value: formatNumber(totals.avg_queries, 1) }),
      },
      { key: 'in', label: t('performance.kpis.bytesIn'), icon: ArrowDownToLine, value: totals.bytes_in, format: formatBytes },
      { key: 'out', label: t('performance.kpis.bytesOut'), icon: ArrowUpFromLine, value: totals.bytes_out, format: formatBytes },
    );
  }
  return <KpiGrid kpis={kpis} />;
}

/** Sin `?kind=` válido o sin `?name=`: no hay qué consultar; se explica y se ofrece volver. */
function MissingMetric() {
  const t = useT();
  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('performance.title')} backTo={paths.admin.performance} backLabel={t('performance.title')} />
        <PanelSection>
          <EmptyState icon={<SearchX />} title={t('performance.metric.missingTitle')} description={t('performance.metric.missingDescription')} />
        </PanelSection>
      </Panel>
    </div>
  );
}

/** Detalle de una métrica válida: totales, volumen y tiempos en el tiempo, y su alerta si la tiene. */
function MetricDetail({ kind, name }: { kind: MetricKind; name: string }) {
  const t = useT();
  const [period, setPeriod] = useQueryOption('period', PERIODS, DEFAULT_PERIOD);
  const series = useResource((signal) => performanceService.series(kind, name, period, signal), `${kind}|${name}|${period}`, loadError);
  useAutoRefresh(series.retry, config.performanceRefreshMs);
  const data = series.data;
  const alertId = data?.slow_alert_id ?? null;

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={name}
          subtitle={`${t(`performance.kinds.${kind}`)} · ${t(`performance.period.long.${PERIOD_KEYS[period]}`)}`}
          backTo={tabLink(KIND_TABS[kind], period)}
          backLabel={t('performance.title')}
          actions={
            alertId !== null && (
              <ButtonLink to={paths.admin.performanceAlert(alertId)} variant="secondary" icon={<BellRing size={18} />}>
                {t('performance.metric.alert')}
              </ButtonLink>
            )
          }
        />
        <PanelSection title={t('performance.metric.totals')} icon={<Activity size={20} />}>
          <PeriodPicker value={period} onChange={setPeriod} />
          {Boolean(series.error) && !data && <RetryState onRetry={series.retry} />}
          <MetricKpis totals={data?.totals} />
        </PanelSection>
        <PanelSection title={t('performance.metric.charts')} icon={<ChartLine size={20} />}>
          {!data && <SkeletonCard lines={6} />}
          {data && data.totals.count === 0 && <EmptyState compact icon={<Timer />} title={t('performance.metric.emptyTitle')} description={t('performance.longerPeriod')} />}
          {data && data.totals.count > 0 && (
            <div className="usage-charts">
              <VolumeChart points={data.points} period={period} title={t('performance.charts.calls')} value={(point) => point.count} />
              <LatencyChart points={data.points} period={period} />
            </div>
          )}
        </PanelSection>
      </Panel>
    </div>
  );
}

/**
 * Una métrica en el tiempo (`/admin/performance/metric?kind=&name=&period=`): una ruta del servidor, una función o
 * una API vista desde el navegador. El enlace se puede compartir; el periodo se cambia aquí mismo.
 */
export function MetricDetailPage() {
  const [params] = useSearchParams();
  const kind = kindFrom(params.get('kind'));
  const name = params.get('name')?.trim() ?? '';
  if (!kind || !name) return <MissingMetric />;
  return <MetricDetail kind={kind} name={name} />;
}
