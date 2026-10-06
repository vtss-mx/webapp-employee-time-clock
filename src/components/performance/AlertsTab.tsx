import { BellRing, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { performanceService } from '../../services/performanceService';
import type { SlowAlert, SlowAlertPage, SlowAlertStatus } from '../../types/performance';
import { config } from '../../utils/config';
import { timeAgo } from '../../utils/format';
import { formatCount, formatDuration } from '../../utils/numbers';
import { CatalogStatusBadge } from '../StatusBadge';
import { ListToolbar } from '../ui/ListControls';
import { ListResults } from '../ui/ListResults';
import { Select } from '../ui/Select';

type StatusChoice = SlowAlertStatus | 'all';
const loadError = () => t('performance.alerts.loadError');
const COLUMNS = ['route', 'status', 'count', 'last', 'threshold', 'lastSeen'] as const;

/** Una alerta: la ruta (con el último código), su seguimiento, cuántas lentas, sus tiempos y cuándo ocurrió. */
function AlertCells({ alert }: { alert: SlowAlert }) {
  const t = useT();
  return (
    <>
      <td className="table__primary table__wide">
        <code className="perf-name">{alert.route}</code>
        {alert.last_status !== null && <small className="muted table__note">{t('performance.alerts.lastStatus', { status: alert.last_status })}</small>}
      </td>
      <td data-label={t('performance.alerts.columns.status')}>
        <CatalogStatusBadge catalog="slow_alert_statuses" code={alert.status} />
      </td>
      <td data-label={t('performance.alerts.columns.count')}>
        {formatCount(alert.count)}
        {alert.reopened > 0 && <small className="muted table__note">{t('performance.alerts.reopened', { count: alert.reopened })}</small>}
      </td>
      <td data-label={t('performance.alerts.columns.last')}>
        {formatDuration(alert.last_ms)}
        <small className="muted table__note">{t('performance.alerts.averageMax', { average: formatDuration(alert.avg_ms), max: formatDuration(alert.max_ms) })}</small>
      </td>
      <td data-label={t('performance.alerts.columns.threshold')}>{formatDuration(alert.threshold_ms)}</td>
      <td data-label={t('performance.alerts.columns.lastSeen')}>{timeAgo(alert.last_seen_at)}</td>
    </>
  );
}

/**
 * Bandeja de alertas de peticiones lentas (lo más reciente primero): filtro por seguimiento (nombres y colores
 * del catálogo `slow_alert_statuses`) y búsqueda por ruta; cada fila abre la alerta. Se actualiza sola mientras
 * se ve (el contador del menú tiene su propia consulta).
 */
export function AlertsTab() {
  const t = useT();
  const navigate = useNavigate();
  const { active } = useCatalogs();
  const [status, setStatus] = useState<StatusChoice>('all');
  const list = useSearchList<SlowAlert, Pick<SlowAlertPage, 'as_of'>>(
    (query, signal) => performanceService.alerts({ page: query.page, size: query.size, search: query.search, status: status === 'all' ? undefined : status }, signal),
    { errorTitle: loadError, filterKey: status },
  );
  useAutoRefresh(list.retry, config.performanceRefreshMs);
  const filtered = list.filtered || status !== 'all';

  return (
    <div className="stack">
      <p className="muted small">{t('performance.alerts.intro')}</p>
      <ListToolbar search={list.search} onSearch={list.setSearch} placeholder={t('performance.alerts.searchPlaceholder')} label={t('performance.alerts.searchLabel')} />
      <div className="toolbar">
        <Select<StatusChoice>
          value={status}
          onChange={setStatus}
          aria-label={t('performance.alerts.statusFilter')}
          options={[{ value: 'all', label: t('performance.alerts.allStatuses') }, ...active('slow_alert_statuses').map((item) => ({ value: item.code, label: item.name }))]}
        />
      </div>
      <ListResults
        list={list}
        pager={{ noun: { one: t('performance.alerts.noun.one'), other: t('performance.alerts.noun.other') } }}
        columns={COLUMNS.map((column) => t(`performance.alerts.columns.${column}`))}
        onOpen={(alert) => void navigate(paths.admin.performanceAlert(alert.id))}
        empty={
          filtered
            ? { icon: <SearchX />, title: t('performance.alerts.noMatchTitle'), description: t('performance.alerts.noMatchDescription'), compact: true }
            : { icon: <BellRing />, tone: 'success', title: t('performance.alerts.emptyTitle'), description: t('performance.alerts.emptyDescription'), compact: true }
        }
        renderCells={(alert) => <AlertCells alert={alert} />}
      />
    </div>
  );
}
