import { CalendarPlus, Landmark } from 'lucide-react';
import { useState } from 'react';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { calendarService } from '../../services/calendarService';
import { businessToday } from '../../utils/format';
import { Button, ButtonLink } from '../ui/Button';
import { YEAR_RANGE } from './calendarRules';
import { DayDetail } from './DayDetail';
import { useHolidayActions } from './holidayActions';
import { MonthCalendar } from './MonthCalendar';
import { PeriodNavigator } from './PeriodNavigator';
import { useCalendarPeriod } from './useCalendarPeriod';
import { useMonthDaysOff } from './useMonthDaysOff';
import { YearHolidays } from './YearHolidays';

const loadError = () => t('calendar.holidays.loadError');

/** Leyenda de los puntos: solo se ve cuando la cuadrícula es angosta (en una ancha cada marca dice qué es). */
function DotsLegend() {
  const t = useT();
  return (
    <p className="month-cal__legend">
      <span className="month-cal__key month-cal__key--danger">{t('calendar.month.legend.holiday')}</span>
      <span className="month-cal__key month-cal__key--info">{t('calendar.month.legend.resting')}</span>
      <span className="month-cal__key month-cal__key--success">{t('calendar.month.legend.working')}</span>
    </p>
  );
}

/**
 * Pestaña "Días festivos": la barra del periodo ("Hoy", mes anterior y siguiente, y el selector de mes
 * y año; el día elegido vive en `?date=`) con "Agregar festivos oficiales" del año que se ve y "Agregar
 * festivo"; la cuadrícula del mes con los festivos, quién descansa y quién trabaja cada día; el detalle
 * del día elegido y la tabla paginada de los festivos del año (oficiales y de la empresa).
 */
export function HolidaysTab() {
  const t = useT();
  const today = businessToday();
  const period = useCalendarPeriod(today);
  const { year, month, selected } = period;
  const [revision, setRevision] = useState(0);
  const days = useMonthDaysOff(year, month, revision);
  const list = useSearchList((query, signal) => calendarService.holidays({ page: query.page, size: query.size, year, deleted: query.deleted }, signal), {
    errorTitle: loadError,
    filterKey: String(year),
  });
  const actions = useHolidayActions(() => {
    setRevision((current) => current + 1);
    list.retry();
  });

  return (
    <div className="cal-tab">
      <div className="cal-toolbar">
        <PeriodNavigator year={year} month={month} today={today} years={YEAR_RANGE} onChange={period.showMonth} onToday={period.goToday} />
        <div className="cal-toolbar__actions">
          <Button variant="secondary" icon={<Landmark size={18} />} loading={actions.adding} onClick={() => actions.addOfficial(year)}>
            {t('calendar.holidays.addOfficial', { year })}
          </Button>
          <ButtonLink to={paths.company.newHoliday} variant="primary" icon={<CalendarPlus size={18} />}>
            {t('calendar.holidays.add')}
          </ButtonLink>
        </div>
      </div>
      <div className="cal-month">
        <MonthCalendar year={year} month={month} onMonthChange={period.showMonth} markers={days.markers} selected={selected} onSelect={period.select} today={today} years={YEAR_RANGE} footer={<DotsLegend />} />
        <DayDetail
          date={selected}
          today={today}
          holiday={days.holidayOn(selected)}
          absences={days.absencesOn(selected)}
          workdays={days.workdaysOn(selected)}
          truncated={days.truncated}
          onRemoveHoliday={actions.remove}
          removing={actions.removing !== null}
        />
      </div>
      <YearHolidays year={year} list={list} removing={actions.removing} onRemove={actions.remove} restoring={actions.restoring} onRestore={actions.restore} />
    </div>
  );
}
