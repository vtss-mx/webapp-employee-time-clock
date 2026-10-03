import { SearchX, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useSearchList } from '../../hooks/useSearchList';
import { ListToolbar } from '../../components/ui/ListControls';
import { FaceStatusBadge, StatusBadge } from '../../components/StatusBadge';
import { ButtonLink } from '../../components/ui/Button';
import { ListResults } from '../../components/ui/ListResults';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import { initials } from '../../utils/format';

export function EmployeesListPage() {
  const navigate = useNavigate();
  const list = useSearchList((query, signal) => employeeService.list(query, signal), {
    errorTitle: 'No se pudieron cargar los empleados',
  });
  const { data } = list;
  const open = (id: number) => navigate(paths.company.employee(id));

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Empleados"
          subtitle={data ? `${data.total} registrados` : 'Cargando...'}
          actions={
            <ButtonLink to={paths.company.newEmployee} variant="primary" icon={<UserPlus size={18} />}>
              Registrar empleado
            </ButtonLink>
          }
        />
        <PanelSection>
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder="Buscar por nombre, número, RFC o correo"
            label="Buscar empleados"
            filter={list.filter}
            onFilter={list.setFilter}
          />

          <ListResults
            list={list}
            pager={{ noun: { one: 'empleado', other: 'empleados' } }}
            columns={['Empleado', 'Correo', 'Registro facial', 'Estado']}
            onOpen={(emp) => open(emp.id)}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: 'Ningún empleado coincide con la búsqueda', description: 'Prueba con otro nombre, número de empleado, RFC o correo, o cambia el filtro de estado.' }
                : {
                    icon: <Users />,
                    title: 'No hay empleados registrados',
                    description: 'Registra a tu personal para que pueda identificarse con su rostro o su código QR.',
                    action: (
                      <ButtonLink to={paths.company.newEmployee} variant="primary" icon={<UserPlus size={18} />}>
                        Registrar el primero
                      </ButtonLink>
                    ),
                  }
            }
            renderCells={(emp) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <span className="avatar">{initials(emp.full_name)}</span>
                    <span className="person__info">
                      <strong className="truncate">{emp.full_name}</strong>
                      <small>{emp.employee_number}</small>
                    </span>
                  </span>
                </td>
                <td data-label="Correo" className="table__wide">
                  <span className="truncate">{emp.email}</span>
                </td>
                <td data-label="Registro facial">
                  <FaceStatusBadge status={emp.face_status} />
                </td>
                <td data-label="Estado">
                  <StatusBadge active={emp.active} />
                </td>
              </>
            )}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
