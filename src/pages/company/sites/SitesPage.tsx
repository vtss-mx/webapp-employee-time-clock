import { MapPin, MapPinPlus, SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { metersText } from '../../../components/shifts/shiftRules';
import { StatusBadge } from '../../../components/StatusBadge';
import { ButtonLink } from '../../../components/ui/Button';
import { ListToolbar } from '../../../components/ui/ListControls';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useSearchList } from '../../../hooks/useSearchList';
import { paths } from '../../../routes/paths';
import { siteService } from '../../../services/siteService';
import { addressLine } from '../../../utils/address';

/**
 * Sitios de trabajo: los lugares (con su punto y su radio) donde el personal checa en persona.
 * La fila abre la edición; el estado se cambia ahí mismo.
 */
export function SitesPage() {
  const navigate = useNavigate();
  const list = useSearchList((query, signal) => siteService.list(query, signal), { errorTitle: 'No se pudieron cargar los sitios' });
  const create = (
    <ButtonLink to={paths.company.newSite} variant="primary" icon={<MapPinPlus size={18} />}>
      Nuevo sitio
    </ButtonLink>
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Sitios de trabajo"
          subtitle={list.data ? `${list.total} ${list.total === 1 ? 'sitio' : 'sitios'} · dónde se checa en persona y con qué radio` : 'Cargando...'}
          actions={create}
        />
        <PanelSection>
          <ListToolbar search={list.search} onSearch={list.setSearch} placeholder="Buscar por nombre" label="Buscar sitios" filter={list.filter} onFilter={list.setFilter} />
          <ListResults
            list={list}
            pager={{ noun: { one: 'sitio', other: 'sitios' } }}
            columns={['Sitio', 'Domicilio', 'Radio', 'Empleados hoy', 'Estado']}
            onOpen={(site) => void navigate(paths.company.editSite(site.id))}
            empty={
              list.filtered
                ? { icon: <SearchX />, title: 'Ningún sitio coincide con la búsqueda', description: 'Prueba con otra parte del nombre o cambia el filtro de estado.' }
                : {
                    icon: <MapPin />,
                    title: 'Aún no hay sitios de trabajo',
                    description: 'Da de alta los lugares donde checa tu personal (planta, sucursal, oficina...) con su punto en el mapa y el radio permitido.',
                    action: create,
                  }
            }
            renderCells={(site) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <span className="icon-tile">
                      <MapPin size={18} />
                    </span>
                    <span className="person__info">
                      <strong className="truncate">{site.name}</strong>
                      <small className="truncate">{site.address.city || site.address.municipality}</small>
                    </span>
                  </span>
                </td>
                <td data-label="Domicilio" className="table__wide">
                  <span className="truncate">{addressLine(site.address)}</span>
                </td>
                <td data-label="Radio">{metersText(site.radius_m)}</td>
                <td data-label="Empleados hoy">
                  <span className="badge badge--info badge--plain">{site.employees}</span>
                </td>
                <td data-label="Estado">
                  <StatusBadge active={site.active} />
                </td>
              </>
            )}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
