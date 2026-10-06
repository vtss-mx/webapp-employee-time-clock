import { Bug, CheckCheck, SearchX, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServerStatusPanel } from '../../components/ServerStatusPanel';
import { CatalogStatusBadge } from '../../components/StatusBadge';
import { ListToolbar } from '../../components/ui/ListControls';
import { ListResults } from '../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { notifyErrorsChanged } from '../../hooks/usePendingErrors';
import { useResource } from '../../hooks/useResource';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { errorReportService, type ErrorFilter } from '../../services/errorReportService';
import type { ErrorReport, ErrorReportList, ErrorSeverity, ErrorStatus } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import type { CatalogApi } from '../../utils/catalogs';
import { formatDateTime, timeAgo } from '../../utils/format';
import { formatCount } from '../../utils/numbers';

type Choice<T extends string> = T | 'all';

/* Títulos y avisos que se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const loadError = () => t('systemErrors.list.loadError');
const summaryError = () => t('systemErrors.list.summaryError');
const resolveError = () => t('systemErrors.resolve.error');
const resolvedNotice = (resolved: number) => [t('systemErrors.resolve.done'), t('systemErrors.resolve.doneText', { count: resolved })] as const;

/** Dónde ocurrió: "GET /api/employees/{id} · 404", o el módulo y la línea si vino del log. */
export function whereOf(report: ErrorReport): string {
  const route = [report.method, report.location].filter(Boolean).join(' ') || report.source;
  return report.http_status ? `${route} · ${report.http_status}` : route;
}

/**
 * Errores del sistema (ADMIN de la plataforma): las fallas que hay que corregir (del servidor, del
 * segundo plano, del canal en vivo y de la aplicación web), agrupadas (las iguales suman sus
 * ocurrencias). Un 4xx no llega aquí: es un resultado normal. Se filtran por seguimiento y gravedad
 * y se abren para ver su detalle y marcarlos. Debajo, el estado del servidor (dependencias y capacidad).
 */
export function ErrorsPage() {
  const t = useT();
  const navigate = useNavigate();
  const { active } = useCatalogs();
  const [status, setStatus] = useState<Choice<ErrorStatus>>('all');
  const [severity, setSeverity] = useState<Choice<ErrorSeverity>>('all');
  const list = useSearchList<ErrorReport, Pick<ErrorReportList, 'as_of'>>(
    (query, signal) =>
      errorReportService.list(
        { page: query.page, size: query.size, search: query.search, status: status === 'all' ? undefined : status, severity: severity === 'all' ? undefined : severity },
        signal,
      ),
    { errorTitle: loadError, filterKey: `${status}|${severity}` },
  );
  const { data: summary, retry: reloadSummary } = useResource((signal) => errorReportService.summary(signal), 'errors-summary', summaryError);
  const filtered = list.filtered || status !== 'all' || severity !== 'all';
  const filter: ErrorFilter = {
    status: status === 'all' ? undefined : status,
    severity: severity === 'all' ? undefined : severity,
    search: list.appliedSearch || undefined,
  };

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('systemErrors.title')}
          subtitle={summary ? t('systemErrors.list.subtitle', { count: summary.pending }) : t('common.states.loading')}
        />
        <PanelSection>
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder={t('systemErrors.list.searchPlaceholder')}
            label={t('systemErrors.list.searchLabel')}
          />
          <div className="toolbar">
            <Select<Choice<ErrorStatus>>
              value={status}
              onChange={setStatus}
              aria-label={t('systemErrors.list.statusFilter')}
              options={[
                { value: 'all', label: t('systemErrors.list.allStatuses') },
                ...active('error_statuses').map((s) => ({ value: s.code, label: `${s.name} (${formatCount(summary?.by_status[s.code] ?? 0)})` })),
              ]}
            />
            <Select<Choice<ErrorSeverity>>
              value={severity}
              onChange={setSeverity}
              aria-label={t('systemErrors.list.severityFilter')}
              options={[{ value: 'all', label: t('systemErrors.list.allSeverities') }, ...active('error_severities').map((s) => ({ value: s.code, label: s.name }))]}
            />
            {list.data && (
              <ResolveMatching
                filter={filter}
                total={list.data.total}
                seenUntil={list.data.as_of}
                onResolved={() => {
                  list.retry();
                  reloadSummary();
                  notifyErrorsChanged();
                }}
              />
            )}
          </div>
          <ListResults
            list={list}
            pager={{ noun: { one: t('systemErrors.list.noun.one'), other: t('systemErrors.list.noun.other') } }}
            columns={[
              t('systemErrors.list.error'),
              t('systemErrors.list.severity'),
              t('systemErrors.list.where'),
              t('systemErrors.list.times'),
              t('systemErrors.list.lastSeen'),
              t('systemErrors.list.status'),
            ]}
            onOpen={(report) => void navigate(paths.admin.error(report.id))}
            empty={
              filtered
                ? { icon: <SearchX />, title: t('systemErrors.list.noMatchTitle'), description: t('systemErrors.list.noMatchDescription') }
                : { icon: <ShieldCheck />, tone: 'success', title: t('systemErrors.list.emptyTitle'), description: t('systemErrors.list.emptyDescription') }
            }
            renderCells={(report) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <span className="icon-tile">
                      <Bug size={18} />
                    </span>
                    <span className="person__info">
                      <strong className="truncate">{report.code}</strong>
                      <small className="truncate">{report.message}</small>
                    </span>
                  </span>
                </td>
                <td data-label={t('systemErrors.list.severity')}>
                  <CatalogStatusBadge catalog="error_severities" code={report.severity} />
                </td>
                <td data-label={t('systemErrors.list.where')} className="table__wide">
                  <span className="truncate">{whereOf(report)}</span>
                </td>
                <td data-label={t('systemErrors.list.times')}>
                  {formatCount(report.occurrences)}
                  {report.reopened > 0 && <small className="muted"> · {t('systemErrors.list.reopened', { times: formatCount(report.reopened) })}</small>}
                </td>
                <td data-label={t('systemErrors.list.lastSeen')}>{timeAgo(report.last_seen_at)}</td>
                <td data-label={t('systemErrors.list.status')}>
                  <CatalogStatusBadge catalog="error_statuses" code={report.status} />
                </td>
              </>
            )}
          />
        </PanelSection>
        <ServerStatusPanel />
      </Panel>
    </div>
  );
}

