import { Pencil, ShieldCheck, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PersonItem } from '../../components/departments/PersonItem';
import { ConfirmDialog } from '../../components/Modal';
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
import type { Department } from '../../types';

/** Busy de cada botón: el responsable o el empleado que se está quitando, o el borrado. */
type Busy = `manager:${number}` | `member:${number}` | 'delete';

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
  const [confirmDelete, setConfirmDelete] = useState(false);

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
  const removeManager = (employeeId: number, name: string) =>
    run(() => departmentService.removeManager(department.id, employeeId), {
      busy: `manager:${employeeId}`,
      errorTitle: 'No se pudo retirar al responsable',
      success: ['Responsable retirado', `${name} ya no es responsable de ${department.name}.`],
      onSuccess: refreshed,
    });
  const removeMember = (employeeId: number, name: string) =>
    run(() => departmentService.unassign(department.id, employeeId), {
      busy: `member:${employeeId}`,
      errorTitle: 'No se pudo quitar al empleado',
      success: ['Empleado quitado', `${name} ya no está en ${department.name}.`],
      onSuccess: (saved) => {
        refreshed(saved);
        members.retry();
      },
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
                      onClick={() => void removeManager(manager.employee_id, manager.full_name)}
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
                          onClick={() => void removeMember(employee.id, employee.full_name)}
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
          <Button variant="danger-outline" icon={<Trash2 size={18} />} onClick={() => setConfirmDelete(true)}>
            Eliminar departamento
          </Button>
        </PanelFooter>
      </Panel>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar departamento"
        message={
          department.employee_count > 0 ? (
            <>
              <strong>{department.name}</strong> tiene {department.employee_count} {department.employee_count === 1 ? 'empleado asignado' : 'empleados asignados'}: quítalos o asígnalos a otro departamento antes de eliminarlo.
            </>
          ) : (
            <>
              Se eliminará <strong>{department.name}</strong> y se retirarán sus responsables. Esta acción no se puede deshacer.
            </>
          )
        }
        confirmLabel="Eliminar"
        tone="danger"
        loading={busy === 'delete'}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(() => departmentService.remove(department.id), {
            busy: 'delete',
            errorTitle: 'No se pudo eliminar el departamento',
            success: ['Departamento eliminado'],
            onSuccess: () => void navigate(paths.company.departments, { replace: true }),
            onError: () => setConfirmDelete(false),
            keepBusy: true,
          })
        }
      />
    </div>
  );
}
