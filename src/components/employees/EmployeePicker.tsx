import { CheckCheck, Network, SearchX, UserRoundCheck, Users, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useAction } from '../../hooks/useAction';
import { useFeedback } from '../../hooks/useFeedback';
import { useResource } from '../../hooks/useResource';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { departmentService } from '../../services/departmentService';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import type { ConfirmDetail } from '../../types/confirm';
import { namesSummary } from '../../utils/changes';
import { formatCount } from '../../utils/numbers';
import { FieldMessage } from '../FormField';
import { StatusBadge } from '../StatusBadge';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { ListToolbar } from '../ui/ListControls';
import { PagedItems } from '../ui/PagedItems';
import { Select } from '../ui/Select';

/** Departamentos que se ofrecen en el filtro (la página más grande de la API). */
const DEPARTMENT_OPTIONS_LIMIT = 50;
const ALL_DEPARTMENTS = 'all';

export interface EmployeePickerProps {
  /** Ids elegidos (los conserva la pantalla: sobreviven a cambiar de página o de filtro). */
  value: number[];
  /**
   * Los elegidos y los nombres que se conocen de ellos (los de las páginas vistas; los de
   * "Seleccionar los N" llegan solo con su id): la confirmación dice a quiénes afecta.
   */
  onChange: (ids: number[], names: string[]) => void;
  /** Una sola persona (p. ej. un día laborable especial): elegir otra reemplaza la anterior. */
  single?: boolean;
  disabled?: boolean;
  /** Error del campo (p. ej. "Elige al menos un empleado" o el del servidor). */
  error?: string;
  /** Qué se hará con los elegidos (bajo la lista). */
  hint?: string;
  /** Nombre accesible del grupo de casillas. */
  label?: string;
}

/**
 * A quiénes afecta una acción con los elegidos, para su confirmación: hasta 8 nombres y "y N más".
 * Se llama al armar la confirmación (sigue al idioma activo).
 */
export const describeEmployees = (total: number, names: readonly string[]): ConfirmDetail => ({
  label: t('employees.picker.affected', { count: total }),
  value: namesSummary(names, total, (count) => t('employees.count', { count })),
});

const departmentsError = () => t('departments.list.loadError');
const employeesError = () => t('employees.list.loadError');
const selectError = () => t('employees.picker.selectError');

/** El filtro tiene más empleados de los que admite una operación: se eligieron los primeros. */
const limitWarning = (total: number, limit: number, chosen: number) =>
  [
    () => t('employees.picker.limit.title'),
    () => t('employees.picker.limit.text', { total: formatCount(total), limit: formatCount(limit), chosen: formatCount(chosen) }),
  ] as const;

/**
 * Elegir uno o varios empleados de la empresa: búsqueda, filtro por estado y por departamento, lista
 * paginada en el servidor con una casilla por fila, "Seleccionar los N de este filtro" (el servidor
 * da los ids del filtro, hasta el tope de una operación masiva) y cuántos van elegidos. Lo usan
 * asignar un turno a varios y registrar una ausencia (vacaciones colectivas).
 */
