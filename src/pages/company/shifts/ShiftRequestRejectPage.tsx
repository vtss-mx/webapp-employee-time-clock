import { useNavigate } from 'react-router-dom';
import { RejectRequestPanel } from '../../../components/RejectRequestPanel';
import { leaveIfClosed, PendingRequest } from '../../../components/shifts/PendingRequest';
import { useFeedback } from '../../../hooks/useFeedback';
import { notifyShiftRequestsChanged } from '../../../hooks/usePendingShiftRequests';
import { t as translate, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import { formatDate } from '../../../utils/format';

/** Rechazar un cambio de turno (/company/shifts/requests/:id/reject): conserva su turno y ve la nota. */
export function ShiftRequestRejectPage() {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const back = () => void navigate(paths.company.shiftRequests);
  return (
    <PendingRequest title={t('shifts.requests.reject.title')}>
      {(request) => (
        <RejectRequestPanel
          title={t('shifts.requests.reject.title')}
          subtitle={`${request.employee.full_name} · ${request.employee.employee_number}`}
          backTo={paths.company.shiftRequests}
          intro={t('shifts.requests.reject.intro', { shift: request.shift.name, date: formatDate(request.valid_from) })}
          placeholder={t('shifts.requests.reject.placeholder')}
          question={() => ({
            title: translate('shifts.requests.reject.confirmTitle', { employee: request.employee.full_name }),
            eyebrow: translate('shifts.requests.reject.title'),
            message: translate('shifts.requests.reject.confirmMessage'),
            facts: [{ label: translate('shifts.requests.approve.requestedShift'), value: translate('shifts.requests.reject.requestedValue', { shift: request.shift.name, date: formatDate(request.valid_from) }) }],
          })}
          onSend={async (note) => {
            await shiftService.reject(request.id, note).catch((err: unknown) => {
              leaveIfClosed(err, back);
              throw err; // el popup explica el motivo
            });
            notifyShiftRequestsChanged();
            void feedback.info(
              () => translate('shifts.requests.reject.done.title'),
              () => translate('shifts.requests.reject.done.text', { employee: request.employee.full_name }),
            );
            back();
          }}
          onCancel={back}
        />
      )}
    </PendingRequest>
  );
}
