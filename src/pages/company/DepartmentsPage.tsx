import { Network, Plus, SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ButtonLink } from '../../components/ui/Button';
import { ListToolbar } from '../../components/ui/ListControls';
import { ListResults } from '../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useSearchList } from '../../hooks/useSearchList';
import { paths } from '../../routes/paths';
import { departmentService } from '../../services/departmentService';
import type { DepartmentPerson } from '../../types';

/** "Ana Ruiz, Luis Paz +2": los primeros responsables y cuántos más hay. */
function managersLine(managers: DepartmentPerson[]) {
  if (managers.length === 0) return <span className="muted">Sin responsable</span>;
  const shown = managers.slice(0, 2).map((m) => m.full_name).join(', ');
  return managers.length > 2 ? `${shown} +${managers.length - 2}` : shown;
}

/** Departamentos de la empresa: sus responsables y cuántos empleados tiene cada uno. */
export function DepartmentsPage() {
  const navigate = useNavigate();
  const list = useSearchList((query, signal) => departmentService.list({ page: query.page, size: query.size, search: query.search }, signal), {
    errorTitle: 'No se pudieron cargar los departamentos',
  });
  const create = (
    <ButtonLink to={paths.company.newDepartment} variant="primary" icon={<Plus size={18} />}>
      Nuevo departamento
    </ButtonLink>
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Departamentos"
          subtitle={list.data ? `${list.total} ${list.total === 1 ? 'departamento' : 'departamentos'} · responsables y empleados de cada área` : 'Cargando...'}
          actions={create}
        />
        <PanelSection>
          <ListToolbar search={list.search} onSearch={list.setSearch} placeholder="Buscar por nombre" label="Buscar departamentos" />
          <ListResults
            list={list}
            pager={{ noun: { one: 'departamento', other: 'departamentos' } }}
            columns={['Departamento', 'Responsables', 'Empleados']}
            onOpen={(department) => void navigate(paths.company.department(department.id))}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: 'Ningún departamento coincide con la búsqueda', description: 'Prueba con otra parte del nombre.' }
                : {
                    icon: <Network />,
                    title: 'Aún no hay departamentos',
                    description: 'Organiza a tu personal por áreas (Producción, Almacén, Recursos Humanos…) con sus responsables.',
                    action: create,
                  }
            }
            renderCells={(department) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <span className="icon-tile">
                      <Network size={18} />
                    </span>
                    <span className="person__info">
                      <strong className="truncate">{department.name}</strong>
                      {department.description && <small className="truncate">{department.description}</small>}
                    </span>
                  </span>
                </td>
                <td data-label="Responsables" className="table__wide">
                  <span className="truncate">{managersLine(department.managers)}</span>
                </td>
                <td data-label="Empleados">
                  <span className="badge badge--info badge--plain">{department.employee_count}</span>
                </td>
              </>
            )}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
