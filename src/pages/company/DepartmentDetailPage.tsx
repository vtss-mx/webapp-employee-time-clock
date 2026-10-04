import { Pencil, ShieldCheck, ShieldOff, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { PersonItem } from '../../components/departments/PersonItem';
import { StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAction } from '../../hooks/useAction';
import { usePagedList } from '../../hooks/usePagedList';
import { useResource } from '../../hooks/useResource';
import { paths } from '../../routes/paths';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';
import type { Department, DepartmentPerson, Employee } from '../../types';
import type { ConfirmInput } from '../../types/confirm';

/** Busy de cada botón: el responsable o el empleado que se está quitando, o el borrado. */
type Busy = `manager:${number}` | `member:${number}` | 'delete';

/** "Ana Ruiz · No. EMP-7": la persona en una confirmación. */
const personText = (name: string, number: string) => `${name} · No. ${number}`;

/** Los responsables en una línea ("Sin responsables" si no hay). */
const managerNames = (managers: DepartmentPerson[]) => managers.map((m) => m.full_name).join(', ') || 'Sin responsables';

/** Retirar a un responsable: deja de serlo (los demás siguen); su cuenta y su departamento no cambian. */
function removeManagerConfirm(department: Department, manager: DepartmentPerson): ConfirmInput {
  return {
    tone: 'danger',
    icon: <ShieldOff size={30} />,
    eyebrow: 'Responsables',
    title: `¿Retirar a ${manager.full_name} como responsable de ${department.name}?`,
    message: 'Dejará de ser responsable de este departamento. Sigue en tu empresa y su departamento asignado no cambia.',
    changes: [
      {
        label: 'Responsables',
        before: managerNames(department.managers),
        after: managerNames(department.managers.filter((m) => m.employee_id !== manager.employee_id)),
      },
    ],
    details: [{ label: 'Responsable', value: personText(manager.full_name, manager.employee_number) }],
    confirmLabel: 'Retirar responsable',
    confirmIcon: <X size={18} />,
  };
}

/** Quitar a un empleado: queda sin departamento hasta que se le asigne otro. */
function removeMemberConfirm(department: Department, employee: Employee): ConfirmInput {
  return {
    tone: 'danger',
    icon: <UserMinus size={30} />,
    eyebrow: 'Empleados del departamento',
    title: `¿Quitar a ${employee.full_name} de ${department.name}?`,
    message: 'Quedará sin departamento hasta que lo asignes a otro. Su cuenta y su historial no cambian.',
    changes: [{ label: 'Departamento', before: department.name, after: 'Sin departamento' }],
    details: [{ label: 'Empleado', value: personText(employee.full_name, employee.employee_number) }],
    confirmLabel: 'Quitar del departamento',
    confirmIcon: <UserMinus size={18} />,
  };
}

/** Eliminar el departamento: con empleados asignados el servidor lo impide, y la confirmación ya lo dice. */
function deleteConfirm(department: Department): ConfirmInput {
  const count = department.employee_count;
  const one = count === 1;
  return {
    kind: 'delete',
    title: `¿Eliminar el departamento ${department.name}?`,
    message:
      count > 0 ? (
        <>
          <strong>{department.name}</strong> tiene {one ? '1 empleado asignado' : `${count} empleados asignados`}: {one ? 'quítalo o asígnalo' : 'quítalos o asígnalos'} a otro departamento antes de eliminarlo.
        </>
      ) : (
        <>
          Se eliminará <strong>{department.name}</strong> y se retirarán sus responsables.
        </>
      ),
    details: [
      { label: 'Responsables', value: managerNames(department.managers) },
      { label: 'Empleados asignados', value: String(count) },
    ],
    note: 'Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar departamento',
  };
}

/**
 * Detalle de un departamento: sus responsables (empleados de la empresa, pueden ser varios) y sus
 * empleados asignados (paginados). Desde aquí se agregan o quitan y se elimina el departamento.
 */
export function DepartmentDetailPage() {
  const departmentId = Number(useParams().id);
  const navigate = useNavigate();
  const { data: department, setData, error, retry } = useResource((signal) => departmentService.get(departmentId, signal), departmentId, 'No se pudo cargar el departamento');
  const members = usePagedList((page, signal) => employeeService.list({ ...page, department_id: departmentId }, signal), {
    errorTitle: 'No se pudieron cargar sus empleados',
    filterKey: String(departmentId),
  });
  const { busy, run } = useAction<Busy>();

  if (!department) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title="Departamento" backTo={paths.company.departments} backLabel="Departamentos" />
          <PanelSection>
            <RetryState onRetry={retry} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={6} />
    );
  }

  const refreshed = (saved: Department) => setData(saved);
  // Cada acción pregunta antes (cancelar no envía nada) y su botón queda ocupado mientras se procesa.
  const removeManager = (manager: DepartmentPerson) =>
    run(() => departmentService.removeManager(department.id, manager.employee_id), {
      busy: `manager:${manager.employee_id}`,
      confirm: removeManagerConfirm(department, manager),
      errorTitle: 'No se pudo retirar al responsable',
      success: ['Responsable retirado', `${manager.full_name} ya no es responsable de ${department.name}.`],
      onSuccess: refreshed,
    });
  const removeMember = (employee: Employee) =>
    run(() => departmentService.unassign(department.id, employee.id), {
      busy: `member:${employee.id}`,
      confirm: removeMemberConfirm(department, employee),
      errorTitle: 'No se pudo quitar al empleado',
      success: ['Empleado quitado', `${employee.full_name} ya no está en ${department.name}.`],
      onSuccess: (saved) => {
        refreshed(saved);
        members.retry();
      },
    });
  const remove = () =>
    run(() => departmentService.remove(department.id), {
      busy: 'delete',
      confirm: deleteConfirm(department),
      errorTitle: 'No se pudo eliminar el departamento',
      success: ['Departamento eliminado'],
      onSuccess: () => void navigate(paths.company.departments, { replace: true }),
      keepBusy: true,
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={department.name}
          subtitle={department.description ?? `${department.employee_count} ${department.employee_count === 1 ? 'empleado' : 'empleados'}`}
          backTo={paths.company.departments}
          backLabel="Departamentos"
          actions={
            <ButtonLink to={paths.company.editDepartment(department.id)} variant="primary" icon={<Pencil size={18} />}>
              Editar
            </ButtonLink>
          }
        />

        <PanelSection
          title="Responsables"
          icon={<ShieldCheck size={20} />}
          aside={
            <ButtonLink to={paths.company.assignDepartment(department.id, 'managers')} variant="secondary" size="sm" icon={<UserPlus size={16} />}>
              Agregar responsable
            </ButtonLink>
          }
        >
          {department.managers.length === 0 ? (
            <EmptyState compact icon={<ShieldCheck />} title="Sin responsables" description="Nombra a uno o varios empleados de tu empresa como responsables de este departamento." />
          ) : (
            <ul className="people-list stagger">
              {department.managers.map((manager) => (
                <PersonItem
                  key={manager.employee_id}
                  name={manager.full_name}
                  detail={`No. ${manager.employee_number}`}
                  badges={manager.active ? null : <StatusBadge active={false} />}
                  actions={
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<X size={16} />}
                      loading={busy === `manager:${manager.employee_id}`}
                      disabled={busy !== null}
                      aria-label={`Retirar a ${manager.full_name} como responsable`}
                      onClick={() => void removeManager(manager)}
                    >
                      Retirar
                    </Button>
                  }
                />
              ))}
            </ul>
          )}
        </PanelSection>

        <PanelSection
          title={`Empleados (${department.employee_count})`}
          icon={<Users size={20} />}
          aside={
            <ButtonLink to={paths.company.assignDepartment(department.id, 'employees')} variant="secondary" size="sm" icon={<UserPlus size={16} />}>
              Asignar empleados
            </ButtonLink>
          }
        >
          <PagedItems
            list={members}
            pager={{ noun: { one: 'empleado', other: 'empleados' } }}
            empty={{ compact: true, icon: <Users />, title: 'Sin empleados asignados', description: 'Asigna a las personas que trabajan en este departamento. Cada empleado está en un solo departamento.' }}
          >
            {(items) => (
              <ul className={`people-list stagger ${members.loading ? 'is-loading' : ''}`}>
                {items.map((employee) => (
                  <PersonItem
                    key={employee.id}
                    name={employee.full_name}
                    detail={`No. ${employee.employee_number}`}
                    badges={<StatusBadge active={employee.active} />}
                    actions={
                      <>
                        <ButtonLink to={paths.company.employee(employee.id)} size="sm" variant="ghost">
                          Ver
                        </ButtonLink>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<UserMinus size={16} />}
                          loading={busy === `member:${employee.id}`}
                          disabled={busy !== null}
                          aria-label={`Quitar a ${employee.full_name} del departamento`}
                          onClick={() => void removeMember(employee)}
                        >
                          Quitar
                        </Button>
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </PagedItems>
        </PanelSection>

        <PanelFooter align="end">
          <Button variant="danger-outline" icon={<Trash2 size={18} />} loading={busy === 'delete'} disabled={busy !== null} onClick={() => void remove()}>
            Eliminar departamento
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