export function EmployeePicker({ value, onChange, single = false, disabled = false, error, hint, label }: EmployeePickerProps) {
  const t = useT();
  const id = useId();
  const feedback = useFeedback();
  const [department, setDepartment] = useState(ALL_DEPARTMENTS);
  const departmentId = department === ALL_DEPARTMENTS ? undefined : Number(department);
  const departments = useResource((signal) => departmentService.list({ page: 1, size: DEPARTMENT_OPTIONS_LIMIT }, signal), 'departments', departmentsError);
  const list = useSearchList((query, signal) => employeeService.list({ ...query, department_id: departmentId }, signal), {
    errorTitle: employeesError,
    filterKey: department,
  });
  const { busy, run } = useAction();
  const selected = new Set(value);
  const filtered = list.filtered || departmentId !== undefined;
  // Nombres de los empleados que se han visto en la lista (por id), para decir a quiénes se eligió.
  const known = useRef(new Map<number, string>());
  useEffect(() => list.data?.items.forEach((employee) => known.current.set(employee.id, employee.full_name)), [list.data]);
  const emit = (ids: number[]) => onChange(ids, ids.flatMap((id) => known.current.get(id) ?? []));

  const toggle = (employee: Employee, checked: boolean) => {
    if (single) emit(checked ? [employee.id] : []);
    else emit(checked ? [...value, employee.id] : value.filter((id) => id !== employee.id));
  };

  const selectFilter = () =>
    run(
      () => employeeService.ids({ search: list.appliedSearch || undefined, active: list.filter === 'all' ? undefined : list.filter === 'active', department_id: departmentId }),
      {
        errorTitle: selectError,
        onSuccess: (result) => {
          emit([...new Set([...value, ...result.ids])]);
          if (result.total > result.ids.length) void feedback.warning(...limitWarning(result.total, result.limit, result.ids.length));
        },
      },
    );

  const departmentOptions = [
    { value: ALL_DEPARTMENTS, label: t('employees.picker.allDepartments') },
    ...(departments.data?.items ?? []).map((item) => ({ value: String(item.id), label: item.name })),
  ];
  const total = list.data?.total ?? 0;

  return (
    <div className={`employee-picker ${error ? 'employee-picker--error' : ''}`} role="group" aria-label={label ?? t('employees.picker.label')}>
      <ListToolbar search={list.search} onSearch={list.setSearch} placeholder={t('employees.picker.searchPlaceholder')} label={t('employees.list.searchLabel')} filter={list.filter} onFilter={list.setFilter} />
      {departmentOptions.length > 1 && (
        <Select value={department} onChange={setDepartment} options={departmentOptions} icon={<Network size={18} />} aria-label={t('employees.picker.departmentFilter')} searchable className="employee-picker__department" />
      )}
      <div className="employee-picker__bar">
        <span className={`badge ${value.length ? 'badge--info' : 'badge--muted'} badge--plain`} aria-live="polite">
          <UserRoundCheck size={14} aria-hidden /> {value.length ? t('employees.picker.chosen', { count: value.length }) : t('employees.picker.nobody')}
        </span>
        <span className="employee-picker__actions">
          {!single && total > 0 && (
            <Button size="sm" variant="secondary" icon={<CheckCheck size={16} />} loading={busy !== null} disabled={disabled} onClick={() => void selectFilter()}>
              {t(filtered ? 'employees.picker.selectFiltered' : 'employees.picker.selectAll', { count: total })}
            </Button>
          )}
          {value.length > 0 && (
            <Button size="sm" variant="ghost" icon={<X size={16} />} disabled={disabled} onClick={() => emit([])}>
              {t('employees.picker.clear')}
            </Button>
          )}
        </span>
      </div>
      <PagedItems
        list={list}
        pager={{ noun: { one: t('employees.noun.one'), other: t('employees.noun.other') } }}
        empty={
          filtered
            ? { icon: <SearchX />, title: t('employees.list.noMatch.title'), description: t('employees.picker.noMatch'), compact: true }
            : { icon: <Users />, title: t('employees.list.empty.title'), description: t('employees.picker.empty'), compact: true }
        }
      >
        {(items) => (
          <div className={`employee-picker__list ${list.loading ? 'is-loading' : ''}`}>
            {items.map((employee) => (
              <Checkbox
                key={employee.id}
                checked={selected.has(employee.id)}
                onChange={(checked) => toggle(employee, checked)}
                disabled={disabled}
                label={employee.full_name}
                icon={<Avatar name={employee.full_name} src={employee.avatar} size="sm" decorative />}
                description={[t('employees.number', { number: employee.employee_number }), employee.department_name].filter(Boolean).join(' · ')}
                aside={employee.active ? undefined : <StatusBadge active={false} />}
              />
            ))}
          </div>
        )}
      </PagedItems>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}
