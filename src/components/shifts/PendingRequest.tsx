import { ArrowRight, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { notifyShiftRequestsChanged } from '../../hooks/usePendingShiftRequests';
import { useResource } from '../../hooks/useResource';
import { t as translate, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { ApiError } from '../../services/apiClient';
import { isShiftRequest, shiftService } from '../../services/shiftService';
import type { ShiftRef, ShiftRequest } from '../../types';
import { formatDate, timeAgo } from '../../utils/format';
import { isRecord } from '../../utils/guards';
import { shiftSchedule } from '../../utils/shifts';
import { ButtonLink } from '../ui/Button';
import { DeletedMark } from '../ui/DeletedMark';
import { EmptyState } from '../ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../ui/Panel';
import { SkeletonCard } from '../ui/Skeleton';
import { LoadFailed } from './PageStates';

/** Pendientes por página al buscar una solicitud (la página más grande de la API). */
const PAGE_SIZE = 50;
/** Tope de páginas al buscarla: nunca se recorre una bandeja sin límite. */
const MAX_PAGES = 20;

/**
 * La solicitud PENDIENTE con ese id. No hay consulta de una sola solicitud: se usa la que trae la
 * navegación desde la bandeja y, si no la trae (recarga o enlace directo), se busca en las páginas
 * de pendientes. null: ya no está pendiente (aprobada, rechazada o cancelada) o no existe.
 */
export async function findPendingRequest(id: number, passed: ShiftRequest | null, signal: AbortSignal): Promise<ShiftRequest | null> {
  if (passed?.id === id && passed.status === 'PENDING') return passed;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await shiftService.requests({ status: 'PENDING', page, size: PAGE_SIZE }, signal);
    const found = result.items.find((request) => request.id === id);
    if (found) return found;
    if (page * PAGE_SIZE >= result.total) return null;
  }
  return null;
}

/**
 * Al decidir, el servidor dice que la solicitud ya no está pendiente (otra persona la decidió o el
 * empleado la canceló): se actualiza el contador del menú y se vuelve a la bandeja (el popup del
 * error lo explica).
 */
export function leaveIfClosed(err: unknown, leave: () => void) {
  if (err instanceof ApiError && err.code === 'SHIFT_REQUEST_CLOSED') {
    notifyShiftRequestsChanged();
    leave();
  }
}

interface PendingRequestProps {
  /** Título de la pantalla (también si no se pudo cargar o ya no está pendiente). */
  title: string;
  children: (request: ShiftRequest) => ReactNode;
}

/**
 * Pantallas para decidir una solicitud (aprobar o rechazar): primero se obtiene la solicitud
 * pendiente; si ya se decidió, se explica y se ofrece volver a la bandeja.
 */
export function PendingRequest({ title, children }: PendingRequestProps) {
  const requestId = Number(useParams().id);
  // La bandeja pasa la solicitud al abrir "Aprobar" o "Rechazar" (`state: { request }`).
  const state: unknown = useLocation().state;
  const passed = isRecord(state) && isShiftRequest(state.request) ? state.request : null;
  const t = useT();
  const { data, error, retry } = useResource(async (signal) => ({ request: await findPendingRequest(requestId, passed, signal) }), requestId, () => translate('shifts.requests.closed.loadError'));

  if (!data) return error ? <LoadFailed title={title} backTo={paths.company.shiftRequests} backLabel={t('shifts.requests.backLabel')} onRetry={retry} /> : <SkeletonCard lines={6} />;
  if (data.request) return children(data.request);
  return (
    <div className="page">
      <Panel>
        <PanelHeader title={title} backTo={paths.company.shiftRequests} backLabel={t('shifts.requests.backLabel')} />
        <PanelSection>
          <EmptyState
            icon={<Inbox />}
            title={t('shifts.requests.closed.title')}
            description={t('shifts.requests.closed.description')}
            action={
              <ButtonLink to={paths.company.shiftRequests} variant="primary" icon={<Inbox size={18} />}>
                {t('shifts.requests.closed.action')}
              </ButtonLink>
            }
          />
        </PanelSection>
      </Panel>
    </div>
  );
}

/** "Matutino (08:00 – 16:00)" o "Sin turno". */
const shiftName = (shift: ShiftRef | null) => (shift ? `${shift.name} (${shiftSchedule(shift)})` : translate('shifts.requests.summary.noShift'));

/** El cambio pedido: turno actual → turno pedido (cada uno con su marca si ya está en «Eliminados»). */
export function ShiftChange({ request }: { request: ShiftRequest }) {
  const t = useT();
  return (
    <span className="shift-change">
      <span>
        {shiftName(request.current_shift)}
        <DeletedMark deleted={request.current_shift?.deleted} />
      </span>
      <ArrowRight size={16} role="img" aria-label={t('shifts.requests.summary.changesTo')} />
      <strong>
        {shiftName(request.shift)}
        <DeletedMark deleted={request.shift.deleted} />
      </strong>
    </span>
  );
}

/** Lo que pidió el empleado (para decidir): el cambio, desde cuándo, el motivo y cuándo lo pidió. */
export function RequestSummary({ request }: { request: ShiftRequest }) {
  const t = useT();
  return (
    <dl className="details">
      <div>
        <dt>{t('shifts.requests.summary.change')}</dt>
        <dd>
          <ShiftChange request={request} />
        </dd>
      </div>
      <div>
        <dt>{t('shifts.requests.summary.from')}</dt>
        <dd>{formatDate(request.valid_from)}</dd>
      </div>
      <div>
        <dt>{t('common.fields.reason')}</dt>
        <dd>“{request.reason}”</dd>
      </div>
      <div>
        <dt>{t('shifts.requests.summary.requested')}</dt>
        <dd>{timeAgo(request.created_at)}</dd>
      </div>
    </dl>
  );
}
