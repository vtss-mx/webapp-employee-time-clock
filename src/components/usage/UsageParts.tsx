import { Activity, ArrowDownToLine, ArrowUpFromLine, Ban, BarChart3, Database, ServerCrash, Timer } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import type { UsagePeriod } from '../../hooks/useUsagePeriod';
import { useT } from '../../i18n';
import type { StorageSummary, UsageCounters, UsageDay } from '../../types';
import { businessToday, formatDate } from '../../utils/format';
import { formatAxisCount, formatBytes, formatCount, formatDuration } from '../../utils/numbers';
import { dayLabel } from '../../utils/usage';
import { QuickChoices } from '../shifts/formFields';
import { BarList } from '../ui/BarList';
import { ColumnChart } from '../ui/ColumnChart';
import { DateField, parseIso } from '../ui/DateField';
import { EmptyState } from '../ui/EmptyState';
import { KpiGrid, type Kpi } from '../ui/KpiCard';
import { PanelSection } from '../ui/Panel';
import { RetryState } from '../ui/RetryState';
import { SkeletonCard } from '../ui/Skeleton';

/** Rango del consumo: hoy, este mes, el mes pasado o dos fechas a mano (con su error si no sirven). */
export function UsagePeriodPicker({ period }: { period: UsagePeriod }) {
  const t = useT();
  const { draft, errors, change, presets } = period;
  const today = businessToday();
  return (
    <div className="usage-period">
      {/* Cada rango rápido es "inicio|fin": queda marcado el que coincide con las fechas escritas. */}
      <QuickChoices
        label={t('usage.range.quick')}
        value={`${draft.start}|${draft.end}`}
        choices={presets.map((preset) => ({ value: `${preset.start}|${preset.end}`, text: preset.label }))}
        onPick={(value) => {
          const [start, end] = value.split('|');
          change({ start, end });
        }}
      />
      <div className="usage-period__fields">
        <DateField label={t('usage.range.from')} name="start" value={draft.start} max={today} error={draft.start ? errors.start : undefined} onChange={(start) => change({ ...draft, start })} />
        <DateField
          label={t('usage.range.to')}
          name="end"
          value={draft.end}
          min={parseIso(draft.start) ? draft.start : undefined}
          max={today}
          error={draft.end ? errors.end : undefined}
          onChange={(end) => change({ ...draft, end })}
        />
      </div>
    </div>
  );
}

/** Indicadores de consumo de un rango: peticiones, datos, tiempo de proceso, errores y almacenamiento. */
export function UsageKpis({ totals, storage }: { totals: UsageCounters | undefined; storage: StorageSummary | undefined }) {
  const t = useT();
  const kpis: Kpi[] = [
    { key: 'requests', label: t('usage.kpis.requests'), icon: Activity, value: totals?.requests, format: formatCount },
    { key: 'in', label: t('usage.kpis.bytesIn'), icon: ArrowDownToLine, value: totals?.bytes_in, format: formatBytes, hint: t('usage.kpis.bytesInHint') },
    { key: 'out', label: t('usage.kpis.bytesOut'), icon: ArrowUpFromLine, value: totals?.bytes_out, format: formatBytes, hint: t('usage.kpis.bytesOutHint') },
    {
      key: 'time',
      label: t('usage.kpis.duration'),
      icon: Timer,
      value: totals?.duration_ms,
      format: formatDuration,
      hint: totals ? t('usage.kpis.durationHint', { average: formatDuration(totals.avg_ms) }) : undefined,
    },
    { key: '5xx', label: t('usage.kpis.serverErrors'), icon: ServerCrash, value: totals?.server_errors, format: formatCount, tile: totals?.server_errors ? 'icon-tile--danger' : 'icon-tile--success' },
    { key: '4xx', label: t('usage.kpis.clientErrors'), icon: Ban, value: totals?.client_errors, format: formatCount, tile: 'icon-tile--warning', hint: t('usage.kpis.clientErrorsHint') },
    {
      key: 'storage',
      label: t('usage.kpis.storage'),
      icon: Database,
      value: storage?.bytes,
      format: formatBytes,
      hint: storage ? t('usage.storage.rows', { count: storage.rows }) : undefined,
    },
  ];
  return <KpiGrid kpis={kpis} />;
}

