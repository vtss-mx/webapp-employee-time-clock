import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import type { PerfPeriod, Vital } from '../../types/performance';
import { formatAxisCount, formatDuration } from '../../utils/numbers';
import { PERIOD_KEYS, PERIODS, periodFrom, pointLabel, RATING_CLASS, vitalThresholds, vitalValue } from '../../utils/performance';
import { QuickChoices } from '../shifts/formFields';
import { ColumnChart } from '../ui/ColumnChart';

/** Bloque con título dentro de una pestaña (la pestaña ya vive en una sección del panel: no se anidan secciones). */
export function PerfBlock({ title, icon, aside, intro, children }: { title: string; icon: ReactNode; aside?: ReactNode; intro?: string; children: ReactNode }) {
  return (
    <section className="perf-block">
      <div className="perf-block__head">
        <h3>
          {icon} {title}
        </h3>
        {aside}
      </div>
      {intro && <p className="muted small">{intro}</p>}
      {children}
    </section>
  );
}

/** Datos "etiqueta: valor" de un detalle (la lista `details` de la app). */
export function FactList({ items }: { items: ReadonlyArray<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="details">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Periodo de la pantalla: una ficha por periodo (1 h a 90 días); el elegido queda marcado. */
export function PeriodPicker({ value, onChange }: { value: PerfPeriod; onChange: (period: PerfPeriod) => void }) {
  const t = useT();
  return (
    <QuickChoices
      label={t('performance.period.label')}
      value={value}
      choices={PERIODS.map((period) => ({ value: period, text: t(`performance.period.short.${PERIOD_KEYS[period]}`) }))}
      onPick={(next) => onChange(periodFrom(next))}
    />
  );
}

/** Lo que tiene un punto de la serie de tiempos (el resumen y una métrica). */
interface LatencyPoint {
  at: string;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

interface TimeChartProps<T> {
  points: readonly T[];
  period: PerfPeriod;
}

/** Categorías de las gráficas de tiempo: intervalos (su etiqueta, la hora o el día según el periodo). */
function useIntervals(period: PerfPeriod) {
  const t = useT();
  return {
    itemKey: (point: { at: string }) => point.at,
    itemLabel: (point: { at: string }) => pointLabel(point.at, period),
    category: { header: t('performance.charts.interval.header'), one: t('performance.charts.interval.one'), other: t('performance.charts.interval.other') },
  };
}

/** Tiempo de respuesta en el tiempo: p50, p95 y p99 como tres líneas (un eje en milisegundos). */
export function LatencyChart<T extends LatencyPoint>({ points, period }: TimeChartProps<T>) {
  const t = useT();
  const intervals = useIntervals(period);
  return (
    <section className="usage-charts__chart">
      <h3>{t('performance.charts.latency')}</h3>
      <ColumnChart
        variant="lines"
        title={t('performance.charts.latency')}
        items={points}
        {...intervals}
        series={[
          { key: 'p50', label: 'p50', value: (point) => point.p50_ms },
          { key: 'p95', label: 'p95', value: (point) => point.p95_ms },
          { key: 'p99', label: 'p99', value: (point) => point.p99_ms },
        ]}
        format={formatDuration}
      />
    </section>
  );
}

/** Volumen en el tiempo (peticiones o llamadas por intervalo), en su propia escala. */
export function VolumeChart<T extends { at: string }>({ points, period, title, value }: TimeChartProps<T> & { title: string; value: (point: T) => number }) {
  const intervals = useIntervals(period);
  return (
    <section className="usage-charts__chart">
      <h3>{title}</h3>
      <ColumnChart title={title} items={points} {...intervals} series={[{ key: 'volume', label: title, value }]} format={formatAxisCount} />
    </section>
  );
}

/** Una Web Vital de una pantalla: su p75 con el color de la calificación, la calificación escrita y los umbrales. */
export function VitalCell({ vital }: { vital: Vital | null }) {
  const t = useT();
  if (!vital) return <span className="muted">{t('performance.vitals.noData')}</span>;
  return (
    <span className="perf-vital" title={vitalThresholds(vital)}>
      <span className={`badge ${RATING_CLASS[vital.rating]}`}>{vitalValue(vital.p75, vital.unit)}</span>
      <small className="muted">
        {t(`performance.vitals.rating.${vital.rating}`)} · {t('performance.vitals.views', { count: vital.count })}
      </small>
    </span>
  );
}
