import { SearchX, Timer } from 'lucide-react';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { performanceService } from '../../services/performanceService';
import type { MetricKind, MetricPage, MetricRow, MetricSort, PerfPeriod } from '../../types/performance';
import { config } from '../../utils/config';
import { formatBytes, formatCount, formatDuration, formatNumber, formatRate } from '../../utils/numbers';
import { metricLink } from '../../utils/performance';
import { ListToolbar } from '../ui/ListControls';
import { ListResults } from '../ui/ListResults';
import { Select } from '../ui/Select';

const SORT_KEYS: readonly MetricSort[] = ['impact', 'p95', 'mean', 'max', 'count', 'errors'];

/** Órdenes de la lista (sus nombres se piden al dibujar: siguen al idioma activo). */
const sortOptions = () => SORT_KEYS.map((value) => ({ value, label: t(`performance.metrics.sort.${value}`) }));
const loadError = () => t('performance.metrics.loadError');

/** Celdas de una métrica: tiempos, fallas y, en las rutas del servidor, base de datos y datos movidos. */
function MetricCells({ row }: { row: MetricRow }) {
  const t = useT();
  return (
    <>
      <td className="table__primary table__wide">
        <code className="perf-name">{row.name}</code>
        <small className="muted table__note">{t('performance.metrics.share', { share: formatRate(row.share) })}</small>
      </td>
      <td data-label={t('performance.metrics.columns.calls')}>{formatCount(row.count)}</td>
      <td data-label={t('performance.metrics.columns.p95')}>
        {formatDuration(row.p95_ms)}
        <small className="muted table__note">{t('performance.metrics.percentiles', { p50: formatDuration(row.p50_ms), p99: formatDuration(row.p99_ms) })}</small>
      </td>
      <td data-label={t('performance.metrics.columns.average')}>
        {formatDuration(row.avg_ms)}
        <small className="muted table__note">{t('performance.metrics.max', { max: formatDuration(row.max_ms) })}</small>
      </td>
      <td data-label={t('performance.metrics.columns.errors')}>
        {formatCount(row.errors)} · {formatRate(row.error_rate)}
        {row.client_errors > 0 && <small className="muted table__note">{t('performance.metrics.clientErrors', { count: row.client_errors })}</small>}
      </td>
      {row.kind === 'HTTP' && (
        <>
          <td data-label={t('performance.metrics.columns.database')}>
            {formatRate(row.db_share)}
            <small className="muted table__note">{t('performance.metrics.queries', { value: formatNumber(row.avg_queries, 1) })}</small>
          </td>
          <td data-label={t('performance.metrics.columns.data')}>
            {formatBytes(row.bytes_in)} / {formatBytes(row.bytes_out)}
          </td>
        </>
      )}
    </>
  );
}

/** Encabezados de la tabla: las rutas del servidor llevan además base de datos y datos movidos. */
function columnsFor(kind: MetricKind): string[] {
  const common = ['name', 'calls', 'p95', 'average', 'errors'] as const;
  const extra = kind === 'HTTP' ? (['database', 'data'] as const) : [];
  return [...common, ...extra].map((column) => t(`performance.metrics.columns.${column}`));
}

/**
 * Lista paginada de un tipo de métrica en el periodo: búsqueda (contiene, sin distinguir mayúsculas), orden
 * (impacto, p95, promedio, máximo, llamadas o fallas) y cada fila abre el detalle de la métrica en el tiempo. Se
 * actualiza sola mientras se ve.
 */
export function MetricsTab({ kind, period }: { kind: MetricKind; period: PerfPeriod }) {
  const t = useT();
  const navigate = useNavigate();
  const sortId = useId();
  const [sort, setSort] = useState<MetricSort>('impact');
  const list = useSearchList<MetricRow, Pick<MetricPage, 'kind' | 'sort'>>(
    (query, signal) => performanceService.metrics({ kind, period, sort, page: query.page, size: query.size, search: query.search }, signal),
    { errorTitle: loadError, filterKey: `${kind}|${period}|${sort}` },
  );
  useAutoRefresh(list.retry, config.performanceRefreshMs);

  return (
    <div className="stack">
      <p className="muted small">{t(`performance.metrics.intro.${kind}`)}</p>
      <ListToolbar search={list.search} onSearch={list.setSearch} placeholder={t(`performance.metrics.searchPlaceholder.${kind}`)} label={t('performance.metrics.searchLabel')} />
      <div className="toolbar">
        <span className="muted" id={sortId}>
          {t('performance.metrics.sort.label')}
        </span>
        <Select<MetricSort> value={sort} onChange={setSort} options={sortOptions()} aria-labelledby={sortId} />
      </div>
      <ListResults
        list={list}
        rowKey={(row) => row.name}
        pager={{ noun: { one: t(`performance.metrics.noun.${kind}.one`), other: t(`performance.metrics.noun.${kind}.other`) } }}
        columns={columnsFor(kind)}
        onOpen={(row) => void navigate(metricLink(kind, row.name, period))}
        empty={
          list.filtered
            ? { icon: <SearchX />, title: t('performance.metrics.noMatchTitle'), description: t('performance.metrics.noMatchDescription'), compact: true }
            : { icon: <Timer />, title: t('performance.metrics.emptyTitle'), description: t('performance.longerPeriod'), compact: true }
        }
        renderCells={(row) => <MetricCells row={row} />}
      />
    </div>
  );
}
