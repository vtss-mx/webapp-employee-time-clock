import { Activity, Bug, CheckCheck, ClipboardList, Code2, ListChecks } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { CatalogStatusBadge } from '../../components/StatusBadge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { OccurrenceContext } from '../../components/errors/OccurrenceContext';
import { CopyField } from '../../components/ui/CopyField';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { ResourceFallback } from '../../components/ui/ResourceFallback';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { notifyErrorsChanged } from '../../hooks/usePendingErrors';
import { useResource } from '../../hooks/useResource';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { errorReportService } from '../../services/errorReportService';
import type { ErrorReportDetail, ErrorStatus } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { formatDateTime } from '../../utils/format';
import { formatCount } from '../../utils/numbers';
import { whereOf } from './ErrorsPage';
import { inSentence } from '../../utils/text';

/** De dónde vino el error (código del backend → su texto); uno desconocido se muestra tal cual. */
const SOURCES: Partial<Record<string, 'http' | 'log' | 'websocket' | 'client'>> = { HTTP: 'http', LOG: 'log', WEBSOCKET: 'websocket', CLIENT: 'client' };
const sourceText = (source: string) => {
  const key = SOURCES[source];
  return key ? t(`systemErrors.detail.sources.${key}`) : source;
};

/** Cambiar el seguimiento: "antes → después" con los nombres del catálogo y de qué error se trata. */
function statusConfirm(report: ErrorReportDetail, status: ErrorStatus, current: string, next: string): ConfirmInput {
  const resolved = status === 'RESOLVED';
  return {
    kind: 'edit',
    tone: resolved ? 'success' : 'primary',
    icon: resolved ? <CheckCheck size={30} /> : <ListChecks size={30} />,
    eyebrow: t('systemErrors.detail.confirmEyebrow'),
    title: t('systemErrors.detail.confirmTitle', { code: report.code, status: inSentence(next) }),
    message: t(resolved ? 'systemErrors.detail.confirmResolved' : 'systemErrors.detail.confirmMessage'),
    changes: [{ label: t('systemErrors.list.status'), before: current, after: next }],
    details: [
      { label: t('systemErrors.detail.message'), value: report.message },
      { label: t('systemErrors.list.where'), value: whereOf(report) },
      { label: t('systemErrors.detail.occurrences'), value: formatCount(report.occurrences) },
    ],
    confirmLabel: t('systemErrors.detail.markAs', { status: inSentence(next) }),
    confirmIcon: resolved ? <CheckCheck size={18} /> : <ListChecks size={18} />,
  };
}

/* Títulos y avisos que se traducen al dibujarse (un popup abierto sigue al idioma activo). */
const loadError = () => t('systemErrors.detail.loadError');
const occurrencesError = () => t('systemErrors.detail.occurrencesError');
const statusError = () => t('systemErrors.detail.statusError');
const statusNotice = () => [t('systemErrors.detail.statusSaved')] as const;

