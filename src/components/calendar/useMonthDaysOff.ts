import { BriefcaseBusiness, Users } from 'lucide-react';
import { useResource } from '../../hooks/useResource';
import { t } from '../../i18n';
import { calendarService } from '../../services/calendarService';
import type { Absence, Holiday, Workday } from '../../types';
import { datesBetween, monthBounds, MONTH_DATA_LIMIT } from './calendarRules';
import type { CalendarMarker } from './MonthCalendar';

const holidaysError = () => t('calendar.month.holidaysError');
const absencesError = () => t('calendar.month.absencesError');
const workdaysError = () => t('calendar.month.workdaysError');

/** Las marcas de un día, en el idioma activo: el festivo, cuántos descansan y cuántos trabajan su día libre. */
function dayMarkers(holiday: Holiday | undefined, resting: number, working: number): CalendarMarker[] {
  const day: CalendarMarker[] = [];
  if (holiday) day.push({ key: 'holiday', label: t('calendar.month.holidayMarker', { name: holiday.name }), tone: 'danger', content: holiday.name });
  if (resting) day.push({ key: 'absences', label: t('calendar.month.resting', { count: resting }), tone: 'info', icon: Users, content: t('calendar.month.restingShort', { count: resting }), count: resting });
  if (working) day.push({ key: 'workdays', label: t('calendar.month.working', { count: working }), tone: 'success', icon: BriefcaseBusiness, content: t('calendar.month.workingShort', { count: working }), count: working });
  return day;
}

/**
 * Lo que el calendario del mes necesita, con TRES consultas acotadas (nunca una por día): los festivos
 * del año (una página de MONTH_DATA_LIMIT, más de los que tiene un año), las ausencias aprobadas que
 * tocan el mes y los días laborables especiales del mes (las primeras MONTH_DATA_LIMIT; `truncated` dice
 * cuántas ausencias son si hay más). Todo lo de cada día se calcula en memoria con eso. `revision` las
 * vuelve a pedir tras un cambio (agregar o eliminar un festivo).
 */
export function useMonthDaysOff(year: number, month: number, revision: number) {
  const { start, end } = monthBounds(year, month);
  const holidays = useResource((signal) => calendarService.holidays({ year, page: 1, size: MONTH_DATA_LIMIT }, signal), `${year}:${revision}`, holidaysError);
  const absences = useResource(
    (signal) => calendarService.absences({ status: 'APPROVED', start, end, page: 1, size: MONTH_DATA_LIMIT }, signal),
    `${start}:${revision}`,
    absencesError,
  );
  const workdays = useResource((signal) => calendarService.workdays({ start, end, page: 1, size: MONTH_DATA_LIMIT }, signal), `${start}:${revision}`, workdaysError);

  const byDate = new Map<string, Holiday>((holidays.data?.items ?? []).map((holiday) => [holiday.holiday_date, holiday]));
  const monthAbsences = absences.data?.items ?? [];
  const monthWorkdays = workdays.data?.items ?? [];
  const absencesOn = (date: string): Absence[] => monthAbsences.filter((absence) => absence.starts_on <= date && date <= absence.ends_on);
  const workdaysOn = (date: string): Workday[] => monthWorkdays.filter((workday) => workday.work_date === date);

  // Las marcas se arman en cada dibujo (en el idioma activo; quien usa el hook se redibuja al cambiarlo).
  const markers: Record<string, CalendarMarker[]> = {};
  for (const date of datesBetween(start, end)) {
    const day = dayMarkers(byDate.get(date), absencesOn(date).length, workdaysOn(date).length);
    if (day.length) markers[date] = day;
  }

  const total = absences.data?.total ?? 0;
  return {
    markers,
    holidayOn: (date: string) => byDate.get(date),
    absencesOn,
    workdaysOn,
    /** Ausencias del mes cuando son más de las que se pidieron (el calendario cuenta solo las primeras). */
    truncated: total > monthAbsences.length ? total : null,
  };
}
