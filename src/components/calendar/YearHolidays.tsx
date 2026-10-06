import { CalendarHeart, Trash2 } from 'lucide-react';
import { useId } from 'react';
import type { SearchList } from '../../hooks/useSearchList';
import { useT } from '../../i18n';
import type { Holiday } from '../../types';
import { formatDate } from '../../utils/format';
import { listEmpty, TrashCells, trashColumns } from '../trash/TrashParts';
import { Button } from '../ui/Button';
import { ListToolbar } from '../ui/ListControls';
import { ListResults } from '../ui/ListResults';
import { HolidayOrigin } from './DayDetail';
import { weekdayName } from './calendarRules';

interface YearHolidaysProps {
  year: number;
  list: SearchList<Holiday>;
  /** El festivo que se está eliminando (id) o null. */
  removing: number | null;
  onRemove: (holiday: Holiday) => void;
  /** El festivo que se está restaurando de «Eliminados» (id) o null. */
  restoring: number | null;
  onRestore: (holiday: Holiday) => void;
}

/**
 * "Festivos de {año}": tabla paginada en el backend con la fecha, el día de la semana, el nombre, el
 * tipo (oficial o de la empresa) y "Eliminar" (pregunta antes). Con el filtro en «Eliminados», en lugar del
 * tipo y "Eliminar": cuándo y quién lo eliminó y «Restaurar». En pantallas angostas cada fila es una
 * tarjeta: el nombre arriba y los demás datos como fichas con su etiqueta.
 */
export function YearHolidays({ year, list, removing, onRemove, restoring, onRestore }: YearHolidaysProps) {
  const t = useT();
  const titleId = useId();
  const columns = { date: t('common.fields.date'), weekday: t('calendar.fields.day'), name: t('common.fields.name'), type: t('calendar.fields.type'), actions: t('calendar.holidays.actions') };
  const { trash } = list;
  return (
    <section className="cal-year" aria-labelledby={titleId}>
      <h3 id={titleId} className="cal-tab__title">
        {t('calendar.holidays.yearTitle', { year })}
      </h3>
      <ListToolbar filter={list.filter} onFilter={list.setFilter} trash statuses={false} />
      <ListResults
        list={list}
        columns={trash ? [columns.date, columns.weekday, columns.name, ...trashColumns()] : Object.values(columns)}
        pager={{ noun: { one: t('calendar.holidays.noun.one'), other: t('calendar.holidays.noun.other') } }}
        empty={listEmpty(list, { empty: { icon: <CalendarHeart />, title: t('calendar.holidays.empty.title'), description: t('calendar.holidays.empty.description'), compact: true } })}
        renderCells={(holiday) => (
          <>
            <td data-label={columns.date} className="cal-year__date">
              {formatDate(holiday.holiday_date)}
            </td>
            <td data-label={columns.weekday}>{weekdayName(holiday.holiday_date)}</td>
            <td className="table__primary cal-year__name">
              <strong>{holiday.name}</strong>
            </td>
            {trash ? (
              <TrashCells record={holiday} name={holiday.name} busy={restoring === holiday.id} disabled={restoring !== null} onRestore={() => onRestore(holiday)} />
            ) : (
              <>
                <td data-label={columns.type}>
                  <HolidayOrigin official={holiday.official} />
                </td>
                <td className="table__actions">
                  <Button size="sm" variant="danger-outline" icon={<Trash2 size={16} />} loading={removing === holiday.id} disabled={removing !== null} aria-label={t('calendar.holidays.removeLabel', { name: holiday.name })} onClick={() => onRemove(holiday)}>
                    {t('common.actions.delete')}
                  </Button>
                </td>
              </>
            )}
          </>
        )}
      />
    </section>
  );
}
