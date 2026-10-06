import { Check, Inbox, SearchX, X } from 'lucide-react';
import { useState } from 'react';
import { ShiftChange } from '../../../components/shifts/PendingRequest';
import { ShiftItem } from '../../../components/shifts/ShiftItem';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { ButtonLink } from '../../../components/ui/Button';
import { DeletedMark } from '../../../components/ui/DeletedMark';
import type { EmptyStateProps } from '../../../components/ui/EmptyState';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { Select } from '../../../components/ui/Select';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { usePagedList } from '../../../hooks/usePagedList';
import { t as translate, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import type { ShiftRequest, ShiftRequestStatus } from '../../../types';
import { formatDate, timeAgo } from '../../../utils/format';
import { Avatar } from '../../../components/ui/Avatar';

type StatusFilter = ShiftRequestStatus | 'ALL';

/**
 * Vacío según el filtro: nada pendiente es buena noticia; «Todas» sin nada dice qué aparecerá; un estado sin
 * coincidencias sugiere otro (se traduce al dibujarse).
 */
function requestsEmpty(status: StatusFilter): EmptyStateProps {
  if (status === 'PENDING') return { icon: <Inbox />, tone: 'success', title: translate('shifts.requests.empty.pendingTitle'), description: translate('shifts.requests.empty.pendingDescription') };
  if (status === 'ALL') return { icon: <Inbox />, title: translate('shifts.requests.empty.statusTitle'), description: translate('shifts.requests.empty.allDescription') };
  return { icon: <SearchX />, title: translate('shifts.requests.empty.statusTitle'), description: translate('shifts.requests.empty.statusDescription') };
}

/**
 * Bandeja de solicitudes de cambio de turno de los empleados: por omisión las pendientes; cada una
 * con el cambio pedido, desde cuándo, el motivo y, si está pendiente, "Aprobar" o "Rechazar".
 */
export function ShiftRequestsPage() {
  const t = useT();
  const { active } = useCatalogs();
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const list = usePagedList((page, signal) => shiftService.requests({ ...page, status: status === 'ALL' ? undefined : status }, signal), {
    errorTitle: () => translate('shifts.requests.loadError'),
    filterKey: status,
  });
  // Estados del catálogo (nombre de la BD, ya en el idioma de la petición) y "todas".
  const options = [...active('shift_request_statuses').map((item) => ({ value: item.code, label: item.name })), { value: 'ALL' as const, label: t('shifts.requests.all') }];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('shifts.requests.title')}
          subtitle={list.data ? t('shifts.requests.subtitle', { count: list.total }) : t('common.states.loading')}
          backTo={paths.company.shifts}
          backLabel={t('shifts.list.title')}
        />
        <PanelSection>
          <div className="request-filter">
            <Select<StatusFilter> value={status} options={options} onChange={setStatus} aria-label={t('shifts.requests.filter')} />
          </div>
          <PagedItems
            list={list}
            pager={{ noun: { one: t('shifts.requests.noun.one'), other: t('shifts.requests.noun.other') } }}
            empty={requestsEmpty(status)}
          >
            {(items) => (
              <ul className={`people-list stagger ${list.loading ? 'is-loading' : ''}`}>
                {items.map((request) => (
                  <RequestItem key={request.id} request={request} />
                ))}
              </ul>
            )}
          </PagedItems>
        </PanelSection>
      </Panel>
    </div>
  );
}

/** Una solicitud: quién, qué cambio, desde cuándo, por qué y (si está pendiente) cómo decidirla. */
function RequestItem({ request }: { request: ShiftRequest }) {
  const t = useT();
  const pending = request.status === 'PENDING';
  const { full_name: name, employee_number: number } = request.employee;
  return (
    <ShiftItem
      lead={<Avatar name={name} decorative />}
      title={
        <>
          {name} <span className="muted small">· {number}</span>
          <DeletedMark deleted={request.employee.deleted} />
        </>
      }
      badges={<CatalogStatusBadge catalog="shift_request_statuses" code={request.status} />}
      actions={
        pending && (
          <>
            <ButtonLink to={paths.company.rejectShiftRequest(request.id)} state={{ request }} size="sm" variant="ghost" icon={<X size={16} />} aria-label={t('shifts.requests.item.reject', { name })}>
              {t('common.actions.reject')}
            </ButtonLink>
            <ButtonLink to={paths.company.approveShiftRequest(request.id)} state={{ request }} size="sm" variant="success" icon={<Check size={16} />} aria-label={t('shifts.requests.item.approve', { name })}>
              {t('common.actions.approve')}
            </ButtonLink>
          </>
        )
      }
    >
      <small>
        <ShiftChange request={request} />
      </small>
      <small className="muted">{t('shifts.requests.item.when', { date: formatDate(request.valid_from), ago: timeAgo(request.created_at) })}</small>
      <small className="shift-item__quote">“{request.reason}”</small>
      {request.review_note && <small className="muted">{t('shifts.requests.item.companyNote', { note: request.review_note })}</small>}
    </ShiftItem>
  );
}
