import { CalendarPlus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormFooter } from '../../../components/FormFooter';
import { LoadFailed } from '../../../components/shifts/PageStates';
import { AssignmentSections, SHIFT_OPTIONS_LIMIT } from '../../../components/shifts/ShiftChoice';
import { businessTomorrow } from '../../../components/shifts/shiftRules';
import { useAssignment } from '../../../components/shifts/useAssignment';
import { Panel, PanelHeader } from '../../../components/ui/Panel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useFeedback } from '../../../hooks/useFeedback';
import { useResource } from '../../../hooks/useResource';
import { t as translate, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { employeeService } from '../../../services/employeeService';
import { shiftService } from '../../../services/shiftService';
import type { Employee, Shift, ShiftAssignmentList } from '../../../types';
import { employeeLabel } from '../../../utils/employeeLabel';
import { businessToday, formatDate } from '../../../utils/format';

/**
 * Asignar (o cambiar) el turno de un empleado: solo qué turno y desde cuándo (decisión del dueño del
 * producto: el turno ya dice el horario, sus sitios y sus días remotos). Con un turno ya asignado, el
 * cambio aplica desde mañana o después.
 */
export function AssignShiftPage() {
  const t = useT();
  const employeeId = Number(useParams().id);
  const { data, error, retry } = useResource(
    (signal) =>
      Promise.all([
        employeeService.get(employeeId, signal),
        shiftService.list({ active: true, page: 1, size: SHIFT_OPTIONS_LIMIT }, signal),
        // El más reciente basta: dice si ya tiene turno (un día de anticipación) y si hay un cambio programado.
        shiftService.assignments(employeeId, { page: 1, size: 1 }, signal),
      ]),
    employeeId,
    () => translate('shifts.assign.prepareError'),
  );

  if (!data) return error ? <LoadFailed title={t('shifts.assign.title')} backTo={paths.company.employeeShifts(employeeId)} backLabel={t('shifts.assign.history.title')} onRetry={retry} /> : <SkeletonCard lines={8} />;
  const [employee, shifts, history] = data;
  return <AssignForm key={employee.id} employee={employee} shifts={shifts.items} history={history} />;
}

function AssignForm({ employee, shifts, history }: { employee: Employee; shifts: Shift[]; history: ShiftAssignmentList }) {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const hasShift = history.total > 0;
  const minDate = hasShift ? businessTomorrow() : businessToday();
  const scheduled = history.items.find((assignment) => assignment.state === 'SCHEDULED');
  const [shiftId, setShiftId] = useState('');
  const shift = shifts.find((option) => String(option.id) === shiftId) ?? null;
  const assignment = useAssignment(minDate, {
    shift,
    minDate,
    minMessage: () => translate(hasShift ? 'shifts.assign.errors.fromTomorrow' : 'shifts.assign.errors.notPast'),
  });
  const back = () => void navigate(paths.company.employeeShifts(employee.id));

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const payload = { shift_id: Number(shiftId), valid_from: assignment.validFrom };
    assignment.send(
      async () => {
        const saved = await shiftService.assign(employee.id, payload);
        void feedback.show(() => ({
          variant: 'success',
          title: translate('shifts.assign.done.title'),
          text: translate('shifts.assign.done.text', { employee: employee.full_name, shift: saved.shift.name, date: formatDate(saved.valid_from) }),
          details: hasShift ? [translate('shifts.assign.done.endsBefore'), translate('shifts.assign.done.keepsRecords')] : undefined,
          detailsStyle: 'checks',
        }));
        back();
      },
      () => translate('shifts.assign.error'),
      (chosen, facts) => ({
        kind: 'create',
        icon: <CalendarPlus size={30} />,
        eyebrow: translate(hasShift ? 'shifts.assign.confirm.eyebrowChange' : 'shifts.assign.title'),
        title: translate('shifts.assign.confirm.title', { shift: chosen.name, employee: employee.full_name }),
        details: facts,
        note: hasShift ? translate('shifts.assign.confirm.note') : undefined,
        confirmLabel: translate('shifts.assign.title'),
        confirmIcon: <CalendarPlus size={18} />,
      }),
    );
  };

  const dateHint = [
    hasShift ? t('shifts.assign.hints.hasShift') : t('shifts.assign.hints.firstShift'),
    scheduled ? t('shifts.assign.hints.scheduled', { shift: scheduled.shift.name, date: formatDate(scheduled.valid_from) }) : '',
  ].join(' ');

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title={t('shifts.assign.title')} subtitle={employeeLabel(employee)} backTo={paths.company.employeeShifts(employee.id)} backLabel={t('shifts.assign.history.title')} />
        <AssignmentSections shifts={shifts} shiftId={shiftId} onShift={setShiftId} assignment={assignment} minDate={minDate} dateHint={dateHint.trim()} />
        <FormFooter submitLabel={t('shifts.assign.title')} submitIcon={<CalendarPlus size={20} />} saving={assignment.saving} disabled={shifts.length === 0} disabledTitle={t('shifts.choice.empty.title')} onCancel={back} />
      </Panel>
    </div>
  );
}
