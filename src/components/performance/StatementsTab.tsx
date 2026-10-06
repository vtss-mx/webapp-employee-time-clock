import { DatabaseZap, Database } from 'lucide-react';
import { useId, useState } from 'react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { usePagedList } from '../../hooks/usePagedList';
import { t, useT } from '../../i18n';
import { performanceService } from '../../services/performanceService';
import type { Statement, StatementPage, StatementSort } from '../../types/performance';
import { config } from '../../utils/config';
import { formatCount, formatDuration, formatRate } from '../../utils/numbers';
import { ListResults } from '../ui/ListResults';
import { Select } from '../ui/Select';

const SORT_KEYS: readonly StatementSort[] = ['total', 'mean', 'max', 'calls'];
const sortOptions = () => SORT_KEYS.map((value) => ({ value, label: t(`performance.statements.sort.${value}`) }));
const loadError = () => t('performance.statements.loadError');
const COLUMNS = ['query', 'calls', 'total', 'mean', 'max', 'rows'] as const;

/** Una consulta normalizada (sin valores) con sus llamadas y tiempos. */
function StatementCells({ row }: { row: Statement }) {
  const t = useT();
  return (
    <>
      <td className="table__primary table__wide">
        <code className="perf-query" title={row.query}>
          {row.query}
        </code>
      </td>
      <td data-label={t('performance.statements.columns.calls')}>{formatCount(row.calls)}</td>
      <td data-label={t('performance.statements.columns.total')}>
        {formatDuration(row.total_ms)}
        <small className="muted table__note">{t('performance.statements.share', { share: formatRate(row.share) })}</small>
      </td>
      <td data-label={t('performance.statements.columns.mean')}>{formatDuration(row.mean_ms)}</td>
      <td data-label={t('performance.statements.columns.max')}>{formatDuration(row.max_ms)}</td>
      <td data-label={t('performance.statements.columns.rows')}>{formatCount(row.rows)}</td>
    </>
  );
}

/**
 * Las consultas de la base que más tiempo usan (pg_stat_statements, acumulado desde su último reinicio; no
 * depende del periodo). Sin la extensión en la base, el vacío lo explica. Se actualiza sola mientras se ve.
 */
export function StatementsTab() {
  const t = useT();
  const sortId = useId();
  const [sort, setSort] = useState<StatementSort>('total');
  const list = usePagedList<Statement, Pick<StatementPage, 'available'>>((query, signal) => performanceService.statements({ ...query, sort }, signal), {
    errorTitle: loadError,
    filterKey: sort,
  });
  useAutoRefresh(list.retry, config.performanceRefreshMs);
  const unavailable = list.data?.available === false;

  return (
    <div className="stack">
      <p className="muted small">{t('performance.statements.intro')}</p>
      <div className="toolbar">
        <span className="muted" id={sortId}>
          {t('performance.statements.sort.label')}
        </span>
        <Select<StatementSort> value={sort} onChange={setSort} options={sortOptions()} aria-labelledby={sortId} disabled={unavailable} />
      </div>
      <ListResults
        list={list}
        rowKey={(row) => row.query_id}
        pager={{ noun: { one: t('performance.statements.noun.one'), other: t('performance.statements.noun.other') } }}
        columns={COLUMNS.map((column) => t(`performance.statements.columns.${column}`))}
        empty={
          unavailable
            ? { icon: <DatabaseZap />, title: t('performance.statements.unavailableTitle'), description: t('performance.statements.unavailableDescription'), compact: true }
            : { icon: <Database />, title: t('performance.statements.emptyTitle'), description: t('performance.statements.emptyDescription'), compact: true }
        }
        renderCells={(row) => <StatementCells row={row} />}
      />
    </div>
  );
}
