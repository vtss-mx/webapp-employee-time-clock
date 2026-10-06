import { Pencil, ShieldCheck, ShieldOff, Trash2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { DeletedDepartment } from '../../components/departments/DepartmentTrash';
import { PersonItem } from '../../components/departments/PersonItem';
import { LoadFailed } from '../../components/shifts/PageStates';
import { deleteNote } from '../../components/trash/TrashParts';
import { StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { usePagedList } from '../../hooks/usePagedList';
import { useResource } from '../../hooks/useResource';
import { t, Trans, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';
import type { Department, DepartmentPerson, Employee } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { formatCount } from '../../utils/numbers';

/** Busy de cada botón: el responsable o el empleado que se está quitando, o el borrado. */
type Busy = `manager:${number}` | `member:${number}` | 'delete';

/** "Ana Ruiz · No. EMP-7": la persona en una confirmación. */
const personText = (name: string, number: string) => t('departments.person', { name, number });

/** Los responsables en una línea ("Sin responsables" si no hay). */
const managerNames = (managers: DepartmentPerson[]) => managers.map((m) => m.full_name).join(', ') || t('departments.noManagers');

/** Retirar a un responsable: deja de serlo (los demás siguen); su cuenta y su departamento no cambian. */
function removeManagerConfirm(department: Department, manager: DepartmentPerson): ConfirmInput {
  return {
    tone: 'danger',
    icon: <ShieldOff size={30} />,
    eyebrow: t('departments.managers'),
    title: t('departments.detail.removeManagerConfirm.title', { name: manager.full_name, department: department.name }),
    message: t('departments.detail.removeManagerConfirm.message'),
    changes: [
      {
        label: t('departments.managers'),
        before: managerNames(department.managers),
        after: managerNames(department.managers.filter((m) => m.employee_id !== manager.employee_id)),
      },
    ],
    details: [{ label: t('departments.detail.removeManagerConfirm.manager'), value: personText(manager.full_name, manager.employee_number) }],
    confirmLabel: t('departments.detail.removeManagerConfirm.confirm'),
    confirmIcon: <X size={18} />,
  };
}

/** Quitar a un empleado: queda sin departamento hasta que se le asigne otro. */
function removeMemberConfirm(department: Department, employee: Employee): ConfirmInput {
  return {
    tone: 'danger',
    icon: <UserMinus size={30} />,
    eyebrow: t('departments.detail.removeMemberConfirm.eyebrow'),
    title: t('departments.detail.removeMemberConfirm.title', { name: employee.full_name, department: department.name }),
    message: t('departments.detail.removeMemberConfirm.message'),
    changes: [{ label: t('common.fields.department'), before: department.name, after: t('departments.noDepartment') }],
    details: [{ label: t('common.fields.employee'), value: personText(employee.full_name, employee.employee_number) }],
    confirmLabel: t('departments.detail.removeMemberConfirm.confirm'),
    confirmIcon: <UserMinus size={18} />,
  };
}

/** Eliminar el departamento: con empleados asignados el servidor lo impide, y la confirmación ya lo dice. */
function deleteConfirm(department: Department): ConfirmInput {
  const count = department.employee_count;
  const name = <strong>{department.name}</strong>;
  return {
    kind: 'delete',
    title: t('departments.detail.deleteConfirm.title', { name: department.name }),
    message:
      count > 0 ? <Trans k="departments.detail.deleteConfirm.blocked" values={{ name, count }} /> : <Trans k="departments.detail.deleteConfirm.message" values={{ name }} />,
    details: [
      { label: t('departments.managers'), value: managerNames(department.managers) },
      { label: t('departments.detail.deleteConfirm.assigned'), value: formatCount(count) },
    ],
    note: deleteNote(),
    confirmLabel: t('departments.detail.delete'),
  };
}

const loadError = () => t('departments.loadError');
const membersError = () => t('departments.detail.membersError');
const removeManagerError = () => t('departments.detail.removeManagerConfirm.error');
const removeMemberError = () => t('departments.detail.removeMemberConfirm.error');
const deleteError = () => t('departments.detail.deleteConfirm.error');
/** Avisos al terminar: se arman al dibujarse (siguen al idioma activo). */
const managerRemoved = (manager: DepartmentPerson, department: Department): SuccessNotice => [
  t('departments.detail.removeManagerConfirm.done'),
  t('departments.detail.removeManagerConfirm.doneText', { name: manager.full_name, department: department.name }),
];
const memberRemoved = (employee: Employee, department: Department): SuccessNotice => [
  t('departments.detail.removeMemberConfirm.done'),
  t('departments.detail.removeMemberConfirm.doneText', { name: employee.full_name, department: department.name }),
];
const deleted = (): SuccessNotice => [t('departments.detail.deleteConfirm.done')];

/**
 * Detalle de un departamento: sus responsables (empleados de la empresa, pueden ser varios) y sus
 * empleados asignados (paginados). Desde aquí se agregan o quitan y se elimina el departamento. En
 * «Eliminados» solo el aviso con «Restaurar» (sus empleados ya no se piden: el backend responde 404).
 */
export function DepartmentDetailPage() {
  const t = useT();
  const departmentId = Number(useParams().id);
  const { data: department, setData, error, retry } = useResource((signal) => departmentService.get(departmentId, signal), departmentId, loadError);
  if (!department) {
    return error ? <LoadFailed title={t('departments.detail.title')} backTo={paths.company.departments} backLabel={t('departments.back')} onRetry={retry} /> : <SkeletonCard lines={6} />;
  }
  if (department.deleted_at) return <DeletedDepartment department={department} onRestored={setData} />;
  return <DepartmentView department={department} setData={setData} />;
}

/** Un departamento vigente: responsables, empleados asignados y sus acciones (cada una se confirma antes). */
function DepartmentView({ department, setData }: { department: Department; setData: (department: Department) => void }) {
  const t = useT();
  const navigate = useNavigate();
  const members = usePagedList((page, signal) => employeeService.list({ ...page, department_id: department.id }, signal), {
    errorTitle: membersError,
    filterKey: String(department.id),
  });
  const { busy, run } = useAction<Busy>();

  const refreshed = (saved: Department) => setData(saved);
  // Cada acción pregunta antes (cancelar no envía nada) y su botón queda ocupado mientras se procesa.
  const removeManager = (manager: DepartmentPerson) =>
    run(() => departmentService.removeManager(department.id, manager.employee_id), {
      busy: `manager:${manager.employee_id}`,
      confirm: () => removeManagerConfirm(department, manager),
      errorTitle: removeManagerError,
      success: () => managerRemoved(manager, department),
      onSuccess: refreshed,
    });
  const removeMember = (employee: Employee) =>
    run(() => departmentService.unassign(department.id, employee.id), {
      busy: `member:${employee.id}`,
      confirm: () => removeMemberConfirm(department, employee),
      errorTitle: removeMemberError,
      success: () => memberRemoved(employee, department),
      onSuccess: (saved) => {
        refreshed(saved);
        members.retry();
      },
    });
  const remove = () =>
    run(() => departmentService.remove(department.id), {
      busy: 'delete',
      confirm: () => deleteConfirm(department),
      errorTitle: deleteError,
      success: deleted,
      onSuccess: () => void navigate(paths.company.departments, { replace: true }),
      keepBusy: true,
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={department.name}
          subtitle={department.description ?? t('employees.count', { count: department.employee_count })}
          backTo={paths.company.departments}
          backLabel={t('departments.back')}
          actions={
            <ButtonLink to={paths.company.editDepartment(department.id)} variant="primary" icon={<Pencil size={18} />}>
              {t('common.actions.edit')}
            </ButtonLink>
          }
        />

        <PanelSection
          title={t('departments.managers')}
          icon={<ShieldCheck size={20} />}
          aside={
            <ButtonLink to={paths.company.assignDepartment(department.id, 'managers')} variant="secondary" size="sm" icon={<UserPlus size={16} />}>
              {t('departments.detail.addManager')}
            </ButtonLink>
          }
        >
          {department.managers.length === 0 ? (
            <EmptyState compact icon={<ShieldCheck />} title={t('departments.noManagers')} description={t('departments.detail.noManagersDescription')} />
          ) : (
            <ul className="people-list stagger">
              {department.managers.map((manager) => (
                <PersonItem
                  key={manager.employee_id}
                  name={manager.full_name}
                  detail={t('employees.number', { number: manager.employee_number })}
                  badges={manager.active ? null : <StatusBadge active={false} />}
                  actions={
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<X size={16} />}
                      loading={busy === `manager:${manager.employee_id}`}
                      disabled={busy !== null}
                      aria-label={t('departments.detail.removeManagerLabel', { name: manager.full_name })}
                      onClick={() => void removeManager(manager)}
                    >
                      {t('departments.detail.removeManager')}
                    </Button>
                  }
                />
              ))}
            </ul>
          )}
        </PanelSection>

        <PanelSection
          title={t('departments.detail.members', { count: department.employee_count })}
          icon={<Users size={20} />}
          aside={
            <ButtonLink to={paths.company.assignDepartment(department.id, 'employees')} variant="secondary" size="sm" icon={<UserPlus size={16} />}>
              {t('departments.detail.assign')}
            </ButtonLink>
          }
        >
          <PagedItems
            list={members}
            pager={{ noun: { one: t('employees.noun.one'), other: t('employees.noun.other') } }}
            empty={{ compact: true, icon: <Users />, title: t('departments.detail.noMembers.title'), description: t('departments.detail.noMembers.description') }}
          >
            {(items) => (
              <ul className={`people-list stagger ${members.loading ? 'is-loading' : ''}`}>
                {items.map((employee) => (
                  <PersonItem
                    key={employee.id}
                    name={employee.full_name}
                    detail={t('employees.number', { number: employee.employee_number })}
                    badges={<StatusBadge active={employee.active} />}
                    actions={
                      <>
                        <ButtonLink to={paths.company.employee(employee.id)} size="sm" variant="ghost">
                          {t('common.actions.view')}
                        </ButtonLink>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<UserMinus size={16} />}
                          loading={busy === `member:${employee.id}`}
                          disabled={busy !== null}
                          aria-label={t('departments.detail.removeMemberLabel', { name: employee.full_name })}
                          onClick={() => void removeMember(employee)}
                        >
                          {t('departments.detail.removeMember')}
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
            {t('departments.detail.delete')}
          </Button>
        </PanelFooter>
      </Panel>
    </div>
  );
}
