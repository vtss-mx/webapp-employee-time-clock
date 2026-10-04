import { Eraser, SearchX, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { FaceStatusBadge, StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/Button';
import { ListToolbar } from '../../components/ui/ListControls';
import { ListResults } from '../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useAction } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { useSearchList } from '../../hooks/useSearchList';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { CompanyDetail, CompanyEmployee } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { initials, timeAgo } from '../../utils/format';
import { formatPhone } from '../../utils/phone';

/**
 * Empleados de una empresa vistos por el ADMIN de la plataforma (/admin/companies/:id/employees):
 * paginados, con búsqueda y filtro. Su ficha de trabajo es de solo lectura (sin datos fiscales ni
 * biometría): el ADMIN da soporte, no administra al personal de la empresa. Lo único que administra
 * aquí es el aprendizaje del reconocimiento facial (la empresa no lo ve): cuánto aprendió de cada uno
 * y "Olvidar lo aprendido".
 */
export function CompanyEmployeesPage() {
  const companyId = Number(useParams().id);
  // Primero la empresa (su nombre da contexto); la lista se pide después: si el servidor no
  // responde, la persona ve un solo aviso y no dos.
  const { data: company, error, retry } = useResource((signal) => adminService.get(companyId, signal), companyId, 'No se pudo cargar la empresa');

  if (!company) return error ? <RetryState onRetry={retry} /> : <SkeletonCard lines={6} />;
  return <CompanyEmployees company={company} />;
}

function CompanyEmployees({ company }: { company: CompanyDetail }) {
  const list = useSearchList((query, signal) => adminService.employees(company.id, query, signal), {
    errorTitle: 'No se pudieron cargar los empleados',
    filterKey: String(company.id),
  });
  const { data } = list;
  const action = useAction<number>();
  // Se confirma antes de borrar: cancelar no envía nada.
  const forget = (employee: CompanyEmployee) =>
    void action.run(() => adminService.forgetLearnedFace(company.id, employee.id), {
      busy: employee.id,
      confirm: forgetConfirm(employee),
      errorTitle: 'No se pudo olvidar lo aprendido',
      success: ['Aprendizaje reiniciado', 'Se compara solo con su registro aprobado; volverá a aprender de sus identificaciones seguras.'],
      // El backend devuelve su ficha ya sin lo aprendido: se reemplaza en la página sin volver a pedirla.
      onSuccess: (updated) => list.updateItems((items) => items.map((item) => (item.id === updated.id ? updated : item))),
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={`Empleados de ${company.name}`}
          subtitle={data ? `${data.total} registrados · solo consulta` : 'Cargando...'}
          backTo={paths.admin.company(company.id)}
          backLabel={company.name}
        />
        <PanelSection>
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder="Buscar por nombre, número o correo"
            label="Buscar empleados"
            filter={list.filter}
            onFilter={list.setFilter}
          />

          <ListResults
            list={list}
            pager={{ noun: { one: 'empleado', other: 'empleados' } }}
            columns={['Empleado', 'Correo', 'Teléfono', 'Departamento', 'Registro facial', 'Aprendizaje', 'Estado']}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: 'Ningún empleado coincide con la búsqueda', description: 'Prueba con otro nombre, número de empleado o correo, o cambia el filtro de estado.' }
                : { icon: <Users />, title: 'La empresa aún no registra empleados', description: 'Aquí aparecerá su personal en cuanto su administrador lo dé de alta.' }
            }
            renderCells={(emp) => {
              const name = `${emp.first_name} ${emp.last_name}`;
              return (
                <>
                  <td className="table__primary">
                    <span className="person">
                      <span className="avatar">{initials(name)}</span>
                      <span className="person__info">
                        <strong className="truncate">{name}</strong>
                        <small>{emp.employee_number}</small>
                      </span>
                    </span>
                  </td>
                  <td data-label="Correo" className="table__wide">
                    <span className="truncate">{emp.email}</span>
                  </td>
                  <td data-label="Teléfono">{emp.phone ? formatPhone(emp.phone) : <span className="muted">Sin teléfono</span>}</td>
                  <td data-label="Departamento">{emp.department_name ?? <span className="muted">Sin departamento</span>}</td>
                  <td data-label="Registro facial">
                    <FaceStatusBadge status={emp.face_status} />
                  </td>
                  <td data-label="Aprendizaje">
                    <Learned employee={emp} busy={action.busy} onForget={() => forget(emp)} />
                  </td>
                  <td data-label="Estado">
                    <StatusBadge active={emp.active} />
                  </td>
                </>
              );
            }}
          />
        </PanelSection>
      </Panel>

    </div>
  );
}

/** "1 muestra" / "3 muestras". */
const samples = (count: number) => `${count} ${count === 1 ? 'muestra' : 'muestras'}`;

/** Olvidar lo aprendido de un empleado: qué se borra y que no tendrá que registrarse de nuevo. */
function forgetConfirm(employee: CompanyEmployee): ConfirmInput {
  const name = `${employee.first_name} ${employee.last_name}`;
  return {
    kind: 'delete',
    icon: <Eraser size={30} />,
    eyebrow: 'Aprendizaje del reconocimiento',
    title: `¿Olvidar lo aprendido de ${name}?`,
    message:
      'Se borrarán las muestras que el reconocimiento aprendió de sus identificaciones. Volverá a compararse solo con su registro aprobado: no tendrá que registrarse de nuevo. Úsalo si se duda de alguna identificación.',
    detailsTitle: 'Se borrará',
    details: [
      { label: 'Empleado', value: `${name} · ${employee.employee_number}` },
      { label: 'Lo aprendido', value: `${samples(employee.face_learned_samples)} · ${timeAgo(employee.face_last_learned_at)}` },
    ],
    note: 'Lo aprendido no se puede recuperar; volverá a aprender de sus próximas identificaciones seguras.',
    confirmLabel: 'Olvidar lo aprendido',
    confirmIcon: <Eraser size={18} />,
  };
}

interface LearnedProps {
  employee: CompanyEmployee;
  /** Empleado cuyo aprendizaje se está olvidando (su botón muestra el progreso; los demás esperan). */
  busy: number | null;
  onForget: () => void;
}

/** Cuánto aprendió el reconocimiento de sus identificaciones y, si aprendió algo, "Olvidar". */
function Learned({ employee, busy, onForget }: LearnedProps) {
  const learned = employee.face_learned_samples;
  if (learned === 0) return <span className="muted">Sin aprender</span>;
  return (
    <span className="learned-cell">
      <span>
        {samples(learned)}
        <small className="muted"> · {timeAgo(employee.face_last_learned_at)}</small>
      </span>
      <Button variant="ghost" size="sm" icon={<Eraser size={16} />} loading={busy === employee.id} disabled={busy !== null} onClick={onForget}>
        Olvidar
      </Button>
    </span>
  );
}
