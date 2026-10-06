import { Activity, ArrowDownToLine, ArrowUpFromLine, Ban, Database, Gauge, ListOrdered, Route, ServerCrash, Siren, Timer, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { t, useT } from '../../i18n';
import type { MetricKind, MetricRow, PerformanceOverview, PerfPeriod, PerfTotals } from '../../types/performance';
import { formatBytes, formatCount, formatDuration, formatNumber, formatRate } from '../../utils/numbers';
import { metricLink, perMinute, tabLink } from '../../utils/performance';
import { BarList } from '../ui/BarList';
import { ButtonLink } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { KpiGrid, type Kpi } from '../ui/KpiCard';
import { RetryState } from '../ui/RetryState';
import { SkeletonCard } from '../ui/Skeleton';
import { LatencyChart, PerfBlock, VolumeChart } from './PerformanceParts';

/** Volumen y fallas del periodo (sin datos todavía, cada indicador muestra su esqueleto). */
function trafficKpis(totals: PerfTotals | undefined): Kpi[] {
  return [
    { key: 'throughput', label: t('performance.kpis.throughput'), icon: Gauge, value: totals?.throughput_per_minute, format: perMinute },
    { key: 'requests', label: t('performance.kpis.requests'), icon: Activity, value: totals?.requests, format: formatCount },
    {
      key: '5xx',
      label: t('performance.kpis.serverErrors'),
      icon: ServerCrash,
      value: totals?.error_rate,
      format: formatRate,
      tile: totals?.server_errors ? 'icon-tile--danger' : 'icon-tile--success',
      hint: totals && t('performance.kpis.requestsHint', { count: totals.server_errors }),
    },
    {
      key: '4xx',
      label: t('performance.kpis.clientErrors'),
      icon: Ban,
      value: totals?.client_error_rate,
      format: formatRate,
      tile: 'icon-tile--warning',
      hint: totals && t('performance.kpis.requestsHint', { count: totals.client_errors }),
    },
  ];
}

/** Tiempos (p50, p95, p99), base de datos y datos movidos del periodo. */
function timingKpis(totals: PerfTotals | undefined): Kpi[] {
  return [
    { key: 'p50', label: t('performance.kpis.p50'), icon: Timer, value: totals?.p50_ms, format: formatDuration, hint: t('performance.kpis.p50Hint') },
    { key: 'p95', label: t('performance.kpis.p95'), icon: Timer, value: totals?.p95_ms, format: formatDuration, hint: t('performance.kpis.p95Hint') },
    { key: 'p99', label: t('performance.kpis.p99'), icon: Timer, value: totals?.p99_ms, format: formatDuration, hint: totals && t('performance.kpis.maxHint', { max: formatDuration(totals.max_ms) }) },
    {
      key: 'db',
      label: t('performance.kpis.dbShare'),
      icon: Database,
      value: totals?.db_share,
      format: formatRate,
      hint: totals && t('performance.kpis.dbShareHint', { time: formatDuration(totals.avg_db_ms) }),
    },
    { key: 'queries', label: t('performance.kpis.queries'), icon: ListOrdered, value: totals?.avg_queries, format: (value) => formatNumber(value, 1), hint: t('performance.kpis.queriesHint') },
    { key: 'in', label: t('performance.kpis.bytesIn'), icon: ArrowDownToLine, value: totals?.bytes_in, format: formatBytes },
    { key: 'out', label: t('performance.kpis.bytesOut'), icon: ArrowUpFromLine, value: totals?.bytes_out, format: formatBytes },
  ];
}

/** Indicadores del periodo: volumen, fallas, tiempos, base de datos, datos y alertas abiertas. */
function SummaryKpis({ data }: { data: PerformanceOverview | null }) {
  const t = useT();
  const alerts: Kpi = {
    key: 'alerts',
    label: t('performance.kpis.openAlerts'),
    icon: Siren,
    value: data?.open_alerts,
    format: formatCount,
    tile: data?.open_alerts ? 'icon-tile--danger' : 'icon-tile--success',
    hint: t('performance.kpis.openAlertsHint', { threshold: formatDuration(data?.slow_threshold_ms), face: formatDuration(data?.slow_face_threshold_ms) }),
  };
  return <KpiGrid kpis={[...trafficKpis(data?.totals), ...timingKpis(data?.totals), alerts]} />;
}

interface TopListProps {
  kind: MetricKind;
  rows: MetricRow[];
  period: PerfPeriod;
}

/** Las 5 más lentas (rutas, por p95) o con más tiempo (funciones); cada una lleva a su detalle. */
function TopList({ kind, rows, period }: TopListProps) {
  const t = useT();
  const routes = kind === 'HTTP';
  if (!rows.length) {
    return routes ? (
      <EmptyState compact icon={<Route />} title={t('performance.top.routesEmptyTitle')} description={t('performance.longerPeriod')} />
    ) : (
      <EmptyState compact icon={<Workflow />} title={t('performance.top.functionsEmptyTitle')} description={t('performance.longerPeriod')} />
    );
  }
  const calls = (row: MetricRow) => t('performance.top.calls', { count: row.count });
  return (
    <BarList
      label={routes ? t('performance.top.routes') : t('performance.top.functions')}
      format={formatDuration}
      items={rows.map((row) => ({
        key: row.name,
        label: (
          <Link to={metricLink(kind, row.name, period)}>
            <code>{row.name}</code>
          </Link>
        ),
        value: routes ? row.p95_ms : row.total_ms,
        detail: routes ? calls(row) : t('performance.top.functionDetail', { calls: calls(row), p95: formatDuration(row.p95_ms) }),
      }))}
    />
  );
}

interface SummaryTabProps {
  period: PerfPeriod;
  data: PerformanceOverview | null;
  error: unknown;
  retry: () => void;
}

/**
 * Resumen del periodo: indicadores, peticiones y tiempos de respuesta por intervalo, y las rutas más lentas y
 * las funciones con más tiempo (cada una abre su detalle). Los datos los pide la pantalla (también para el
 * subtítulo y el contador de la pestaña Alertas).
 */
export function SummaryTab({ period, data, error, retry }: SummaryTabProps) {
  const t = useT();
  return (
    <div className="stack">
      {Boolean(error) && !data && <RetryState onRetry={retry} />}
      <SummaryKpis data={data} />
      {data ? (
        <div className="usage-charts">
          <VolumeChart points={data.points} period={period} title={t('performance.charts.requests')} value={(point) => point.requests} />
          <LatencyChart points={data.points} period={period} />
        </div>
      ) : (
        <SkeletonCard lines={6} />
      )}
      {data && (
        <div className="perf-grid">
          <PerfBlock
            title={t('performance.top.routes')}
            icon={<Route size={18} />}
            aside={
              <ButtonLink to={tabLink('routes', period)} size="sm" variant="ghost">
                {t('performance.top.viewAll')}
              </ButtonLink>
            }
          >
            <TopList kind="HTTP" rows={data.top_routes} period={period} />
          </PerfBlock>
          <PerfBlock
            title={t('performance.top.functions')}
            icon={<Workflow size={18} />}
            aside={
              <ButtonLink to={tabLink('functions', period)} size="sm" variant="ghost">
                {t('performance.top.viewAll')}
              </ButtonLink>
            }
          >
            <TopList kind="FUNCTION" rows={data.top_functions} period={period} />
          </PerfBlock>
        </div>
      )}
    </div>
  );
}
