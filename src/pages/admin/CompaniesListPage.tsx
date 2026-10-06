import { Building2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { listEmpty, listSubtitle, noMatchEmpty, TrashCells, trashColumns } from '../../components/trash/TrashParts';
import { useRestore } from '../../components/trash/useRestore';
import { ButtonLink } from '../../components/ui/Button';
import { ListToolbar } from '../../components/ui/ListControls';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { ListResults } from '../../components/ui/ListResults';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { adminService } from '../../services/adminService';
import type { Company } from '../../types';
import { formatDate } from '../../utils/format';
import { formatCount } from '../../utils/numbers';
import { companyRestore, taxIdLine } from './CompanyRecord';

const loadError = () => t('admin.companies.loadError');

/**
 * Empresas de la plataforma: búsqueda por nombre, razón social o identificador fiscal; uso de su plan. En «Eliminadas», cuándo y
 * quién la eliminó y «Restaurar» (sin abrir su ficha desde la fila).
 */
export function CompaniesListPage() {
  const t = useT();
  const catalogs = useCatalogs();
  const navigate = useNavigate();
  const list = useSearchList((query, signal) => adminService.list(query, signal), {
    errorTitle: loadError,
  });
  const { restoring, restore } = useRestore();
  const { trash } = list;
  const open = (id: number) => navigate(paths.admin.company(id));
  const restoreCompany = (company: Company) => void restore(company.id, () => adminService.restore(company.id), () => companyRestore(company, catalogs), list.retry);
  const columns = trash ? [t('common.fields.company'), ...trashColumns()] : [t('common.fields.company'), t('admin.shared.employees'), t('admin.shared.admins'), t('admin.companies.createdAt'), t('common.fields.status')];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('admin.shared.companies')}
          subtitle={listSubtitle(
            list,
            (count) => t('admin.companies.subtitle', { count }),
            (count) => t('admin.trash.count', { count }),
          )}
          actions={
            <ButtonLink to={paths.admin.newCompany} variant="primary" icon={<Plus size={18} />}>
              {t('admin.shared.registerCompany')}
            </ButtonLink>
          }
        />
        <PanelSection>
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder={t('admin.companies.searchPlaceholder')}
            label={t('admin.companies.searchLabel')}
            filter={list.filter}
            onFilter={list.setFilter}
            labels={{ active: t('admin.companies.filterActive'), inactive: t('admin.companies.filterInactive'), deleted: t('admin.companies.filterDeleted') }}
            trash
          />

          <ListResults
            list={list}
            pager={{ noun: { one: t('admin.companies.noun.one'), other: t('admin.companies.noun.other') } }}
            columns={columns}
            onOpen={trash ? undefined : (c) => open(c.id)}
            empty={listEmpty(list, {
              noMatch: noMatchEmpty(t('admin.companies.noMatchTitle'), t('admin.companies.noMatchDescription')),
              empty: {
                icon: <Building2 />,
                title: t('admin.companies.emptyTitle'),
                description: t('admin.companies.emptyDescription'),
                action: (
                  <ButtonLink to={paths.admin.newCompany} variant="primary" icon={<Plus size={18} />}>
                    {t('admin.companies.registerFirst')}
                  </ButtonLink>
                ),
              },
            })}
            renderCells={(c) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <span className="company-row__logo">{c.name.slice(0, 2).toUpperCase()}</span>
                    <span className="person__info">
                      <strong className="truncate">{c.name}</strong>
                      <small>{taxIdLine(c, catalogs)}</small>
                    </span>
                  </span>
                </td>
                {trash ? (
                  <TrashCells record={c} name={c.name} busy={restoring === c.id} disabled={restoring !== null} onRestore={() => restoreCompany(c)} />
                ) : (
                  <>
                    <td data-label={t('admin.shared.employees')}>
                      {formatCount(c.employee_count)}
                      {c.max_employees ? <span className="muted"> / {formatCount(c.max_employees)}</span> : null}
                    </td>
                    <td data-label={t('admin.shared.admins')}>{formatCount(c.admin_count)}</td>
                    <td data-label={t('admin.companies.createdAt')}>{formatDate(c.created_at)}</td>
                    <td data-label={t('common.fields.status')}>
                      <StatusBadge active={c.active} />
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
