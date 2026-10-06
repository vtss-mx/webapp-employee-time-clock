import { Network, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { departmentRestore } from '../../components/departments/DepartmentTrash';
import { listEmpty, listSubtitle, noMatchEmpty, TrashCells, trashColumns } from '../../components/trash/TrashParts';
import { useRestore } from '../../components/trash/useRestore';
import { ButtonLink } from '../../components/ui/Button';
import { ListToolbar } from '../../components/ui/ListControls';
import { ListResults } from '../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { departmentService } from '../../services/departmentService';
import type { Department, DepartmentPerson } from '../../types';

/** "Ana Ruiz, Luis Paz +2": los primeros responsables y cuántos más hay. */
function managersLine(managers: DepartmentPerson[]) {
  if (managers.length === 0) return <span className="muted">{t('departments.noManager')}</span>;
  const shown = managers.slice(0, 2).map((m) => m.full_name).join(', ');
  return managers.length > 2 ? `${shown} +${managers.length - 2}` : shown;
}

const loadError = () => t('departments.list.loadError');

/**
 * Departamentos de la empresa: sus responsables y cuántos empleados tiene cada uno. Sin estados: el filtro es
 * «Todos» o «Eliminados» (cuándo y quién lo eliminó, y «Restaurar»).
 */
export function DepartmentsPage() {
  const t = useT();
  const navigate = useNavigate();
  const list = useSearchList((query, signal) => departmentService.list({ page: query.page, size: query.size, search: query.search, deleted: query.deleted }, signal), {
    errorTitle: loadError,
  });
  const { restoring, restore } = useRestore();
  const { trash } = list;
  const restoreDepartment = (department: Department) =>
    void restore(department.id, () => departmentService.restore(department.id), () => departmentRestore(department), list.retry);
  const create = (
    <ButtonLink to={paths.company.newDepartment} variant="primary" icon={<Plus size={18} />}>
      {t('departments.list.create')}
    </ButtonLink>
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('departments.list.title')}
          subtitle={listSubtitle(list, (count) => t('departments.list.subtitle', { count }))}
          actions={create}
        />
        <PanelSection>
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder={t('departments.list.searchPlaceholder')}
            label={t('departments.list.searchLabel')}
            filter={list.filter}
            onFilter={list.setFilter}
            trash
            statuses={false}
          />
          <ListResults
            list={list}
            pager={{ noun: { one: t('departments.noun.one'), other: t('departments.noun.other') } }}
            columns={trash ? [t('common.fields.department'), ...trashColumns()] : [t('common.fields.department'), t('departments.managers'), t('departments.list.employees')]}
            onOpen={trash ? undefined : (department) => void navigate(paths.company.department(department.id))}
            empty={listEmpty(list, {
              noMatch: noMatchEmpty(t('departments.list.noMatch.title'), t('departments.list.noMatch.description')),
              empty: { icon: <Network />, title: t('departments.list.empty.title'), description: t('departments.list.empty.description'), action: create },
            })}
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
                {trash ? (
                  <TrashCells record={department} name={department.name} busy={restoring === department.id} disabled={restoring !== null} onRestore={() => restoreDepartment(department)} />
                ) : (
                  <>
                    <td data-label={t('departments.managers')} className="table__wide">
                      <span className="truncate">{managersLine(department.managers)}</span>
                    </td>
                    <td data-label={t('departments.list.employees')}>
                      <span className="badge badge--info badge--plain">{department.employee_count}</span>
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
