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
import { paths } from '../../routes/paths';
import { errorReportService, type ErrorFilter } from '../../services/errorReportService';
import type { ErrorReport, ErrorReportList, ErrorSeverity, ErrorStatus } from '../../types';
import { formatDateTime, timeAgo } from '../../utils/format';

type Choice<T extends string> = T | 'all';

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
    { errorTitle: 'No se pudieron cargar los errores', filterKey: `${status}|${severity}` },
  );
  const { data: summary, retry: reloadSummary } = useResource((signal) => errorReportService.summary(signal), 'errors-summary', 'No se pudo cargar el resumen de errores');
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
          title="Errores del sistema"
          subtitle={summary ? `${summary.pending} pendientes · cualquier error del backend queda registrado aquí` : 'Cargando...'}
        />
        <PanelSection>
          <ListToolbar search={list.search} onSearch={list.setSearch} placeholder="Buscar por código, mensaje, ruta o excepción" label="Buscar errores" />
          <div className="toolbar">
            <Select<Choice<ErrorStatus>>
              value={status}
              onChange={setStatus}
              aria-label="Filtrar por seguimiento"
              options={[{ value: 'all', label: 'Todo el seguimiento' }, ...active('error_statuses').map((s) => ({ value: s.code, label: `${s.name} (${summary?.by_status[s.code] ?? 0})` }))]}
            />
            <Select<Choice<ErrorSeverity>>
              value={severity}
              onChange={setSeverity}
              aria-label="Filtrar por gravedad"
              options={[{ value: 'all', label: 'Toda gravedad' }, ...active('error_severities').map((s) => ({ value: s.code, label: s.name }))]}
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
            pager={{ noun: { one: 'error', other: 'errores' } }}
            columns={['Error', 'Gravedad', 'Dónde', 'Veces', 'Última vez', 'Seguimiento']}
            onOpen={(report) => void navigate(paths.admin.error(report.id))}
            empty={
              filtered
                ? { icon: <SearchX />, title: 'Ningún error coincide con los filtros', description: 'Cambia el seguimiento, la gravedad o la búsqueda.' }
                : { icon: <ShieldCheck />, tone: 'success', title: 'Sin errores registrados', description: 'Cuando algo falle en el backend, aunque sea mínimo, aparecerá aquí con su detalle.' }
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
                <td data-label="Gravedad">
                  <CatalogStatusBadge catalog="error_severities" code={report.severity} />
                </td>
                <td data-label="Dónde" className="table__wide">
                  <span className="truncate">{whereOf(report)}</span>
                </td>
                <td data-label="Veces">
                  {report.occurrences.toLocaleString('es-MX')}
                  {report.reopened > 0 && <small className="muted"> · reabierto {report.reopened}</small>}
                </td>
                <td data-label="Última vez">{timeAgo(report.last_seen_at)}</td>
                <td data-label="Seguimiento">
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
  const { nameOf } = useCatalogs();
  const action = useAction();
  const specific = Boolean(filter.status ?? filter.severity);
  if (!specific || filter.status === 'RESOLVED' || total === 0) return null;

  const criteria = [
    filter.status && `seguimiento «${nameOf('error_statuses', filter.status)}»`,
    filter.severity && `gravedad «${nameOf('error_severities', filter.severity)}»`,
    filter.search && `búsqueda «${filter.search}»`,
  ].filter(Boolean);
  const count = total.toLocaleString('es-MX');
  const what = total === 1 ? 'Se marcará como solucionado el error' : `Se marcarán como solucionados los ${count} errores`;
  const resolve = () =>
    void action.run(() => errorReportService.resolveMatching(filter, seenUntil), {
      confirm: {
        kind: 'edit',
        tone: 'success',
        icon: <CheckCheck size={30} />,
        eyebrow: 'Seguimiento de errores',
        title: total === 1 ? '¿Marcar como solucionado el error?' : `¿Marcar como solucionados los ${count} errores?`,
        message: `${what} con ${criteria.join(', ')}. Los que ocurran después de cargar esta lista no se tocan.`,
        // Con solo la gravedad en el filtro, cada error está en su propio seguimiento (ninguno solucionado).
        changes: [{ label: 'Seguimiento', before: filter.status ? nameOf('error_statuses', filter.status) : 'Sin solucionar', after: nameOf('error_statuses', 'RESOLVED') }],
        details: [
          { label: 'Errores', value: count },
          { label: 'Vistos hasta', value: formatDateTime(seenUntil) },
        ],
        note: 'Uno que vuelva a ocurrir se reabre solo como pendiente.',
        confirmLabel: 'Marcar como solucionados',
        confirmIcon: <CheckCheck size={18} />,
      },
      errorTitle: 'No se pudieron marcar los errores',
      success: (resolved) => [
        'Errores solucionados',
        resolved === 1 ? '1 error quedó marcado como solucionado.' : `${resolved.toLocaleString('es-MX')} errores quedaron marcados como solucionados.`,
      ],
      onSuccess: onResolved,
    });

  return (
    <Button variant="ghost" icon={<CheckCheck size={18} />} loading={action.busy !== null} onClick={resolve}>
      Marcar como solucionados ({count})
    </Button>
  );
}
