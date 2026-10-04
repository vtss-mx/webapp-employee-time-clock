import { Activity, Bug, CheckCheck, ClipboardList, Code2, ListChecks } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { CatalogStatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/Button';
import { OccurrenceContext } from '../../components/errors/OccurrenceContext';
import { CopyField } from '../../components/ui/CopyField';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { notifyErrorsChanged } from '../../hooks/usePendingErrors';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { errorReportService } from '../../services/errorReportService';
import type { ErrorReportDetail, ErrorStatus } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { formatDateTime } from '../../utils/format';
import { whereOf } from './ErrorsPage';

const SOURCES: Record<string, string> = {
  HTTP: 'Respuesta de la API',
  LOG: 'Proceso del backend (segundo plano o interno)',
  WEBSOCKET: 'Canal en vivo (WebSocket)',
  CLIENT: 'Aplicación web (navegador)',
};

/** Cambiar el seguimiento: "antes → después" con los nombres del catálogo y de qué error se trata. */
function statusConfirm(report: ErrorReportDetail, status: ErrorStatus, current: string, next: string): ConfirmInput {
  const resolved = status === 'RESOLVED';
  return {
    kind: 'edit',
    tone: resolved ? 'success' : 'primary',
    icon: resolved ? <CheckCheck size={30} /> : <ListChecks size={30} />,
    eyebrow: 'Seguimiento del error',
    title: `¿Marcar ${report.code} como ${next.toLowerCase()}?`,
    message: resolved ? 'Si vuelve a ocurrir, se reabre solo como pendiente.' : 'Queda registrado quién lo cambió y cuándo.',
    changes: [{ label: 'Seguimiento', before: current, after: next }],
    details: [
      { label: 'Mensaje', value: report.message },
      { label: 'Dónde', value: whereOf(report) },
      { label: 'Ocurrencias', value: report.occurrences.toLocaleString('es-MX') },
    ],
    confirmLabel: `Marcar como ${next.toLowerCase()}`,
    confirmIcon: resolved ? <CheckCheck size={18} /> : <ListChecks size={18} />,
  };
}

/** Detalle de un error del sistema: dónde y cuántas veces, su stack trace, quién lo provocó y su seguimiento. */
export function ErrorDetailPage() {
  const reportId = Number(useParams().id);
  const { active, nameOf } = useCatalogs();
  const { data: report, setData, error, retry } = useResource((signal) => errorReportService.get(reportId, signal), reportId, 'No se pudo cargar el error');
  const occurrences = usePagedList((page, signal) => errorReportService.occurrences(reportId, page, signal), {
    errorTitle: 'No se pudieron cargar sus ocurrencias',
    filterKey: String(reportId),
  });
  const { busy, run } = useAction<ErrorStatus>();

  if (!report) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title="Error del sistema" backTo={paths.admin.errors} backLabel="Errores del sistema" />
          <PanelSection>
            <RetryState onRetry={retry} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={8} />
    );
  }

  const mark = (status: ErrorStatus, name: string) =>
    run(() => errorReportService.setStatus(report.id, status), {
      busy: status,
      confirm: statusConfirm(report, status, nameOf('error_statuses', report.status), name),
      errorTitle: 'No se pudo actualizar el seguimiento',
      success: ['Seguimiento actualizado', `El error quedó como «${name}».`],
      onSuccess: (saved) => {
        setData(saved);
        notifyErrorsChanged();
      },
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={report.code}
          subtitle={report.message}
          backTo={paths.admin.errors}
          backLabel="Errores del sistema"
          actions={
            <>
              <CatalogStatusBadge catalog="error_severities" code={report.severity} />
              <CatalogStatusBadge catalog="error_statuses" code={report.status} />
            </>
          }
        />
        <PanelSection title="Seguimiento" icon={<ListChecks size={20} />}>
          <p className="muted small">
            {report.status_changed_by
              ? `Último cambio: ${report.status_changed_by}, ${formatDateTime(report.status_changed_at)}.`
              : 'Aún nadie le ha dado seguimiento.'}{' '}
            Si un error solucionado vuelve a ocurrir, se reabre solo como pendiente.
          </p>
          <div className="button-row">
            {active('error_statuses')
              .filter((s) => s.code !== report.status)
              .map((s) => (
                <Button key={s.code} variant={s.code === 'RESOLVED' ? 'success' : 'secondary'} loading={busy === s.code} disabled={busy !== null} onClick={() => void mark(s.code, s.name)}>
                  Marcar como {s.name.toLowerCase()}
                </Button>
              ))}
          </div>
        </PanelSection>
        <PanelGrid>
          <PanelSection title="Datos" icon={<ClipboardList size={20} />}>
            <dl className="details">
              <div>
                <dt>Origen</dt>
                <dd>{SOURCES[report.source] ?? report.source}</dd>
              </div>
              <div>
                <dt>Dónde</dt>
                <dd>{whereOf(report)}</dd>
              </div>
              <div>
                <dt>Excepción</dt>
                <dd>{report.exception_type ?? <span className="muted">Controlado (sin excepción)</span>}</dd>
              </div>
              <div>
                <dt>Ocurrencias</dt>
                <dd>
                  {report.occurrences.toLocaleString('es-MX')}
                  {report.reopened > 0 && ` · reabierto ${report.reopened} ${report.reopened === 1 ? 'vez' : 'veces'}`}
                </dd>
              </div>
              <div>
                <dt>Primera vez</dt>
                <dd>{formatDateTime(report.first_seen_at)}</dd>
              </div>
              <div>
                <dt>Última vez</dt>
                <dd>{formatDateTime(report.last_seen_at)}</dd>
              </div>
            </dl>
            {report.last_trace_id && (
              <div className="stack">
                <span className="small muted">Último traceId (búscalo en los logs del servidor)</span>
                <CopyField value={report.last_trace_id} label="Copiar traceId" />
              </div>
            )}
          </PanelSection>
          <PanelSection title="Detalle técnico" icon={<Code2 size={20} />}>
            {report.detail ? (
              <pre className="code-block">{report.detail}</pre>
            ) : (
              <p className="muted">Sin stack trace: el backend lo respondió de forma controlada ({report.code}).</p>
            )}
          </PanelSection>
        </PanelGrid>
        <PanelSection title="Ocurrencias recientes" icon={<Activity size={20} />}>
          <PagedItems
            list={occurrences}
            pager={{ noun: { one: 'ocurrencia', other: 'ocurrencias' } }}
            empty={{ compact: true, icon: <Bug />, title: 'Sin ocurrencias recientes', description: 'Las ocurrencias viejas se depuran solas; el total sigue contando arriba.' }}
          >
            {(items) => (
              <ul className="log-list log-list--stacked">
                {items.map((o) => (
                  <li key={o.id}>
                    <strong>{formatDateTime(o.occurred_at)}</strong>
                    <span className="small muted">
                      {[o.user_label ?? 'Sin sesión', o.company_name, o.trace_id && `traceId ${o.trace_id}`].filter(Boolean).join(' · ')}
                    </span>
                    <span className="small">{o.message}</span>
                    {o.context && <OccurrenceContext context={o.context} />}
                  </li>
                ))}
              </ul>
            )}
          </PagedItems>
        </PanelSection>
      </Panel>
    </div>
  );
}
