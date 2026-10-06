import { CalendarPlus, Users } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { bulkResultMessage, type BulkCopy } from '../../../components/BulkResultSummary';
import { EmployeePicker } from '../../../components/employees/EmployeePicker';
import { FormFooter } from '../../../components/FormFooter';
import { LoadFailed } from '../../../components/shifts/PageStates';
import { AssignmentSections, SHIFT_OPTIONS_LIMIT } from '../../../components/shifts/ShiftChoice';
import { businessTomorrow, shiftsLoadError } from '../../../components/shifts/shiftRules';
import { useAssignment } from '../../../components/shifts/useAssignment';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useFeedback } from '../../../hooks/useFeedback';
import { useResource } from '../../../hooks/useResource';
import { t as translate, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import type { Shift } from '../../../types';
import { describeEmployees } from '../../../components/employees/EmployeePicker';
import { businessToday } from '../../../utils/format';

/** Textos del resultado por empleado, en el idioma activo. */
const bulkCopy = (): BulkCopy => ({
  title: translate('shifts.assign.done.title'),
  done: translate('shifts.assign.bulk.result.done'),
  unchanged: translate('shifts.assign.bulk.result.unchanged'),
  skipped: translate('shifts.assign.bulk.result.skipped'),
});

/**
 * Asignar el mismo turno a varios empleados a la vez: qué turno (que ya dice dónde y cuándo checan),
 * desde cuándo y a quiénes (de la lista con búsqueda y filtros). Con las mismas reglas que asignar a
 * uno: quien ya tiene turno lo cambia desde mañana o después; el resultado dice a quién se le asignó,
 * quién ya lo tenía y a quién no (con el motivo). `?shift=` deja el turno elegido (desde su edición).
 */
export function BulkAssignPage() {
  const t = useT();
  const preset = useSearchParams()[0].get('shift') ?? '';
  const { data, error, retry } = useResource((signal) => shiftService.list({ active: true, page: 1, size: SHIFT_OPTIONS_LIMIT }, signal), 'active-shifts', shiftsLoadError);
  if (!data) return error ? <LoadFailed title={t('shifts.assign.bulk.title')} backTo={paths.company.shifts} backLabel={t('shifts.list.title')} onRetry={retry} /> : <SkeletonCard lines={8} />;
  const shifts = data.items;
  return <BulkAssignForm shifts={shifts} preset={shifts.some((shift) => String(shift.id) === preset) ? preset : ''} />;
}

function BulkAssignForm({ shifts, preset }: { shifts: Shift[]; preset: string }) {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const [shiftId, setShiftId] = useState(preset);
  const [employees, setEmployees] = useState<number[]>([]);
  const [names, setNames] = useState<string[]>([]);
  // Solo si falta elegir (el texto se traduce al dibujarse).
  const [missingEmployees, setMissingEmployees] = useState(false);
  const shift = shifts.find((option) => String(option.id) === shiftId) ?? null;
  const minDate = businessToday();
  const assignment = useAssignment(businessTomorrow(), { shift, minDate, minMessage: () => translate('shifts.assign.errors.notPast') });
  const back = () => void navigate(paths.company.shifts);

  const pick = (ids: number[], known: string[]) => {
    setEmployees(ids);
    setNames(known);
    setMissingEmployees(false);
  };

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (employees.length === 0) {
      setMissingEmployees(true);
      void feedback.invalidForm(() => ({ employee_ids: translate('shifts.assign.bulk.employeesRequired') }));
      return;
    }
    const payload = { shift_id: Number(shiftId), employee_ids: employees, valid_from: assignment.validFrom };
    assignment.send(
      async () => {
        const result = await shiftService.assignMany(payload);
        void feedback.show(() => bulkResultMessage(result, bulkCopy()));
        back();
      },
      () => translate('shifts.assign.error'),
      (chosen, facts) => ({
        kind: 'create',
        icon: <Users size={30} />,
        eyebrow: translate('shifts.list.assignMany'),
        title: translate('shifts.assign.bulk.confirmTitle', { shift: chosen.name, count: employees.length }),
        message: translate('shifts.assign.bulk.confirmMessage'),
        details: [describeEmployees(employees.length, names), ...facts],
        note: translate('shifts.assign.bulk.confirmNote'),
        confirmLabel: translate('shifts.assign.title'),
        confirmIcon: <CalendarPlus size={18} />,
      }),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title={t('shifts.assign.bulk.title')} subtitle={t('shifts.assign.bulk.subtitle')} backTo={paths.company.shifts} backLabel={t('shifts.list.title')} />
        <AssignmentSections shifts={shifts} shiftId={shiftId} onShift={setShiftId} assignment={assignment} minDate={minDate} dateHint={t('shifts.assign.bulk.dateHint')} />
        <PanelSection title={t('shifts.assign.bulk.employees')} icon={<Users size={20} />}>
          <EmployeePicker
            value={employees}
            onChange={pick}
            disabled={assignment.saving}
            error={missingEmployees ? t('shifts.assign.bulk.employeesRequired') : undefined}
            hint={t('shifts.assign.bulk.employeesHint')}
            label={t('shifts.assign.bulk.employeesLabel')}
          />
        </PanelSection>
        <FormFooter
          submitLabel={employees.length ? t('shifts.assign.bulk.submit', { count: employees.length }) : t('shifts.assign.title')}
          submitIcon={<CalendarPlus size={20} />}
          saving={assignment.saving}
          disabled={shifts.length === 0}
          disabledTitle={t('shifts.choice.empty.title')}
          onCancel={back}
        />
      </Panel>
    </div>
  );
}
