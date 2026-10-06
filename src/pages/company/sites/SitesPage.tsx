import { MapPin, MapPinPlus, Tablet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../../i18n';
import { siteRestore } from '../../../components/shifts/RecordTrash';
import { metersText, sitesLoadError } from '../../../components/shifts/shiftRules';
import { StatusBadge } from '../../../components/StatusBadge';
import { listEmpty, listSubtitle, noMatchEmpty, TrashCells, trashColumns } from '../../../components/trash/TrashParts';
import { ButtonLink } from '../../../components/ui/Button';
import { ListToolbar } from '../../../components/ui/ListControls';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useSearchList } from '../../../hooks/useSearchList';
import { useRestore } from '../../../components/trash/useRestore';
import { paths } from '../../../routes/paths';
import { siteService } from '../../../services/siteService';
import type { WorkSite } from '../../../types';
import { addressLine } from '../../../utils/address';
import { formatCount } from '../../../utils/numbers';

/**
 * Sitios de trabajo: los lugares (con su punto y su radio) donde el personal checa en persona.
 * La fila abre la edición; el estado se cambia ahí mismo. En «Eliminados», cuándo y quién y «Restaurar».
 * Cada sitio dice si pide el código del kiosco al checar (antifraude 2b) y lleva a sus kioscos.
 */
export function SitesPage() {
  const t = useT();
  const navigate = useNavigate();
  const list = useSearchList((query, signal) => siteService.list(query, signal), { errorTitle: sitesLoadError });
  const { restoring, restore } = useRestore();
  const { trash } = list;
  const restoreSite = (site: WorkSite) => void restore(site.id, () => siteService.restore(site.id), () => siteRestore(site), list.retry);
  const create = (
    <ButtonLink to={paths.company.newSite} variant="primary" icon={<MapPinPlus size={18} />}>
      {t('sites.list.new')}
    </ButtonLink>
  );
  const columns = {
    address: t('sites.list.columns.address'),
    radius: t('sites.list.columns.radius'),
    employees: t('sites.list.columns.employees'),
    code: t('sites.list.columns.code'),
    status: t('common.fields.status'),
  };

  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('sites.list.title')} subtitle={listSubtitle(list, (count) => t('sites.list.subtitle', { count }))} actions={create} />
        <PanelSection>
          <ListToolbar search={list.search} onSearch={list.setSearch} placeholder={t('sites.list.searchPlaceholder')} label={t('sites.list.searchLabel')} filter={list.filter} onFilter={list.setFilter} trash />
          <ListResults
            list={list}
            pager={{ noun: { one: t('sites.list.noun.one'), other: t('sites.list.noun.other') } }}
            columns={trash ? [t('sites.list.columns.site'), columns.address, ...trashColumns()] : [t('sites.list.columns.site'), columns.address, columns.radius, columns.employees, columns.code, columns.status]}
            onOpen={trash ? undefined : (site) => void navigate(paths.company.editSite(site.id))}
            empty={listEmpty(list, {
              noMatch: noMatchEmpty(t('sites.list.noMatch.title'), t('sites.list.noMatch.description')),
              empty: { icon: <MapPin />, title: t('sites.list.empty.title'), description: t('sites.list.empty.description'), action: create },
            })}
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
                <td data-label={columns.address} className="table__wide">
                  <span className="truncate">{addressLine(site.address)}</span>
                </td>
                {trash ? (
                  <TrashCells record={site} name={site.name} busy={restoring === site.id} disabled={restoring !== null} onRestore={() => restoreSite(site)} />
                ) : (
                  <>
                    <td data-label={columns.radius}>{metersText(site.radius_m)}</td>
                    <td data-label={columns.employees}>
                      <span className="badge badge--info badge--plain">{formatCount(site.employees)}</span>
                    </td>
                    <td data-label={columns.code}>
                      <span className="site-code">
                        <span className={`badge ${site.presence_code ? 'badge--success' : 'badge--muted'}`}>{t(site.presence_code ? 'sites.presence.on' : 'sites.presence.off')}</span>
                        {/* Lleva a los kioscos sin abrir la edición (la fila completa abre la edición). */}
                        <ButtonLink
                          to={paths.company.siteKiosks(site.id)}
                          size="sm"
                          variant="ghost"
                          icon={<Tablet size={16} />}
                          aria-label={t('sites.list.kiosksOf', { name: site.name, count: site.kiosks })}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {formatCount(site.kiosks)}
                        </ButtonLink>
                      </span>
                    </td>
                    <td data-label={columns.status}>
                      <StatusBadge active={site.active} />
                    </td>
                  </>
                )}
              </>
            )}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
