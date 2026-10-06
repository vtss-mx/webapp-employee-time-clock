import { useCatalogs } from '../../../hooks/useCatalogs';
import { useT } from '../../../i18n';
import type { Absence } from '../../../types';
import { formatDateTime, timeAgo } from '../../../utils/format';
import { daysText, rangeText } from '../../calendar/calendarRules';
import { CatalogStatusBadge } from '../../StatusBadge';
import { AttendanceItem, CancelRequestButton, ItemNote } from './AttendanceItem';
import { dayOffIcon } from './DayOffCard';

interface AbsenceItemProps {
  absence: Absence;
  /** Cancelando esta solicitud. */
  busy: boolean;
  onCancel: () => void;
}

/**
 * Unas vacaciones o un permiso del empleado: el tipo (nombre del catálogo day_off_types), sus fechas,
 * cuántos días son, su estado (catálogo shift_request_statuses), quién la pidió y la respuesta de la
 * empresa. Pendiente: se puede cancelar.
 */
export function AbsenceItem({ absence, busy, onCancel }: AbsenceItemProps) {
  const { nameOf } = useCatalogs();
  const t = useT();
  const Icon = dayOffIcon(absence.type);
  return (
    <AttendanceItem
      icon={<Icon size={20} />}
      title={nameOf('day_off_types', absence.type)}
      detail={rangeText(absence.starts_on, absence.ends_on)}
      badges={<CatalogStatusBadge catalog="shift_request_statuses" code={absence.status} />}
      actions={absence.status === 'PENDING' && <CancelRequestButton busy={busy} onCancel={onCancel} />}
    >
      <dl className="details attendance-item__facts">
        <div>
          <dt>{t('myAttendance.items.days')}</dt>
          <dd>{daysText(absence.days)}</dd>
        </div>
        <div>
          <dt>{t(absence.requested_by_employee ? 'myAttendance.items.requestedByYou' : 'myAttendance.items.registeredByCompany')}</dt>
          <dd title={formatDateTime(absence.created_at)}>{timeAgo(absence.created_at)}</dd>
        </div>
        {absence.note && (
          <div className="attendance-item__wide">
            <dt>{t('common.fields.note')}</dt>
            <dd>{absence.note}</dd>
          </div>
        )}
      </dl>
      {absence.decision_note && <ItemNote label={t('myAttendance.items.companyReply')}>{absence.decision_note}</ItemNote>}
    </AttendanceItem>
  );
}