/**
 * "Marcar como solucionados" para TODOS los errores del filtro actual. Solo aparece con un
 * seguimiento o una gravedad específicos (nunca con "todo": el backend también lo exige) y si hay
 * errores abiertos que marcar; pide confirmación diciendo qué filtro aplica.
 */
function ResolveMatching({ filter, total, seenUntil, onResolved }: { filter: ErrorFilter; total: number; seenUntil: string; onResolved: () => void }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const action = useAction();
  const specific = Boolean(filter.status ?? filter.severity);
  if (!specific || filter.status === 'RESOLVED' || total === 0) return null;

  const resolve = () =>
    void action.run(() => errorReportService.resolveMatching(filter, seenUntil), {
      confirm: () => resolveConfirm(filter, total, seenUntil, nameOf),
      errorTitle: resolveError,
      success: resolvedNotice,
      onSuccess: onResolved,
    });

  return (
    <Button variant="ghost" icon={<CheckCheck size={18} />} loading={action.busy !== null} onClick={resolve}>
      {t('systemErrors.resolve.button', { count: total })}
    </Button>
  );
}

/**
 * Confirmación de "Marcar como solucionados": cuántos, con qué filtro (seguimiento, gravedad y
 * búsqueda) y hasta cuándo se vieron.
 */
function resolveConfirm(filter: ErrorFilter, total: number, seenUntil: string, nameOf: CatalogApi['nameOf']): ConfirmInput {
  const criteria = [
    filter.status && t('systemErrors.resolve.byStatus', { name: nameOf('error_statuses', filter.status) }),
    filter.severity && t('systemErrors.resolve.bySeverity', { name: nameOf('error_severities', filter.severity) }),
    filter.search && t('systemErrors.resolve.bySearch', { search: filter.search }),
  ].filter(Boolean);
  return {
    kind: 'edit',
    tone: 'success',
    icon: <CheckCheck size={30} />,
    eyebrow: t('systemErrors.resolve.eyebrow'),
    title: t('systemErrors.resolve.title', { count: total }),
    message: t('systemErrors.resolve.message', { count: total, criteria: criteria.join(', ') }),
    // Con solo la gravedad en el filtro, cada error está en su propio seguimiento (ninguno solucionado).
    changes: [
      {
        label: t('systemErrors.list.status'),
        before: filter.status ? nameOf('error_statuses', filter.status) : t('systemErrors.resolve.unresolved'),
        after: nameOf('error_statuses', 'RESOLVED'),
      },
    ],
    details: [
      { label: t('systemErrors.resolve.errors'), value: formatCount(total) },
      { label: t('systemErrors.resolve.seenUntil'), value: formatDateTime(seenUntil) },
    ],
    note: t('systemErrors.resolve.note'),
    confirmLabel: t('systemErrors.resolve.confirmLabel'),
    confirmIcon: <CheckCheck size={18} />,
  };
}
