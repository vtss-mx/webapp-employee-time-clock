import { Globe, MonitorSmartphone } from 'lucide-react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { usePagedList } from '../../hooks/usePagedList';
import { t, useT } from '../../i18n';
import { performanceService } from '../../services/performanceService';
import type { PerfPeriod, ScreenVitals } from '../../types/performance';
import { config } from '../../utils/config';
import { formatDuration } from '../../utils/numbers';
import { ListResults } from '../ui/ListResults';
import { MetricsTab } from './MetricsTab';
import { PerfBlock, VitalCell } from './PerformanceParts';

const VITALS = ['lcp', 'inp', 'cls', 'fcp', 'ttfb'] as const;
const loadError = () => t('performance.vitals.loadError');

/** Una pantalla: sus Web Vitals (p75 con su calificación) y sus tareas largas. */
function VitalsCells({ row }: { row: ScreenVitals }) {
  const t = useT();
  const { long_tasks: tasks } = row;
  return (
    <>
      <td className="table__primary table__wide">
        <code className="perf-name">{row.screen}</code>
        <small className="muted table__note">{t('performance.vitals.views', { count: row.views })}</small>
      </td>
      {VITALS.map((vital) => (
        <td key={vital} data-label={t(`performance.vitals.columns.${vital}`)}>
          <VitalCell vital={row[vital]} />
        </td>
      ))}
      <td data-label={t('performance.vitals.columns.longTasks')}>
        {t('performance.vitals.longTasks', { count: tasks.count })}
        {tasks.count > 0 && <small className="muted table__note">{t('performance.vitals.longTasksDetail', { p95: formatDuration(tasks.p95_ms), max: formatDuration(tasks.max_ms) })}</small>}
      </td>
    </>
  );
}

/** Web Vitals por pantalla en el periodo (las pantallas con más muestras primero), de solo lectura. */
function WebVitalsList({ period }: { period: PerfPeriod }) {
  const t = useT();
  const list = usePagedList((query, signal) => performanceService.webVitals({ ...query, period }, signal), { errorTitle: loadError, filterKey: period });
  useAutoRefresh(list.retry, config.performanceRefreshMs);
  return (
    <ListResults
      list={list}
      rowKey={(row) => row.screen}
      pager={{ noun: { one: t('performance.vitals.noun.one'), other: t('performance.vitals.noun.other') } }}
      columns={[t('performance.vitals.columns.screen'), ...VITALS.map((vital) => t(`performance.vitals.columns.${vital}`)), t('performance.vitals.columns.longTasks')]}
      empty={{ icon: <MonitorSmartphone />, title: t('performance.vitals.emptyTitle'), description: t('performance.longerPeriod'), compact: true }}
      renderCells={(row) => <VitalsCells row={row} />}
    />
  );
}

/**
 * Lo que vive la persona en su navegador: las Web Vitals de cada pantalla y el tiempo completo de cada API vista
 * desde el navegador (red incluida). Lo miden los observadores de `services/perf`.
 */
export function BrowserTab({ period }: { period: PerfPeriod }) {
  const t = useT();
  return (
    <div className="stack perf-stack">
      <PerfBlock title={t('performance.vitals.title')} icon={<MonitorSmartphone size={18} />} intro={t('performance.vitals.intro')}>
        <WebVitalsList period={period} />
      </PerfBlock>
      <PerfBlock title={t('performance.vitals.apiTitle')} icon={<Globe size={18} />}>
        <MetricsTab kind="WEB_API" period={period} />
      </PerfBlock>
    </div>
  );
}
