import { Repeat } from 'lucide-react';
import { useT } from '../../../i18n';
import type { ShiftRequest } from '../../../types';
import { formatDate, formatDateTime, timeAgo } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';
import { CatalogStatusBadge } from '../../StatusBadge';
import { DeletedMark } from '../../ui/DeletedMark';
import { AttendanceItem, CancelRequestButton, ItemNote } from './AttendanceItem';

interface ShiftRequestItemProps {
  request: ShiftRequest;
  /** Cancelando esta solicitud. */
  busy: boolean;
  onCancel: () => void;
}

/**
 * Una solicitud de cambio de turno: el turno pedido (horario y días), desde cuándo, el motivo, su
 * estado (catálogo shift_request_statuses) y la respuesta de la empresa. Pendiente: se puede cancelar.
 */
export function ShiftRequestItem({ request, busy, onCancel }: ShiftRequestItemProps) {
  const { shift } = request;
  const t = useT();
  return (
    <AttendanceItem
      icon={<Repeat size={20} />}
      title={shift.name}
      detail={`${shiftSchedule(shift)} · ${weekdaysLabel(shift.weekdays)}`}
      badges={
        <>
          <DeletedMark deleted={shift.deleted} />
          <CatalogStatusBadge catalog="shift_request_statuses" code={request.status} />
        </>
      }
      actions={request.status === 'PENDING' && <CancelRequestButton busy={busy} onCancel={onCancel} />}
    >
      <dl className="details attendance-item__facts">
        <div>
          <dt>{t('myAttendance.labels.from')}</dt>
          <dd>{formatDate(request.valid_from)}</dd>
        </div>
        <div>
          <dt>{t('myAttendance.items.previousShift')}</dt>
          <dd>
            {request.current_shift?.name ?? t('myAttendance.items.noShift')}
            <DeletedMark deleted={request.current_shift?.deleted} />
          </dd>
        </div>
        <div>
          <dt>{t('myAttendance.items.requested')}</dt>
          <dd title={formatDateTime(request.created_at)}>{timeAgo(request.created_at)}</dd>
        </div>
        <div className="attendance-item__wide">
          <dt>{t('common.fields.reason')}</dt>
          <dd>{request.reason}</dd>
        </div>
      </dl>
      {request.review_note && <ItemNote label={t('myAttendance.items.companyReply')}>{request.review_note}</ItemNote>}
    </AttendanceItem>
  );
}
