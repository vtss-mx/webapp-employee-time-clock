import { Bug, SearchX, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServerStatusPanel } from '../../components/ServerStatusPanel';
import { CatalogStatusBadge } from '../../components/StatusBadge';
import { ListToolbar } from '../../components/ui/ListControls';
import { ListResults } from '../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useResource } from '../../hooks/useResource';
import { useSearchList } from '../../hooks/useSearchList';
import { paths } from '../../routes/paths';
import { errorReportService } from '../../services/errorReportService';
import type { ErrorReport, ErrorSeverity, ErrorStatus } from '../../types';
import { timeAgo } from '../../utils/format';

type Choice<T extends string> = T | 'all';

/** Dónde ocurrió: "GET /api/employees/{id} · 404", o el módulo y la línea si vino del log. */
export function whereOf(report: ErrorReport): string {
  const route = [report.method, report.location].filter(Boolean).join(' ') || report.source;
  return report.http_status ? `${route} · ${report.http_status}` : route;
}

/**
 * Errores del sistema (ADMIN de la plataforma): CUALQUIER error del backend queda registrado,
 * agrupado (los iguales suman sus ocurrencias). Se filtran por seguimiento y gravedad y se abren
 * para ver su detalle y marcarlos. Debajo, el estado del servidor (dependencias y capacidad).
 */
export function ErrorsPage() {
  const navigate = useNavigate();
  const { active } = useCatalogs();
  const [status, setStatus] = useState<Choice<ErrorStatus>>('all');
  const [severity, setSeverity] = useState<Choice<ErrorSeverity>>('all');
  const list = useSearchList(
    (query, signal) =>
      errorReportService.list(
        { page: query.page, size: query.size, search: query.search, status: status === 'all' ? undefined : status, severity: severity === 'all' ? undefined : severity },
        signal,
      ),
    { errorTitle: 'No se pudieron cargar los errores', filterKey: `${status}|${severity}` },
  );
  const { data: summary } = useResource((signal) => errorReportService.summary(signal), 'errors-summary', 'No se pudo cargar el resumen de errores');
  const filtered = list.filtered || status !== 'all' || severity !== 'all';

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
