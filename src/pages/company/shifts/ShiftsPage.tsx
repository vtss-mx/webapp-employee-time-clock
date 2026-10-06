import { CalendarClock, Inbox, Moon, Plus, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { shiftRestore } from '../../../components/shifts/RecordTrash';
import { breaksText, placeText, shiftsLoadError } from '../../../components/shifts/shiftRules';
import { StatusBadge } from '../../../components/StatusBadge';
import { listEmpty, listSubtitle, noMatchEmpty, TrashCells, trashColumns } from '../../../components/trash/TrashParts';
import { useRestore } from '../../../components/trash/useRestore';
import { ButtonLink } from '../../../components/ui/Button';
import { ListToolbar } from '../../../components/ui/ListControls';
import { ListResults } from '../../../components/ui/ListResults';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useSearchList } from '../../../hooks/useSearchList';
import { useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import type { Shift } from '../../../types';
import { formatMinutes } from '../../../utils/format';
import { formatCount } from '../../../utils/numbers';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';

/**
 * Turnos de la empresa: horario, días, dónde se checa (sitios y días remotos), descansos, tolerancia
 * y cuántos empleados lo tienen hoy.
 * Desde aquí se crean, se editan (la fila abre la edición), se asigna uno a varios empleados a la vez
 * y se llega a las solicitudes de cambio. En «Eliminados», cuándo y quién y «Restaurar».
 */
export function ShiftsPage() {
  const t = useT();
  const navigate = useNavigate();
  const list = useSearchList((query, signal) => shiftService.list(query, signal), { errorTitle: shiftsLoadError });
  const { restoring, restore } = useRestore();
  const { trash } = list;
  const restoreShift = (shift: Shift) => void restore(shift.id, () => shiftService.restore(shift.id), () => shiftRestore(shift), list.retry);
  const create = (
    <ButtonLink to={paths.company.newShift} variant="primary" icon={<Plus size={18} />}>
      {t('shifts.list.new')}
    </ButtonLink>
  );

  const columns = {
    shift: t('shifts.list.columns.shift'),
    days: t('shifts.list.columns.days'),
    place: t('shifts.list.columns.place'),
    breaks: t('shifts.list.columns.breaks'),
    tolerance: t('shifts.list.columns.tolerance'),
    employees: t('shifts.list.columns.employees'),
  };

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('shifts.list.title')}
          subtitle={listSubtitle(list, (count) => t('shifts.list.subtitle', { count }))}
          actions={
            <>
              <ButtonLink to={paths.company.shiftRequests} variant="ghost" icon={<Inbox size={18} />}>
                {t('shifts.list.requests')}
              </ButtonLink>
              {list.data && list.total > 0 && !trash && (
                <ButtonLink to={paths.company.bulkAssignShift} variant="secondary" icon={<UsersRound size={18} />}>
                  {t('shifts.list.assignMany')}
                </ButtonLink>
              )}
              {create}
            </>
          }
        />
        <PanelSection>
          <ListToolbar search={list.search} onSearch={list.setSearch} placeholder={t('shifts.list.searchPlaceholder')} label={t('shifts.list.searchLabel')} filter={list.filter} onFilter={list.setFilter} trash />
          <ListResults
            list={list}
            pager={{ noun: { one: t('shifts.list.noun.one'), other: t('shifts.list.noun.other') } }}
            columns={trash ? [columns.shift, columns.days, ...trashColumns()] : [columns.shift, columns.days, columns.place, columns.breaks, columns.tolerance, columns.employees, t('common.fields.status')]}
            onOpen={trash ? undefined : (shift) => void navigate(paths.company.editShift(shift.id))}
            empty={listEmpty(list, {
              noMatch: noMatchEmpty(t('shifts.list.noMatch.title'), t('shifts.list.noMatch.description')),
              empty: { icon: <CalendarClock />, title: t('shifts.list.empty.title'), description: t('shifts.list.empty.description'), action: create },
            })}
            renderCells={(shift) => (
              <>
                <td className="table__primary">
                  <span className="person">
                    <span className="icon-tile">{shift.overnight ? <Moon size={18} /> : <CalendarClock size={18} />}</span>
                    <span className="person__info">
                      <strong className="truncate">{shift.name}</strong>
                      <small>
                        {shiftSchedule(shift)} · {formatMinutes(shift.duration_minutes)}
                      </small>
                    </span>
                  </span>
                </td>
                <td data-label={columns.days}>{weekdaysLabel(shift.weekdays)}</td>
                {trash ? (
                  <TrashCells record={shift} name={shift.name} busy={restoring === shift.id} disabled={restoring !== null} onRestore={() => restoreShift(shift)} />
                ) : (
                  <>
                    <td data-label={columns.place} className="table__wide">
                      <span className="truncate">{placeText(shift)}</span>
                    </td>
                    <td data-label={columns.breaks}>{breaksText(shift.breaks_count, shift.break_minutes)}</td>
                    <td data-label={columns.tolerance}>{shift.late_tolerance_minutes ? t('shifts.list.lateTolerance', { minutes: shift.late_tolerance_minutes }) : t('shifts.list.noLateTolerance')}</td>
                    <td data-label={columns.employees}>
                      <span className="badge badge--info badge--plain">{formatCount(shift.employees)}</span>
                    </td>
                    <td data-label={t('common.fields.status')}>
                      <StatusBadge active={shift.active} />
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
