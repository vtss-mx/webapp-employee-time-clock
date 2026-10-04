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

type Role = 'employees' | 'managers';

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
