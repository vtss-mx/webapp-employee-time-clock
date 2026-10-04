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
import { useAction } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { useSearchList } from '../../hooks/useSearchList';
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
  const person = { label: 'Empleado', value: `${employee.full_name} · No. ${employee.employee_number}` };
  if (role === 'managers') {
    return {
      icon: <ShieldCheck size={30} />,
      eyebrow: 'Nuevo responsable',
      title: `¿Nombrar a ${employee.full_name} responsable de ${department.name}?`,
      message: 'Un departamento puede tener varios responsables y una persona puede dirigir varios. Su departamento asignado no cambia.',
      details: [person],
      confirmLabel: 'Nombrar responsable',
      confirmIcon: <UserPlus size={18} />,
    };
  }
  const from = employee.department_name;
  if (from) {
    return {
      tone: 'warning',
      icon: <ArrowRightLeft size={30} />,
      eyebrow: 'Cambiar de departamento',
      title: `¿Cambiar a ${employee.full_name} a ${department.name}?`,
      message: `Dejará ${from}: cada empleado está en un solo departamento.`,
      changes: [{ label: 'Departamento', before: from, after: department.name }],
      details: [person],
      confirmLabel: 'Cambiar aquí',
      confirmIcon: <ArrowRightLeft size={18} />,
    };
  }
  return {
    icon: <UserPlus size={30} />,
    eyebrow: 'Asignar empleado',
    title: `¿Asignar a ${employee.full_name} a ${department.name}?`,
    message: 'Formará parte de este departamento.',
    changes: [{ label: 'Departamento', before: 'Sin departamento', after: department.name }],
    details: [person],
    confirmLabel: 'Asignar',
    confirmIcon: <UserPlus size={18} />,
  };
}

const COPY: Record<Role, { title: string; hint: string; icon: typeof Users }> = {
  employees: {
    title: 'Asignar empleados',
    hint: 'Cada empleado está en un solo departamento: si ya está en otro, al asignarlo aquí se cambia a este.',
    icon: Users,
  },
  managers: {
    title: 'Agregar responsables',
    hint: 'Los responsables son empleados de tu empresa. Un departamento puede tener varios y una persona puede dirigir varios.',
    icon: ShieldCheck,
  },
};

/** Elegir empleados (con búsqueda y paginado) para asignarlos al departamento o nombrarlos responsables. */
export function DepartmentAssignPage() {
  const params = useParams();
  const departmentId = Number(params.id);
  const role: Role = params.role === 'managers' ? 'managers' : 'employees';
  const { data: department, setData, error, retry } = useResource((signal) => departmentService.get(departmentId, signal), departmentId, 'No se pudo cargar el departamento');
  const list = useSearchList((query, signal) => employeeService.list(query, signal), { errorTitle: 'No se pudieron cargar los empleados' });
  const { busy, run } = useAction<number>();

  if (!department) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title={COPY[role].title} backTo={paths.company.department(departmentId)} backLabel="Departamento" />
          <PanelSection>
            <RetryState onRetry={retry} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={6} />
    );
  }

  const copy = COPY[role];
  const assign = (employee: Employee) =>
    run(() => (role === 'managers' ? departmentService.addManager(department.id, employee.id) : departmentService.assign(department.id, employee.id)), {
      busy: employee.id,
      confirm: assignConfirm(role, department, employee),
      errorTitle: role === 'managers' ? 'No se pudo agregar al responsable' : 'No se pudo asignar al empleado',
      success: role === 'managers' ? ['Responsable agregado', `${employee.full_name} ahora es responsable de ${department.name}.`] : ['Empleado asignado', `${employee.full_name} ahora está en ${department.name}.`],
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
        <PanelHeader title={copy.title} subtitle={department.name} backTo={paths.company.department(department.id)} backLabel={department.name} />
        <PanelSection title="Empleados de tu empresa" icon={<copy.icon size={20} />}>
          <p className="muted small">{copy.hint}</p>
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder="Buscar por nombre, número, RFC o correo"
            label="Buscar empleados"
            filter={list.filter}
            onFilter={list.setFilter}
          />
          <PagedItems
            list={list}
            pager={{ noun: { one: 'empleado', other: 'empleados' } }}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: 'Ningún empleado coincide con la búsqueda', description: 'Prueba con otro nombre, número de empleado, RFC o correo.' }
                : { icon: <Users />, title: 'No hay empleados registrados', description: 'Registra a tu personal en Empleados para asignarlo a sus departamentos.' }
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
            Listo
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
  const here = role === 'managers' ? department.managers.some((m) => m.employee_id === employee.id) : employee.department_id === department.id;
  const elsewhere = role === 'employees' && !here && employee.department_name;
  const detail = elsewhere ? `No. ${employee.employee_number} · En ${employee.department_name}` : `No. ${employee.employee_number}`;
  const label = role === 'managers' ? 'Nombrar responsable' : elsewhere ? 'Cambiar aquí' : 'Asignar';
  return (
    <PersonItem
      name={employee.full_name}
      detail={detail}
      badges={employee.active ? null : <StatusBadge active={false} />}
      actions={
        here ? (
          <span className="badge badge--success">
            <Check size={14} /> {role === 'managers' ? 'Responsable' : 'Asignado'}
          </span>
        ) : (
          <Button size="sm" variant="secondary" icon={elsewhere ? <ArrowRightLeft size={16} /> : <UserPlus size={16} />} loading={busy} disabled={locked} aria-label={`${label}: ${employee.full_name}`} onClick={onAssign}>
            {label}
          </Button>
        )
      }
    />
  );
}