/** Detalle de un error del sistema: dónde y cuántas veces, su stack trace, quién lo provocó y su seguimiento. */
export function ErrorDetailPage() {
  const t = useT();
  const reportId = Number(useParams().id);
  const { active, nameOf } = useCatalogs();
  const { data: report, setData, error, retry } = useResource((signal) => errorReportService.get(reportId, signal), reportId, loadError);
  const occurrences = usePagedList((page, signal) => errorReportService.occurrences(reportId, page, signal), {
    errorTitle: occurrencesError,
    filterKey: String(reportId),
  });
  const { busy, run } = useAction<ErrorStatus>();

  if (!report) {
    return <ResourceFallback error={error} retry={retry} lines={8} header={{ title: t('systemErrors.detail.title'), backTo: paths.admin.errors, backLabel: t('systemErrors.title') }} />;
  }

  const mark = (status: ErrorStatus, name: string) =>
    run(() => errorReportService.setStatus(report.id, status), {
      busy: status,
      confirm: () => statusConfirm(report, status, nameOf('error_statuses', report.status), name),
      errorTitle: statusError,
      success: statusNotice,
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
          backLabel={t('systemErrors.title')}
          actions={
            <>
              <CatalogStatusBadge catalog="error_severities" code={report.severity} />
              <CatalogStatusBadge catalog="error_statuses" code={report.status} />
            </>
          }
        />
        <PanelSection title={t('systemErrors.list.status')} icon={<ListChecks size={20} />}>
          <p className="muted small">
            {report.status_changed_by
              ? t('systemErrors.detail.lastChange', { who: report.status_changed_by, date: formatDateTime(report.status_changed_at) })
              : t('systemErrors.detail.noFollowUp')}{' '}
            {t('systemErrors.detail.reopenNote')}
          </p>
          <div className="button-row">
            {active('error_statuses')
              .filter((s) => s.code !== report.status)
              .map((s) => (
                <Button key={s.code} variant={s.code === 'RESOLVED' ? 'success' : 'secondary'} loading={busy === s.code} disabled={busy !== null} onClick={() => void mark(s.code, s.name)}>
                  {t('systemErrors.detail.markAs', { status: inSentence(s.name) })}
                </Button>
              ))}
          </div>
        </PanelSection>
        <PanelGrid>
          <PanelSection title={t('systemErrors.detail.data')} icon={<ClipboardList size={20} />}>
            <dl className="details">
              <div>
                <dt>{t('systemErrors.detail.source')}</dt>
                <dd>{sourceText(report.source)}</dd>
              </div>
              <div>
                <dt>{t('systemErrors.list.where')}</dt>
                <dd>{whereOf(report)}</dd>
              </div>
              <div>
                <dt>{t('systemErrors.detail.exception')}</dt>
                <dd>{report.exception_type ?? <span className="muted">{t('systemErrors.detail.handled')}</span>}</dd>
              </div>
              <div>
                <dt>{t('systemErrors.detail.occurrences')}</dt>
                <dd>
                  {formatCount(report.occurrences)}
                  {report.reopened > 0 && ` · ${t('systemErrors.detail.reopened', { count: report.reopened })}`}
                </dd>
              </div>
              <div>
                <dt>{t('systemErrors.detail.firstSeen')}</dt>
                <dd>{formatDateTime(report.first_seen_at)}</dd>
              </div>
              <div>
                <dt>{t('systemErrors.list.lastSeen')}</dt>
                <dd>{formatDateTime(report.last_seen_at)}</dd>
              </div>
            </dl>
            {report.last_trace_id && (
              <div className="stack">
                <span className="small muted">{t('systemErrors.detail.lastTrace')}</span>
                <CopyField value={report.last_trace_id} label={t('systemErrors.detail.copyTrace')} />
              </div>
            )}
          </PanelSection>
          <PanelSection title={t('systemErrors.detail.technical')} icon={<Code2 size={20} />}>
            {report.detail ? <pre className="code-block">{report.detail}</pre> : <p className="muted">{t('systemErrors.detail.noStack', { code: report.code })}</p>}
          </PanelSection>
        </PanelGrid>
        <PanelSection title={t('systemErrors.detail.recent')} icon={<Activity size={20} />}>
          <PagedItems
            list={occurrences}
            pager={{ noun: { one: t('systemErrors.detail.occurrenceNoun.one'), other: t('systemErrors.detail.occurrenceNoun.other') } }}
            empty={{ compact: true, icon: <Bug />, title: t('systemErrors.detail.noRecentTitle'), description: t('systemErrors.detail.noRecentDescription') }}
          >
            {(items) => (
              <ul className="log-list log-list--stacked">
                {items.map((o) => (
                  <li key={o.id}>
                    <strong>{formatDateTime(o.occurred_at)}</strong>
                    <span className="small muted log-list__who">
                      {o.user_label && <Avatar name={o.user_label} src={o.user_avatar} size="xs" decorative />}
                      {[o.user_label ?? t('systemErrors.detail.noSession'), o.company_name, o.trace_id && t('systemErrors.detail.trace', { id: o.trace_id })]
                        .filter(Boolean)
                        .join(' · ')}
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
