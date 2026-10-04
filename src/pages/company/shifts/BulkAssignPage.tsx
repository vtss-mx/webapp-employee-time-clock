import { CalendarPlus, Users } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { bulkResultMessage, type BulkCopy } from '../../../components/BulkResultSummary';
import { EmployeePicker } from '../../../components/employees/EmployeePicker';
import { FormFooter } from '../../../components/FormFooter';
import { LoadFailed } from '../../../components/shifts/PageStates';
import { AssignmentSections, SHIFT_OPTIONS_LIMIT } from '../../../components/shifts/ShiftChoice';
import { businessTomorrow } from '../../../components/shifts/shiftRules';
import { usePlacement } from '../../../components/shifts/usePlacement';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useFeedback } from '../../../hooks/useFeedback';
import { useResource } from '../../../hooks/useResource';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import type { Shift } from '../../../types';
import { describeEmployees } from '../../../components/employees/EmployeePicker';
import { businessToday } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';

const COPY: BulkCopy = { title: 'Turno asignado', done: 'Asignado', unchanged: 'Ya lo tenían', skipped: 'No se asignó' };
const NO_EMPLOYEES = 'Elige al menos un empleado';
const BULK_DATE_HINT =
  'Quien ya tiene un turno lo cambia desde mañana o después (si eliges hoy, a esa persona no se le asigna y el resultado lo explica). Su turno actual termina el día anterior.';

/**
 * Asignar el mismo turno a varios empleados a la vez: qué turno, desde cuándo, dónde checan y a
 * quiénes (de la lista con búsqueda y filtros). Con las mismas reglas que asignar a uno: quien ya
 * tiene turno lo cambia desde mañana o después; el resultado dice a quién se le asignó, quién ya lo
 * tenía y a quién no (con el motivo). `?shift=` deja el turno elegido (desde la edición del turno).
 */
export function BulkAssignPage() {
  const preset = useSearchParams()[0].get('shift') ?? '';
  const { data, error, retry } = useResource((signal) => shiftService.list({ active: true, page: 1, size: SHIFT_OPTIONS_LIMIT }, signal), 'active-shifts', 'No se pudieron cargar los turnos');
  if (!data) return error ? <LoadFailed title="Asignar a varios empleados" backTo={paths.company.shifts} backLabel="Turnos" onRetry={retry} /> : <SkeletonCard lines={8} />;
  const shifts = data.items;
  return <BulkAssignForm shifts={shifts} preset={shifts.some((shift) => String(shift.id) === preset) ? preset : ''} />;
}

function BulkAssignForm({ shifts, preset }: { shifts: Shift[]; preset: string }) {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const [shiftId, setShiftId] = useState(preset);
  const [employees, setEmployees] = useState<number[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [employeesError, setEmployeesError] = useState<string>();
  const shift = shifts.find((option) => String(option.id) === shiftId) ?? null;
  const minDate = businessToday();
  const placement = usePlacement(
    { validFrom: businessTomorrow(), remote: [], siteIds: [] },
    { shift, minDate, minMessage: 'El turno no puede empezar en una fecha pasada.', withPlace: true },
  );
  const back = () => void navigate(paths.company.shifts);

  const pick = (ids: number[], known: string[]) => {
    setEmployees(ids);
    setNames(known);
    setEmployeesError(undefined);
  };

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (employees.length === 0) {
      setEmployeesError(NO_EMPLOYEES);
      void feedback.invalidForm({ employee_ids: NO_EMPLOYEES });
      return;
    }
    const payload = { shift_id: Number(shiftId), employee_ids: employees, valid_from: placement.values.validFrom, remote_weekdays: placement.remote, site_ids: placement.values.siteIds };
    placement.send(
      async () => {
        const result = await shiftService.assignMany(payload);
        void feedback.show(bulkResultMessage(result, COPY));
        back();
      },
      'No se pudo asignar el turno',
      (chosen, place) => ({
        kind: 'create',
        icon: <Users size={30} />,
        eyebrow: 'Asignar a varios',
        title: `¿Asignar el turno ${chosen.name} a ${employees.length === 1 ? '1 empleado' : `${employees.length} empleados`}?`,
        message: 'Quien ya tiene exactamente esta asignación se queda igual y a los inactivos no se les asigna: el resultado te dirá a quién sí.',
        details: [describeEmployees(employees.length, names), { label: 'Horario', value: `${shiftSchedule(chosen)} · ${weekdaysLabel(chosen.weekdays)}` }, ...place],
        note: 'Quien ya tiene un turno lo cambia desde la fecha elegida (desde mañana o después); su turno actual termina el día anterior.',
        confirmLabel: 'Asignar turno',
        confirmIcon: <CalendarPlus size={18} />,
      }),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title="Asignar a varios empleados" subtitle="El mismo turno, desde la misma fecha y en los mismos sitios para todos los que elijas." backTo={paths.company.shifts} backLabel="Turnos" />
        <AssignmentSections shifts={shifts} shiftId={shiftId} onShift={setShiftId} placement={placement} minDate={minDate} dateHint={BULK_DATE_HINT} placeTitle="Desde cuándo y dónde checan" />
        <PanelSection title="Empleados" icon={<Users size={20} />}>
          <EmployeePicker value={employees} onChange={pick} disabled={placement.saving} error={employeesError} hint="Los que ya tienen exactamente esta asignación se quedan igual; a los inactivos no se les asigna." label="Empleados a los que se asigna el turno" />
        </PanelSection>
        <FormFooter
          submitLabel={employees.length ? `Asignar a ${employees.length} ${employees.length === 1 ? 'empleado' : 'empleados'}` : 'Asignar turno'}
          submitIcon={<CalendarPlus size={20} />}
          saving={placement.saving}
          disabled={shifts.length === 0}
          disabledTitle="No hay turnos activos"
          onCancel={back}
        />
      </Panel>
    </div>
  );
}
