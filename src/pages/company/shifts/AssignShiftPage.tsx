import { CalendarPlus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormFooter } from '../../../components/FormFooter';
import { LoadFailed } from '../../../components/shifts/PageStates';
import { AssignmentSections, SHIFT_OPTIONS_LIMIT } from '../../../components/shifts/ShiftChoice';
import { businessTomorrow } from '../../../components/shifts/shiftRules';
import { usePlacement } from '../../../components/shifts/usePlacement';
import { Panel, PanelHeader } from '../../../components/ui/Panel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useFeedback } from '../../../hooks/useFeedback';
import { useResource } from '../../../hooks/useResource';
import { paths } from '../../../routes/paths';
import { employeeService } from '../../../services/employeeService';
import { shiftService } from '../../../services/shiftService';
import type { Employee, Shift, ShiftAssignmentList } from '../../../types';
import { businessToday, formatDate } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';

/**
 * Asignar (o cambiar) el turno de un empleado: qué turno, desde cuándo, qué días checa remoto y en
 * qué sitios checa en persona. Con un turno ya asignado, el cambio aplica desde mañana o después.
 */
export function AssignShiftPage() {
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
    'No se pudo preparar la asignación',
  );

  if (!data) return error ? <LoadFailed title="Asignar turno" backTo={paths.company.employeeShifts(employeeId)} backLabel="Turnos del empleado" onRetry={retry} /> : <SkeletonCard lines={8} />;
  const [employee, shifts, history] = data;
  return <AssignForm key={employee.id} employee={employee} shifts={shifts.items} history={history} />;
}

function AssignForm({ employee, shifts, history }: { employee: Employee; shifts: Shift[]; history: ShiftAssignmentList }) {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const hasShift = history.total > 0;
  const minDate = hasShift ? businessTomorrow() : businessToday();
  const scheduled = history.items.find((assignment) => assignment.state === 'SCHEDULED');
  const [shiftId, setShiftId] = useState('');
  const shift = shifts.find((option) => String(option.id) === shiftId) ?? null;
  const placement = usePlacement(
    { validFrom: minDate, remote: [], siteIds: [] },
    {
      shift,
      minDate,
      minMessage: hasShift ? 'Elige desde mañana: un cambio de turno se programa con un día de anticipación.' : 'El turno no puede empezar en una fecha pasada.',
      withPlace: true,
    },
  );
  const back = () => void navigate(paths.company.employeeShifts(employee.id));

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    const payload = { shift_id: Number(shiftId), valid_from: placement.values.validFrom, remote_weekdays: placement.remote, site_ids: placement.values.siteIds };
    placement.send(
      async () => {
        const saved = await shiftService.assign(employee.id, payload);
        void feedback.success('Turno asignado', `${employee.full_name} tendrá el turno ${saved.shift.name} desde el ${formatDate(saved.valid_from)}.`, {
          details: hasShift ? ['Su turno actual termina el día anterior.', 'Lo ya registrado conserva su turno.'] : undefined,
          detailsStyle: 'checks',
        });
        back();
      },
      'No se pudo asignar el turno',
      (chosen, place) => ({
        kind: 'create',
        icon: <CalendarPlus size={30} />,
        eyebrow: hasShift ? 'Cambio de turno' : 'Asignar turno',
        title: `¿Asignar el turno ${chosen.name} a ${employee.full_name}?`,
        details: [{ label: 'Horario', value: `${shiftSchedule(chosen)} · ${weekdaysLabel(chosen.weekdays)}` }, ...place],
        note: hasShift ? 'Su turno actual termina el día anterior; lo ya registrado conserva su turno.' : undefined,
        confirmLabel: 'Asignar turno',
        confirmIcon: <CalendarPlus size={18} />,
      }),
    );
  };

  const dateHint = [
    hasShift ? 'Ya tiene turno: el cambio aplica desde mañana o después y su turno actual termina el día anterior.' : 'Su primer turno puede empezar hoy.',
    scheduled ? `Ya tiene un cambio programado a ${scheduled.shift.name} desde el ${formatDate(scheduled.valid_from)}: elige una fecha posterior o cancélalo primero en su historial.` : '',
  ].join(' ');

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title="Asignar turno" subtitle={`${employee.full_name} · ${employee.employee_number}`} backTo={paths.company.employeeShifts(employee.id)} backLabel="Turnos del empleado" />
        <AssignmentSections shifts={shifts} shiftId={shiftId} onShift={setShiftId} placement={placement} minDate={minDate} dateHint={dateHint.trim()} placeTitle="Desde cuándo y dónde checa" />
        <FormFooter submitLabel="Asignar turno" submitIcon={<CalendarPlus size={20} />} saving={placement.saving} disabled={shifts.length === 0} disabledTitle="No hay turnos activos" onCancel={back} />
      </Panel>
    </div>
  );
}
