import { CalendarClock, CalendarPlus, CalendarX, History, Moon, UserRound } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { LoadFailed } from '../../../components/shifts/PageStates';
import { periodText, placeText, shiftFacts } from '../../../components/shifts/shiftRules';
import { ShiftItem } from '../../../components/shifts/ShiftItem';
import { CatalogStatusBadge, StatusBadge } from '../../../components/StatusBadge';
import { DeletedBanner, DeletedNote, deleteNote, listEmpty, RestoreButton } from '../../../components/trash/TrashParts';
import { useRestore } from '../../../components/trash/useRestore';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { DeletedMark } from '../../../components/ui/DeletedMark';
import { ListToolbar } from '../../../components/ui/ListControls';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import { useSearchList } from '../../../hooks/useSearchList';
import { t as translate, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { employeeService } from '../../../services/employeeService';
import { shiftService } from '../../../services/shiftService';
import type { Employee, ShiftAssignment } from '../../../types';
import { formatDate } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';

/** Cancelar un cambio programado: va a «Eliminados» (se puede volver a programar con las reglas de asignar). */
const cancelConfirm = (assignment: ShiftAssignment, employee: string) => ({
  kind: 'delete' as const,
  icon: <CalendarX size={30} />,
  eyebrow: translate('shifts.assign.history.cancelConfirm.eyebrow'),
  title: translate('shifts.assign.history.cancelConfirm.title', { employee, shift: assignment.shift.name }),
  message: translate('shifts.assign.history.cancelConfirm.message', { employee }),
  details: [
    { label: translate('shifts.assign.history.cancelConfirm.scheduledShift'), value: `${shiftSchedule(assignment.shift)} · ${weekdaysLabel(assignment.shift.weekdays)}` },
    { label: translate('shifts.assign.history.cancelConfirm.wasFrom'), value: formatDate(assignment.valid_from) },
  ],
  note: deleteNote(),
  confirmLabel: translate('shifts.assign.history.cancel'),
  confirmIcon: <CalendarX size={18} />,
  cancelLabel: translate('shifts.assign.history.cancelConfirm.keep'),
});

/** Restaurar un cambio cancelado: el turno (horario, sitios, días remotos) y desde cuándo iba a aplicar. */
const restoreQuestion = (assignment: ShiftAssignment, employee: string) => ({
  title: translate('shifts.assign.history.restoreTitle', { employee, shift: assignment.shift.name }),
  details: [...shiftFacts(assignment.shift), { label: translate('shifts.assign.history.cancelConfirm.wasFrom'), value: formatDate(assignment.valid_from) }],
});

/**
 * Turnos de un empleado: el vigente, los cambios programados (se pueden cancelar antes de empezar)
 * y los anteriores, cada uno con dónde se checa según su turno (el de hoy: editar el turno aplica a
 * todos). Lo ya registrado conserva el turno y el lugar con que se registró. Los cambios cancelados
 * quedan en «Eliminados» (se vuelven a programar con «Restaurar»). Un empleado eliminado no tiene turnos
 * que consultar: se dice y se ofrece su expediente.
 */
export function EmployeeShiftsPage() {
  const t = useT();
  const employeeId = Number(useParams().id);
  const { data: employee, error, retry } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, () => translate('shifts.assign.history.loadError'));

  if (!employee) {
    return error ? <LoadFailed title={t('shifts.assign.history.title')} backTo={paths.company.employee(employeeId)} backLabel={t('shifts.assign.history.backLabel')} onRetry={retry} /> : <SkeletonCard lines={6} />;
  }
  return <EmployeeShifts employee={employee} />;
}

function EmployeeShifts({ employee }: { employee: Employee }) {
  const t = useT();
  const back = paths.company.employee(employee.id);
  const header = (
    <PanelHeader
      title={employee.full_name}
      subtitle={
        <>
          {employee.employee_number && <span className="badge badge--info badge--plain">{employee.employee_number}</span>}
          {!employee.active && <StatusBadge active={false} />}
          <span>{t('shifts.assign.history.subtitle')}</span>
        </>
      }
      backTo={back}
      backLabel={t('shifts.assign.history.backLabel')}
      actions={employee.active && !employee.deleted_at ? <AssignButton employeeId={employee.id} /> : undefined}
    />
  );
  return (
    <div className="page">
      <Panel>
        {header}
        {employee.deleted_at ? (
          // En «Eliminados» sus turnos ya no existen para el backend (404): no se piden; su expediente lo restaura.
          <PanelSection>
            <DeletedBanner
              record={employee}
              title={t('employees.trash.banner')}
              action={
                <ButtonLink to={back} variant="secondary" icon={<UserRound size={18} />}>
                  {t('shifts.assign.history.backLabel')}
                </ButtonLink>
              }
            />
          </PanelSection>
        ) : (
          <AssignmentList employee={employee} />
        )}
      </Panel>
    </div>
  );
}

