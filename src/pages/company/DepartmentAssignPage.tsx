import { ArrowRightLeft, Check, SearchX, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { PersonItem } from '../../components/departments/PersonItem';
import { StatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ListToolbar } from '../../components/ui/ListControls';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';
import type { Department, Employee } from '../../types';
import type { ConfirmInput } from '../../types/confirm';

type Role = 'employees' | 'managers';

/**
 * Antes de asignar o nombrar: a quién y qué cambia. Si el empleado viene de otro departamento lo
 * deja (cada empleado está en uno solo), así que se resalta como un cambio de departamento.
 */
function assignConfirm(role: Role, department: Department, employee: Employee): ConfirmInput {
  const person = { label: t('common.fields.employee'), value: t('departments.person', { name: employee.full_name, number: employee.employee_number }) };
  const names = { name: employee.full_name, department: department.name };
  if (role === 'managers') {
    return {
      icon: <ShieldCheck size={30} />,
      eyebrow: t('departments.assign.managerConfirm.eyebrow'),
      title: t('departments.assign.managerConfirm.title', names),
      message: t('departments.assign.managerConfirm.message'),
      details: [person],
      confirmLabel: t('departments.assign.managers.action'),
      confirmIcon: <UserPlus size={18} />,
    };
  }
  const from = employee.department_name;
  if (from) {
    return {
      tone: 'warning',
      icon: <ArrowRightLeft size={30} />,
      eyebrow: t('departments.assign.moveConfirm.eyebrow'),
      title: t('departments.assign.moveConfirm.title', names),
      message: t('departments.assign.moveConfirm.message', { from }),
      changes: [{ label: t('common.fields.department'), before: from, after: department.name }],
      details: [person],
      confirmLabel: t('departments.assign.employees.move'),
      confirmIcon: <ArrowRightLeft size={18} />,
    };
  }
  return {
    icon: <UserPlus size={30} />,
    eyebrow: t('departments.assign.assignConfirm.eyebrow'),
    title: t('departments.assign.assignConfirm.title', names),
    changes: [{ label: t('common.fields.department'), before: t('departments.noDepartment'), after: department.name }],
    details: [person],
    confirmLabel: t('departments.assign.employees.action'),
    confirmIcon: <UserPlus size={18} />,
  };
}

/** Ícono de cada lista; sus textos están en `departments.assign.<rol>`. */
const ICONS: Record<Role, typeof Users> = { employees: Users, managers: ShieldCheck };

const loadError = () => t('departments.loadError');
const employeesError = () => t('employees.list.loadError');
const assignError = (role: Role) => () => t(`departments.assign.${role}.error`);
/** El aviso al terminar (se arma al dibujarse: sigue al idioma activo). */
const assigned = (role: Role, employee: Employee, department: Department): SuccessNotice => [
  t(`departments.assign.${role}.done`),
  t(`departments.assign.${role}.doneText`, { name: employee.full_name, department: department.name }),
];

/** Elegir empleados (con búsqueda y paginado) para asignarlos al departamento o nombrarlos responsables. */
export function DepartmentAssignPage() {
  const t = useT();
  const params = useParams();
  const departmentId = Number(params.id);
  const role: Role = params.role === 'managers' ? 'managers' : 'employees';
  const { data: department, setData, error, retry } = useResource((signal) => departmentService.get(departmentId, signal), departmentId, loadError);
  const list = useSearchList((query, signal) => employeeService.list(query, signal), { errorTitle: employeesError });
  const { busy, run } = useAction<number>();

  if (!department) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title={t(`departments.assign.${role}.title`)} backTo={paths.company.department(departmentId)} backLabel={t('departments.assign.back')} />
          <PanelSection>
            <RetryState onRetry={retry} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={6} />
    );
  }

  const Icon = ICONS[role];
  const assign = (employee: Employee) =>
    run(() => (role === 'managers' ? departmentService.addManager(department.id, employee.id) : departmentService.assign(department.id, employee.id)), {
      busy: employee.id,
      confirm: () => assignConfirm(role, department, employee),
      errorTitle: assignError(role),
      success: () => assigned(role, employee, department),
      onSuccess: (saved: Department) => {
        setData(saved);
        if (role === 'employees') {
          list.updateItems((items) => items.map((e) => (e.id === employee.id ? { ...e, department_id: saved.id, department_name: saved.name } : e)));
        }
      },
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t(`departments.assign.${role}.title`)} subtitle={department.name} backTo={paths.company.department(department.id)} backLabel={department.name} />
        <PanelSection title={t('departments.assign.section')} icon={<Icon size={20} />}>
          <p className="muted small">{t(`departments.assign.${role}.hint`)}</p>
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder={t('employees.list.searchPlaceholder')}
            label={t('employees.list.searchLabel')}
            filter={list.filter}
            onFilter={list.setFilter}
          />
          <PagedItems
            list={list}
            pager={{ noun: { one: t('employees.noun.one'), other: t('employees.noun.other') } }}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: t('employees.list.noMatch.title'), description: t('departments.assign.noMatch') }
                : { icon: <Users />, title: t('employees.list.empty.title'), description: t('departments.assign.empty') }
            }
          >
            {(items) => (
              <ul className={`people-list stagger ${list.loading ? 'is-loading' : ''}`}>
                {items.map((employee) => (
                  <Candidate key={employee.id} employee={employee} department={department} role={role} busy={busy === employee.id} locked={busy !== null} onAssign={() => void assign(employee)} />
                ))}
              </ul>
            )}
          </PagedItems>
        </PanelSection>
        <PanelFooter>
          <ButtonLink to={paths.company.department(department.id)} variant="primary" size="lg" icon={<Check size={20} />}>
            {t('departments.assign.done')}
          </ButtonLink>
        </PanelFooter>
      </Panel>
    </div>
  );
}

interface CandidateProps {
  employee: Employee;
  department: Department;
  role: Role;
  busy: boolean;
  /** Otra asignación en curso: una a la vez (las respuestas no se pisan entre sí). */
  locked: boolean;
  onAssign: () => void;
}

/** Un empleado en la lista: si ya es parte (o responsable) se indica; si no, el botón para hacerlo. */
function Candidate({ employee, department, role, busy, locked, onAssign }: CandidateProps) {
  const t = useT();
  const here = role === 'managers' ? department.managers.some((m) => m.employee_id === employee.id) : employee.department_id === department.id;
  const elsewhere = role === 'employees' && !here && employee.department_name;
  const detail = elsewhere ? t('departments.assign.elsewhere', { number: employee.employee_number, department: elsewhere }) : t('employees.number', { number: employee.employee_number });
  const label = elsewhere ? t('departments.assign.employees.move') : t(`departments.assign.${role}.action`);
  return (
    <PersonItem
      name={employee.full_name}
      detail={detail}
      badges={employee.active ? null : <StatusBadge active={false} />}
      actions={
        here ? (
          <span className="badge badge--success">
            <Check size={14} /> {t(`departments.assign.${role}.badge`)}
          </span>
        ) : (
          <Button size="sm" variant="secondary" icon={elsewhere ? <ArrowRightLeft size={16} /> : <UserPlus size={16} />} loading={busy} disabled={locked} aria-label={t('departments.assign.actionLabel', { action: label, name: employee.full_name })} onClick={onAssign}>
            {label}
          </Button>
        )
      }
    />
  );
}
