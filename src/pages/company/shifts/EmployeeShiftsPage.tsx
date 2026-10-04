import { CalendarClock, CalendarPlus, CalendarX, History, Moon } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { LoadFailed } from '../../../components/shifts/PageStates';
import { periodText, placeText } from '../../../components/shifts/shiftRules';
import { ShiftItem } from '../../../components/shifts/ShiftItem';
import { CatalogStatusBadge, StatusBadge } from '../../../components/StatusBadge';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useAction } from '../../../hooks/useAction';
import { usePagedList } from '../../../hooks/usePagedList';
import { useResource } from '../../../hooks/useResource';
import { paths } from '../../../routes/paths';
import { employeeService } from '../../../services/employeeService';
import { shiftService } from '../../../services/shiftService';
import type { ShiftAssignment } from '../../../types';
import { formatDate } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';

/**
 * Turnos de un empleado: el vigente, los cambios programados (se pueden cancelar antes de empezar)
 * y los anteriores. Lo ya registrado conserva el turno con que se registró.
 */
export function EmployeeShiftsPage() {
  const employeeId = Number(useParams().id);
  const { data: employee, error, retry } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, 'No se pudo cargar el empleado');
  const list = usePagedList((page, signal) => shiftService.assignments(employeeId, page, signal), { errorTitle: 'No se pudieron cargar sus turnos', filterKey: String(employeeId) });
  const { busy, run } = useAction<number>();

  if (!employee) {
    return error ? <LoadFailed title="Turnos del empleado" backTo={paths.company.employee(employeeId)} backLabel="Expediente" onRetry={retry} /> : <SkeletonCard lines={6} />;
  }

  const assign = (
    <ButtonLink to={paths.company.assignShift(employeeId)} variant="primary" icon={<CalendarPlus size={18} />}>
      Asignar turno
    </ButtonLink>
  );
  const cancel = (assignment: ShiftAssignment) =>
    run(() => shiftService.cancelAssignment(assignment.id), {
      busy: assignment.id,
      confirm: {
        kind: 'delete',
        icon: <CalendarX size={30} />,
        eyebrow: 'Cambio programado',
        title: `¿Cancelar el cambio de ${employee.full_name} al turno ${assignment.shift.name}?`,
        message: `${employee.full_name} conservará el turno que tiene.`,
        details: [
          { label: 'Turno programado', value: `${shiftSchedule(assignment.shift)} · ${weekdaysLabel(assignment.shift.weekdays)}` },
          { label: 'Iba a aplicar desde', value: formatDate(assignment.valid_from) },
        ],
        confirmLabel: 'Cancelar cambio',
        confirmIcon: <CalendarX size={18} />,
        cancelLabel: 'Conservar el cambio',
      },
      errorTitle: 'No se pudo cancelar el cambio de turno',
      success: ['Cambio de turno cancelado', `${employee.full_name} conserva el turno que tenía.`],
      onSuccess: list.retry,
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={employee.full_name}
          subtitle={
            <>
              <span className="badge badge--info badge--plain">{employee.employee_number}</span>
              {!employee.active && <StatusBadge active={false} />}
              <span>Turnos vigentes, programados y anteriores</span>
            </>
          }
          backTo={paths.company.employee(employeeId)}
          backLabel="Expediente"
          actions={employee.active ? assign : undefined}
        />
        <PanelSection title="Turnos asignados" icon={<History size={20} />}>
          <PagedItems
            list={list}
            pager={{ noun: { one: 'asignación', other: 'asignaciones' } }}
            empty={{
              icon: <CalendarClock />,
              title: 'Sin turno asignado',
              description: employee.active
                ? 'Asígnale un turno para que tenga jornadas programadas y pueda checar su asistencia.'
                : 'El empleado está inactivo: actívalo desde su expediente para asignarle un turno.',
              action: employee.active ? assign : undefined,
            }}
          >
            {(items) => (
              <ul className={`people-list stagger ${list.loading ? 'is-loading' : ''}`}>
                {items.map((assignment) => (
                  <ShiftItem
                    key={assignment.id}
                    lead={<span className="icon-tile">{assignment.shift.overnight ? <Moon size={18} /> : <CalendarClock size={18} />}</span>}
                    title={assignment.shift.name}
                    badges={<CatalogStatusBadge catalog="assignment_states" code={assignment.state} />}
                    actions={
                      assignment.state === 'SCHEDULED' && (
                        <Button size="sm" variant="ghost" icon={<CalendarX size={16} />} loading={busy === assignment.id} disabled={busy !== null} onClick={() => void cancel(assignment)}>
                          Cancelar cambio
                        </Button>
                      )
                    }
                  >
                    <small className="muted">
                      {shiftSchedule(assignment.shift)} · {weekdaysLabel(assignment.shift.weekdays)}
                    </small>
                    <small>{periodText(assignment)}</small>
                    <small className="muted">{placeText(assignment)}</small>
                  </ShiftItem>
                ))}
              </ul>
            )}
          </PagedItems>
        </PanelSection>
      </Panel>

    </div>
  );
}
