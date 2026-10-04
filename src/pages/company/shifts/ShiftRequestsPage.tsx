import { Check, Inbox, SearchX, X } from 'lucide-react';
import { useState } from 'react';
import { ShiftChange } from '../../../components/shifts/PendingRequest';
import { ShiftItem } from '../../../components/shifts/ShiftItem';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { ButtonLink } from '../../../components/ui/Button';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { Select } from '../../../components/ui/Select';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { usePagedList } from '../../../hooks/usePagedList';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import type { ShiftRequest, ShiftRequestStatus } from '../../../types';
import { formatDate, initials, timeAgo } from '../../../utils/format';

type StatusFilter = ShiftRequestStatus | 'ALL';

/**
 * Bandeja de solicitudes de cambio de turno de los empleados: por omisión las pendientes; cada una
 * con el cambio pedido, desde cuándo, el motivo y, si está pendiente, "Aprobar" o "Rechazar".
 */
export function ShiftRequestsPage() {
  const { active } = useCatalogs();
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const list = usePagedList((page, signal) => shiftService.requests({ ...page, status: status === 'ALL' ? undefined : status }, signal), {
    errorTitle: 'No se pudieron cargar las solicitudes',
    filterKey: status,
  });
  // Estados del catálogo (nombre de la BD) y "todas".
  const options = [...active('shift_request_statuses').map((item) => ({ value: item.code, label: item.name })), { value: 'ALL' as const, label: 'Todas las solicitudes' }];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Solicitudes de cambio de turno"
          subtitle={list.data ? `${list.total} ${list.total === 1 ? 'solicitud' : 'solicitudes'} · tus empleados piden cambiar de turno con un día de anticipación` : 'Cargando...'}
          backTo={paths.company.shifts}
          backLabel="Turnos"
        />
        <PanelSection>
          <div className="request-filter">
            <Select<StatusFilter> value={status} options={options} onChange={setStatus} aria-label="Filtrar por estado" />
          </div>
          <PagedItems
            list={list}
            pager={{ noun: { one: 'solicitud', other: 'solicitudes' } }}
            empty={
              status === 'PENDING'
                ? { icon: <Inbox />, tone: 'success', title: 'No hay solicitudes pendientes', description: 'Cuando un empleado pida cambiar de turno, su solicitud aparecerá aquí para que la apruebes o la rechaces.' }
                : { icon: <SearchX />, title: 'No hay solicitudes con este estado', description: 'Elige otro estado para ver más solicitudes.' }
            }
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
  const pending = request.status === 'PENDING';
  const { full_name: name, employee_number: number } = request.employee;
  return (
    <ShiftItem
      lead={<span className="avatar">{initials(name)}</span>}
      title={
        <>
          {name} <span className="muted small">· {number}</span>
        </>
      }
      badges={<CatalogStatusBadge catalog="shift_request_statuses" code={request.status} />}
      actions={
        pending && (
          <>
            <ButtonLink to={paths.company.rejectShiftRequest(request.id)} state={{ request }} size="sm" variant="ghost" icon={<X size={16} />} aria-label={`Rechazar la solicitud de ${name}`}>
              Rechazar
            </ButtonLink>
            <ButtonLink to={paths.company.approveShiftRequest(request.id)} state={{ request }} size="sm" variant="success" icon={<Check size={16} />} aria-label={`Aprobar la solicitud de ${name}`}>
              Aprobar
            </ButtonLink>
          </>
        )
      }
    >
      <small>
        <ShiftChange request={request} />
      </small>
      <small className="muted">
        Desde el {formatDate(request.valid_from)} · pedida {timeAgo(request.created_at)}
      </small>
      <small className="shift-item__quote">“{request.reason}”</small>
      {request.review_note && <small className="muted">Nota de la empresa: “{request.review_note}”</small>}
    </ShiftItem>
  );
}
