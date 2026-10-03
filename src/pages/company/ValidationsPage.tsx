import { ArrowRight, CheckCircle2, ClipboardCheck, Clock, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { RetryState } from '../../components/ui/RetryState';
import { ListPaginator } from '../../components/ui/Paginator';
import { EnrollmentBadge } from '../../components/StatusBadge';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { paths } from '../../routes/paths';
import { enrollmentService } from '../../services/enrollmentService';
import type { EnrollmentStatus } from '../../types';
import { formatDateTime, initials, timeAgo } from '../../utils/format';

/** Ícono de cada pestaña; las pestañas (códigos, orden y nombre) vienen del catálogo enrollment_statuses. */
const TAB_ICONS: Partial<Record<string, LucideIcon>> = { PENDING: Clock, APPROVED: CheckCircle2, REJECTED: XCircle };

/** Bandeja de validación de identidad (registros faciales hechos por los empleados). */
export function ValidationsPage() {
  const { active } = useCatalogs();
  const [status, setStatus] = useState<EnrollmentStatus>('PENDING');
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const list = usePagedList(
    async (page, signal) => {
      const res = await enrollmentService.list(status, page, signal);
      if (status === 'PENDING') setPendingTotal(res.total);
      return res;
    },
    { errorTitle: 'No se pudieron cargar las validaciones', filterKey: status },
  );
  const { data, loading, error } = list;

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Validaciones de identidad"
          subtitle="Revisa el registro facial que cada empleado hizo en su primer inicio de sesión y confirma que es la persona correcta."
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

          {Boolean(error) && !data && <RetryState onRetry={list.retry} />}

          {loading && !data ? (
            <SkeletonRows rows={4} />
          ) : data && data.items.length === 0 ? (
            <div className="empty">
              <span className="icon-tile icon-tile--lg icon-tile--success">
                {status === 'PENDING' ? <ShieldCheck size={30} /> : <ClipboardCheck size={30} />}
              </span>
              <h2>{status === 'PENDING' ? '¡Todo al día!' : 'Sin registros'}</h2>
              <p className="muted">
                {status === 'PENDING'
                  ? 'No hay registros faciales esperando validación.'
                  : 'Aún no hay registros en esta categoría.'}
              </p>
            </div>
          ) : (
            data && (
              <div className={`table-wrap ${loading ? 'is-loading' : ''}`}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Enviado</th>
                      <th>Prueba de vida</th>
                      <th>Estado</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((e, i) => (
                      <tr key={e.id} style={{ animationDelay: `${i * 30}ms` }}>
                        <td className="table__primary">
                          <Link to={paths.company.validation(e.id)} className="person" style={{ color: 'inherit', textDecoration: 'none' }}>
                            <span className="avatar">{initials(e.full_name)}</span>
                            <span className="person__info">
                              <strong className="truncate">{e.full_name}</strong>
                              <small>{e.employee_number}</small>
                            </span>
                          </Link>
                        </td>
                        <td data-label="Enviado" title={formatDateTime(e.submitted_at)}>
                          {timeAgo(e.submitted_at)}
                        </td>
                        <td data-label="Prueba de vida">
                          {e.liveness_passed ? (
                            <span className="badge badge--success">Superada</span>
                          ) : (
                            <span className="badge badge--muted">No aplicada</span>
                          )}
                        </td>
                        <td data-label="Estado">
                          <EnrollmentBadge status={e.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link to={paths.company.validation(e.id)} className="btn btn--secondary btn--sm">
                            {e.status === 'PENDING' ? 'Revisar' : 'Ver'} <ArrowRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          <ListPaginator list={list} noun={{ one: 'registro', other: 'registros' }} />
        </PanelSection>
      </Panel>
    </div>
  );
}
