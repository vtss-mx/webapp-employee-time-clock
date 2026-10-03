import { Building2, Plus, SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { ButtonLink } from '../../components/ui/Button';
import { ListToolbar } from '../../components/ui/ListControls';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { ListResults } from '../../components/ui/ListResults';
import { useSearchList } from '../../hooks/useSearchList';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import { formatDate } from '../../utils/format';

/** Empresas de la plataforma: búsqueda por nombre, razón social o RFC; uso de su plan. */
export function CompaniesListPage() {
  const navigate = useNavigate();
  const list = useSearchList((query, signal) => adminService.list(query, signal), {
    errorTitle: 'No se pudieron cargar las empresas',
  });
  const { data } = list;
  const open = (id: number) => navigate(paths.admin.company(id));

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Empresas"
          subtitle={data ? `${data.total} registradas en la plataforma` : 'Cargando...'}
          actions={
            <ButtonLink to={paths.admin.newCompany} variant="primary" icon={<Plus size={18} />}>
              Registrar empresa
            </ButtonLink>
          }
        />
        <PanelSection>
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder="Buscar por nombre, razón social o RFC"
            label="Buscar empresas"
            filter={list.filter}
            onFilter={list.setFilter}
            labels={{ active: 'Activas', inactive: 'Inactivas' }}
          />

          <ListResults
            list={list}
            pager={{ noun: { one: 'empresa', other: 'empresas' } }}
            columns={['Empresa', 'Empleados', 'Administradores', 'Alta', 'Estado']}
            onOpen={(c) => open(c.id)}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: 'Ninguna empresa coincide con la búsqueda', description: 'Prueba con otro nombre, razón social o RFC, o cambia el filtro de estado.' }
                : {
                    icon: <Building2 />,
                    title: 'No hay empresas registradas',
                    description: 'Da de alta la primera empresa con su administrador para que empiece a registrar a su personal.',
                    action: (
                      <ButtonLink to={paths.admin.newCompany} variant="primary" icon={<Plus size={18} />}>
                        Registrar la primera
                      </ButtonLink>
                    ),
                  }
            }
            renderCells={(c) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <span className="company-row__logo">{c.name.slice(0, 2).toUpperCase()}</span>
                    <span className="person__info">
                      <strong className="truncate">{c.name}</strong>
                      <small>{c.rfc ?? 'Sin RFC'}</small>
                    </span>
                  </span>
                </td>
                <td data-label="Empleados">
                  {c.employee_count}
                  {c.max_employees ? <span className="muted"> / {c.max_employees}</span> : null}
                </td>
                <td data-label="Administradores">{c.admin_count}</td>
                <td data-label="Alta">{formatDate(c.created_at)}</td>
                <td data-label="Estado">
                  <StatusBadge active={c.active} />
                </td>
              </>
            )}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
