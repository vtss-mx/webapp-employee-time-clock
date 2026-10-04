import { useResource } from '../../hooks/useResource';
import { calendarService } from '../../services/calendarService';
import type { Absence, Holiday } from '../../types';
import { datesBetween, monthBounds, MONTH_DATA_LIMIT } from './calendarRules';
import type { CalendarMarker } from './MonthCalendar';

const peopleText = (count: number) => (count === 1 ? '1 persona descansa' : `${count} personas descansan`);

/**
 * Lo que el calendario del mes necesita, con consultas acotadas: los festivos del año (una página de
 * MONTH_DATA_LIMIT, más de los que tiene un año) y las ausencias aprobadas que tocan el mes (las
 * primeras MONTH_DATA_LIMIT; `truncated` dice cuántas son si hay más). `revision` las vuelve a pedir
 * tras un cambio (agregar o eliminar un festivo).
 */
export function useMonthDaysOff(year: number, month: number, revision: number) {
  const { start, end } = monthBounds(year, month);
  const holidays = useResource((signal) => calendarService.holidays({ year, page: 1, size: MONTH_DATA_LIMIT }, signal), `${year}:${revision}`, 'No se pudieron cargar los festivos del calendario');
  const absences = useResource(
    (signal) => calendarService.absences({ status: 'APPROVED', start, end, page: 1, size: MONTH_DATA_LIMIT }, signal),
    `${start}:${revision}`,
    'No se pudieron cargar las ausencias del mes',
  );

  const byDate = new Map<string, Holiday>((holidays.data?.items ?? []).map((holiday) => [holiday.holiday_date, holiday]));
  const monthAbsences = absences.data?.items ?? [];
  const absencesOn = (date: string): Absence[] => monthAbsences.filter((absence) => absence.starts_on <= date && date <= absence.ends_on);

  const markers: Record<string, CalendarMarker[]> = {};
  for (const date of datesBetween(start, end)) {
    const holiday = byDate.get(date);
    const resting = absencesOn(date).length;
    const day: CalendarMarker[] = [];
    if (holiday) day.push({ key: 'holiday', label: `Festivo: ${holiday.name}`, tone: 'danger', content: holiday.name });
    if (resting) day.push({ key: 'absences', label: peopleText(resting), tone: 'info', content: resting });
    if (day.length) markers[date] = day;
  }

  const total = absences.data?.total ?? 0;
  return {
    markers,
    holidayOn: (date: string) => byDate.get(date),
    absencesOn,
    /** Ausencias del mes cuando son más de las que se pidieron (el calendario cuenta solo las primeras). */
    truncated: total > monthAbsences.length ? total : null,
  };
}
