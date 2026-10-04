import { SearchX, Users } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { FaceStatusBadge, StatusBadge } from '../../components/StatusBadge';
import { ListToolbar } from '../../components/ui/ListControls';
import { ListResults } from '../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { RetryState } from '../../components/ui/RetryState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useResource } from '../../hooks/useResource';
import { useSearchList } from '../../hooks/useSearchList';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { CompanyDetail } from '../../types';
import { initials } from '../../utils/format';
import { formatPhone } from '../../utils/phone';

/**
 * Empleados de una empresa vistos por el ADMIN de la plataforma (/admin/companies/:id/employees):
 * paginados, con búsqueda y filtro, y de solo lectura. El backend envía solo su ficha de trabajo
 * (sin datos fiscales ni biometría): el ADMIN da soporte, no administra al personal de la empresa.
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
            columns={['Empleado', 'Correo', 'Teléfono', 'Departamento', 'Registro facial', 'Estado']}
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