/** Consumo por día: peticiones y, aparte (otra escala), los datos de entrada y salida en pares. */
export function UsageCharts({ days }: { days: UsageDay[] }) {
  const t = useT();
  return (
    <div className="usage-charts">
      <section className="usage-charts__chart">
        <h3>{t('usage.charts.requests')}</h3>
        <ColumnChart
          title={t('usage.charts.requests')}
          items={days}
          itemKey={(day) => day.day}
          itemLabel={(day) => dayLabel(day.day)}
          series={[{ key: 'requests', label: t('usage.kpis.requests'), value: (day) => day.requests }]}
          format={formatAxisCount}
        />
      </section>
      <section className="usage-charts__chart">
        <h3>{t('usage.charts.data')}</h3>
        <ColumnChart
          title={t('usage.charts.data')}
          items={days}
          itemKey={(day) => day.day}
          itemLabel={(day) => dayLabel(day.day)}
          series={[
            { key: 'in', label: t('usage.charts.in'), value: (day) => day.bytes_in },
            { key: 'out', label: t('usage.charts.out'), value: (day) => day.bytes_out },
          ]}
          format={formatBytes}
        />
      </section>
    </div>
  );
}

/** Almacenamiento por categoría (última foto del mantenimiento diario), como parte del total. */
export function StorageBreakdown({ storage }: { storage: StorageSummary }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  if (!storage.day) {
    return <EmptyState compact icon={<Database />} title={t('usage.storage.emptyTitle')} description={t('usage.storage.emptyDescription')} />;
  }
  return (
    <div className="stack">
      <p className="muted">{t('usage.storage.snapshot', { date: formatDate(storage.day), bytes: formatBytes(storage.bytes), rows: t('usage.storage.rows', { count: storage.rows }) })}</p>
      <BarList
        label={t('usage.storage.byCategory')}
        scale="total"
        format={formatBytes}
        items={storage.items.map((item) => ({
          key: item.category,
          label: nameOf('storage_categories', item.category),
          value: item.bytes,
          detail: t('usage.storage.rows', { count: item.rows }),
        }))}
      />
    </div>
  );
}

/** Lo que comparten el consumo general y el de una empresa: sus totales, sus días y su almacenamiento. */
interface UsageData {
  totals: UsageCounters;
  days: UsageDay[];
  storage: StorageSummary;
}

interface UsageSummaryProps {
  period: UsagePeriod;
  data: UsageData | null;
  /** Error de la carga: sin datos todavía, se ofrece volver a cargar. */
  error: unknown;
  retry: () => void;
}

/** Arriba de las pantallas de consumo: el rango de días y los indicadores del rango. */
export function UsageSummary({ period, data, error, retry }: UsageSummaryProps) {
  return (
    <PanelSection>
      <UsagePeriodPicker period={period} />
      {Boolean(error) && !data && <RetryState onRetry={retry} />}
      <UsageKpis totals={data?.totals} storage={data?.storage} />
    </PanelSection>
  );
}

/** "Día por día": las gráficas del rango (esqueleto mientras llegan). */
export function DailySection({ data }: { data: UsageData | null }) {
  const t = useT();
  return (
    <PanelSection title={t('usage.daily')} icon={<BarChart3 size={20} />}>
      {data ? <UsageCharts days={data.days} /> : <SkeletonCard lines={5} />}
    </PanelSection>
  );
}

/** "Almacenamiento" por categoría (esqueleto mientras llega). */
export function StorageSection({ data }: { data: UsageData | null }) {
  const t = useT();
  return (
    <PanelSection title={t('usage.kpis.storage')} icon={<Database size={20} />}>
      {data ? <StorageBreakdown storage={data.storage} /> : <SkeletonCard lines={4} />}
    </PanelSection>
  );
}
