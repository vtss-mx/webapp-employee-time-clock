import { RotateCcw, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { employeeRestore } from '../../components/employees/EmployeeTrash';
import { listEmpty, listSubtitle, noMatchEmpty, TrashCells, trashColumns } from '../../components/trash/TrashParts';
import { useRestore } from '../../components/trash/useRestore';
import { Panel, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useSearchList } from '../../hooks/useSearchList';
import { ListToolbar } from '../../components/ui/ListControls';
import { FaceStatusBadge, StatusBadge } from '../../components/StatusBadge';
import { Avatar } from '../../components/ui/Avatar';
import { ButtonLink } from '../../components/ui/Button';
import { ListResults } from '../../components/ui/ListResults';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';

const loadError = () => t('employees.list.loadError');

/**
 * Empleados de la empresa: búsqueda, estado y «Eliminados» (se restauran durante 1 año). Una fila vigente abre
 * su expediente; una eliminada solo dice cuándo y quién la eliminó y ofrece «Restaurar».
 */
export function EmployeesListPage() {
  const t = useT();
  const navigate = useNavigate();
  const list = useSearchList((query, signal) => employeeService.list(query, signal), {
    errorTitle: loadError,
  });
  const { restoring, restore } = useRestore();
  const { data, trash } = list;
  const open = (id: number) => navigate(paths.company.employee(id));
  const restoreEmployee = (employee: Employee) => void restore(employee.id, () => employeeService.restore(employee.id), () => employeeRestore(employee), list.retry);
  const columns = trash
    ? [t('common.fields.employee'), t('employees.email'), ...trashColumns()]
    : [t('common.fields.employee'), t('employees.email'), t('common.fields.department'), t('employees.list.face'), t('common.fields.status')];

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('employees.list.title')}
          subtitle={listSubtitle(list, (count) => t('employees.list.registered', { count }))}
          actions={
            <>
              {data && data.total > 0 && !trash && (
                <ButtonLink to={paths.company.reverifyAll} variant="ghost" icon={<RotateCcw size={18} />}>
                  {t('employees.list.reverifyAll')}
                </ButtonLink>
              )}
              <ButtonLink to={paths.company.newEmployee} variant="primary" icon={<UserPlus size={18} />}>
                {t('employees.create.title')}
              </ButtonLink>
            </>
          }
        />
        <PanelSection>
          <ListToolbar
            search={list.search}
            onSearch={list.setSearch}
            placeholder={t('employees.list.searchPlaceholder')}
            label={t('employees.list.searchLabel')}
            filter={list.filter}
            onFilter={list.setFilter}
            trash
          />

          <ListResults
            list={list}
            pager={{ noun: { one: t('employees.noun.one'), other: t('employees.noun.other') } }}
            columns={columns}
            onOpen={trash ? undefined : (emp) => open(emp.id)}
            empty={listEmpty(list, {
              noMatch: noMatchEmpty(t('employees.list.noMatch.title'), t('employees.list.noMatch.description')),
              empty: {
                icon: <Users />,
                title: t('employees.list.empty.title'),
                description: t('employees.list.empty.description'),
                action: (
                  <ButtonLink to={paths.company.newEmployee} variant="primary" icon={<UserPlus size={18} />}>
                    {t('employees.list.empty.action')}
                  </ButtonLink>
                ),
              },
            })}
            renderCells={(emp) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <Avatar name={emp.full_name} src={emp.avatar} decorative />
                    <span className="person__info">
                      <strong className="truncate">{emp.full_name}</strong>
                      <small>{emp.employee_number}</small>
                    </span>
                  </span>
                </td>
                <td data-label={t('employees.email')} className="table__wide">
                  <span className="truncate">{emp.email}</span>
                </td>
                {trash ? (
                  <TrashCells record={emp} name={emp.full_name} busy={restoring === emp.id} disabled={restoring !== null} onRestore={() => restoreEmployee(emp)} />
                ) : (
                  <>
                    <td data-label={t('common.fields.department')}>{emp.department_name ?? <span className="muted">{t('departments.noDepartment')}</span>}</td>
                    <td data-label={t('employees.list.face')}>
                      <FaceStatusBadge status={emp.face_status} />
                    </td>
                    <td data-label={t('common.fields.status')}>
                      <StatusBadge active={emp.active} />
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
