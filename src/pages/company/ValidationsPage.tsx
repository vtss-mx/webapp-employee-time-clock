import { ArrowRight, CheckCircle2, ClipboardCheck, Clock, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { PagedItems } from '../../components/ui/PagedItems';
import { EnrollmentBadge } from '../../components/StatusBadge';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { enrollmentService } from '../../services/enrollmentService';
import type { EnrollmentStatus } from '../../types';
import { formatDateTime, timeAgo } from '../../utils/format';
import { Avatar } from '../../components/ui/Avatar';

/** Ícono de cada pestaña; las pestañas (códigos, orden y nombre) vienen del catálogo enrollment_statuses. */
const TAB_ICONS: Partial<Record<string, LucideIcon>> = { PENDING: Clock, APPROVED: CheckCircle2, REJECTED: XCircle };

const loadError = () => t('enrollments.list.loadError');

/** Qué aparecerá en una pestaña sin registros (sin repetir su nombre en el título); un estado nuevo del catálogo, lo general. */
function emptyDescription(status: EnrollmentStatus): string {
  if (status === 'APPROVED') return t('enrollments.list.empty.approved');
  if (status === 'REJECTED') return t('enrollments.list.empty.rejected');
  return t('enrollments.list.empty.description');
}

/** Bandeja de validación de identidad (registros faciales hechos por los empleados). */
export function ValidationsPage() {
  const t = useT();
  const { active } = useCatalogs();
  const [status, setStatus] = useState<EnrollmentStatus>('PENDING');
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const list = usePagedList(
    async (page, signal) => {
      const res = await enrollmentService.list(status, page, signal);
      if (status === 'PENDING') setPendingTotal(res.total);
      return res;
    },
    { errorTitle: loadError, filterKey: status },
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('enrollments.list.title')}
          subtitle={t('enrollments.list.subtitle')}
        />
        <PanelSection>
          <div className="tabs" role="tablist">
            {active('enrollment_statuses').map(({ code, name }) => {
              const Icon = TAB_ICONS[code] ?? ClipboardCheck;
              return (
                <button
                  key={code}
                  role="tab"
                  aria-selected={status === code}
                  className={`tab ${status === code ? 'is-active' : ''}`}
                  onClick={() => setStatus(code)}
                >
                  <Icon size={16} /> {name}
                  {code === 'PENDING' && pendingTotal ? <span className="tab__count">{pendingTotal}</span> : null}
                </button>
              );
            })}
          </div>

          <PagedItems
            list={list}
            skeletonRows={4}
            empty={
              status === 'PENDING'
                ? {
                    tone: 'success',
                    icon: <ShieldCheck />,
                    title: t('enrollments.list.pendingEmpty.title'),
                    description: t('enrollments.list.pendingEmpty.description'),
                  }
                : {
                    icon: <ClipboardCheck />,
                    title: t('enrollments.list.empty.title'),
                    description: emptyDescription(status),
                  }
            }
            pager={{ noun: { one: t('enrollments.list.noun.one'), other: t('enrollments.list.noun.other') } }}
          >
            {(items) => (
            <div className={`table-wrap ${list.loading ? 'is-loading' : ''}`}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.fields.employee')}</th>
                    <th>{t('enrollments.list.submitted')}</th>
                    <th>{t('enrollments.list.liveness')}</th>
                    <th>{t('common.fields.status')}</th>
                    <th aria-label={t('enrollments.list.actions')} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((e, i) => (
                    <tr key={e.id} style={{ animationDelay: `${i * 30}ms` }}>
                      <td className="table__primary">
                        <Link to={paths.company.validation(e.id)} className="person" style={{ color: 'inherit', textDecoration: 'none' }}>
                          <Avatar name={e.full_name} decorative />
                          <span className="person__info">
                            <strong className="truncate">{e.full_name}</strong>
                            <small>{e.employee_number}</small>
                          </span>
                        </Link>
                      </td>
                      <td data-label={t('enrollments.list.submitted')} title={formatDateTime(e.submitted_at)}>
                        {timeAgo(e.submitted_at)}
                      </td>
                      <td data-label={t('enrollments.list.liveness')}>
                        {e.liveness_passed ? (
                          <span className="badge badge--success">{t('enrollments.list.livenessPassed')}</span>
                        ) : (
                          <span className="badge badge--muted">{t('enrollments.list.livenessSkipped')}</span>
                        )}
                      </td>
                      <td data-label={t('common.fields.status')}>
                        <EnrollmentBadge status={e.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={paths.company.validation(e.id)} className="btn btn--secondary btn--sm">
                          {t(e.status === 'PENDING' ? 'enrollments.list.review' : 'common.actions.view')} <ArrowRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </PagedItems>
        </PanelSection>
      </Panel>
    </div>
  );
}
