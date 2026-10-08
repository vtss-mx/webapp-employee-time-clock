import { CalendarCheck, CalendarClock, CheckCircle2, FileText } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormFooter } from '../../../components/FormFooter';
import { leaveIfClosed, PendingRequest, RequestSummary } from '../../../components/shifts/PendingRequest';
import { ShiftCard } from '../../../components/shifts/ShiftCard';
import { StartDateField } from '../../../components/shifts/ShiftChoice';
import { businessTomorrow } from '../../../components/shifts/shiftRules';
import { useAssignment } from '../../../components/shifts/useAssignment';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useFeedback } from '../../../hooks/useFeedback';
import { notifyShiftRequestsChanged } from '../../../hooks/usePendingShiftRequests';
import { t as translate, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import type { ShiftRequest } from '../../../types';
import { employeeLabel } from '../../../utils/employeeLabel';
import { formatDate } from '../../../utils/format';

/**
 * Aprobar un cambio de turno (/company/shifts/requests/:id/approve): programa el turno pedido. Dónde
 * checará lo dice ese turno (se muestra en su tarjeta); la empresa solo puede ajustar la fecha.
 */
export function ShiftRequestApprovePage() {
  const t = useT();
  return <PendingRequest title={t('shifts.requests.approve.title')}>{(request) => <ApproveForm key={request.id} request={request} />}</PendingRequest>;
}

function ApproveForm({ request }: { request: ShiftRequest }) {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const tomorrow = businessTomorrow();
  // La fecha pedida, salvo que ya no tenga el día de anticipación (entonces, desde mañana).
  const assignment = useAssignment(request.valid_from < tomorrow ? tomorrow : request.valid_from, {
    shift: request.shift,
    minDate: tomorrow,
    minMessage: () => translate('shifts.requests.approve.fromTomorrow'),
  });
  const back = () => void navigate(paths.company.shiftRequests);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const validFrom = assignment.validFrom;
    assignment.send(
      async () => {
        await shiftService.approve(request.id, { valid_from: validFrom });
        notifyShiftRequestsChanged();
        void feedback.success(
          () => translate('shifts.requests.approve.done.title'),
          () => translate('shifts.requests.approve.done.text', { employee: request.employee.full_name, shift: request.shift.name, date: formatDate(validFrom) }),
        );
        back();
      },
      () => translate('shifts.requests.approve.error'),
      (shift, facts) => ({
        tone: 'success',
        icon: <CheckCircle2 size={30} />,
        eyebrow: translate('shifts.requests.approve.title'),
        title: translate('shifts.requests.approve.confirmTitle', { employee: request.employee.full_name, shift: shift.name }),
        message: translate('shifts.requests.approve.confirmMessage'),
        details: facts,
        confirmLabel: translate('shifts.requests.approve.submit'),
        confirmIcon: <CheckCircle2 size={18} />,
      }),
      (err) => leaveIfClosed(err, back),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title={t('shifts.requests.approve.title')} subtitle={employeeLabel(request.employee)} backTo={paths.company.shiftRequests} backLabel={t('shifts.requests.backLabel')} />
        <PanelSection title={t('shifts.requests.approve.request')} icon={<FileText size={20} />}>
          <RequestSummary request={request} />
        </PanelSection>
        <PanelSection title={t('shifts.requests.approve.requestedShift')} icon={<CalendarClock size={20} />}>
          <ShiftCard shift={request.shift} />
        </PanelSection>
        <PanelSection title={t('shifts.choice.since')} icon={<CalendarCheck size={20} />}>
          <StartDateField assignment={assignment} minDate={tomorrow} hint={t('shifts.requests.approve.dateHint', { date: formatDate(request.valid_from) })} />
        </PanelSection>
        <FormFooter submitLabel={t('shifts.requests.approve.submit')} submitIcon={<CheckCircle2 size={20} />} submitVariant="success" saving={assignment.saving} onCancel={back} />
      </Panel>
    </div>
  );
}