function AssignButton({ employeeId }: { employeeId: number }) {
  const t = useT();
  return (
    <ButtonLink to={paths.company.assignShift(employeeId)} variant="primary" icon={<CalendarPlus size={18} />}>
      {t('shifts.assign.title')}
    </ButtonLink>
  );
}

/** Sus asignaciones (paginadas) o los cambios cancelados («Eliminados»). */
function AssignmentList({ employee }: { employee: Employee }) {
  const t = useT();
  const list = useSearchList((query, signal) => shiftService.assignments(employee.id, { page: query.page, size: query.size, deleted: query.deleted }, signal), {
    errorTitle: () => translate('shifts.assign.history.listError'),
    filterKey: String(employee.id),
  });
  const { busy, run } = useAction<number>();
  const { restoring, restore } = useRestore();
  const employeeName = employee.full_name;
  const assign = employee.active ? <AssignButton employeeId={employee.id} /> : undefined;

  const cancel = (assignment: ShiftAssignment) =>
    run(() => shiftService.cancelAssignment(assignment.id), {
      busy: assignment.id,
      confirm: () => cancelConfirm(assignment, employeeName),
      errorTitle: () => translate('shifts.assign.history.cancelError'),
      success: () => [translate('shifts.assign.history.canceled.title'), translate('shifts.assign.history.canceled.text', { employee: employeeName })],
      onSuccess: list.retry,
    });
  const restoreAssignment = (assignment: ShiftAssignment) =>
    void restore(assignment.id, () => shiftService.restoreAssignment(assignment.id), () => restoreQuestion(assignment, employeeName), list.retry);

  return (
    <PanelSection title={t('shifts.assign.history.section')} icon={<History size={20} />}>
      <ListToolbar filter={list.filter} onFilter={list.setFilter} trash statuses={false} />
      <PagedItems
        list={list}
        pager={{ noun: { one: t('shifts.assign.history.noun.one'), other: t('shifts.assign.history.noun.other') } }}
        empty={listEmpty(list, {
          empty: {
            icon: <CalendarClock />,
            title: t('shifts.assign.history.empty.title'),
            description: employee.active ? t('shifts.assign.history.empty.active') : t('shifts.assign.history.empty.inactive'),
            action: assign,
          },
        })}
      >
        {(items) => (
          <ul className={`people-list stagger ${list.loading ? 'is-loading' : ''}`}>
            {items.map((assignment) => (
              <ShiftItem
                key={assignment.id}
                lead={<span className="icon-tile">{assignment.shift.overnight ? <Moon size={18} /> : <CalendarClock size={18} />}</span>}
                title={
                  <>
                    {assignment.shift.name}
                    <DeletedMark deleted={assignment.shift.deleted} />
                  </>
                }
                badges={list.trash ? null : <CatalogStatusBadge catalog="assignment_states" code={assignment.state} />}
                actions={
                  list.trash ? (
                    <RestoreButton name={assignment.shift.name} busy={restoring === assignment.id} disabled={restoring !== null} onRestore={() => restoreAssignment(assignment)} />
                  ) : (
                    assignment.state === 'SCHEDULED' && (
                      <Button size="sm" variant="ghost" icon={<CalendarX size={16} />} loading={busy === assignment.id} disabled={busy !== null} onClick={() => void cancel(assignment)}>
                        {t('shifts.assign.history.cancel')}
                      </Button>
                    )
                  )
                }
              >
                <small className="muted">
                  {shiftSchedule(assignment.shift)} · {weekdaysLabel(assignment.shift.weekdays)}
                </small>
                <small>{periodText(assignment)}</small>
                <small className="muted">{placeText(assignment.shift)}</small>
                {list.trash && <DeletedNote record={assignment} />}
              </ShiftItem>
            ))}
          </ul>
        )}
      </PagedItems>
    </PanelSection>
  );
}
