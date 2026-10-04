import { CalendarHeart, CalendarPlus, Landmark, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAction } from '../../hooks/useAction';
import { useFeedback } from '../../hooks/useFeedback';
import { usePagedList } from '../../hooks/usePagedList';
import { paths } from '../../routes/paths';
import { calendarService } from '../../services/calendarService';
import type { Holiday, OfficialHolidaysResult } from '../../types';
import { businessDate, businessToday, formatDate } from '../../utils/format';
import { ShiftItem } from '../shifts/ShiftItem';
import { Button, ButtonLink } from '../ui/Button';
import { PagedItems } from '../ui/PagedItems';
import { defaultDay, isStale, longDate, YEAR_RANGE } from './calendarRules';
import { DayDetail } from './DayDetail';
import { MonthCalendar } from './MonthCalendar';
import { PeriodSwitcher } from './PeriodSwitcher';
import { useMonthDaysOff } from './useMonthDaysOff';

const MONTH_SHORT = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });

/** Día y mes del festivo, como una hoja de calendario. */
function DateTile({ date }: { date: string }) {
  return (
    <span className="cal-date-tile" aria-hidden>
      <strong>{Number(date.slice(8))}</strong>
      <small>{MONTH_SHORT.format(new Date(`${date}T00:00:00Z`)).replace('.', '')}</small>
    </span>
  );
}

interface HolidayItemProps {
  holiday: Holiday;
  busy: boolean;
  disabled: boolean;
  onRemove: () => void;
}

function HolidayItem({ holiday, busy, disabled, onRemove }: HolidayItemProps) {
  return (
    <ShiftItem
      lead={<DateTile date={holiday.holiday_date} />}
      title={holiday.name}
      badges={<span className={`badge badge--plain ${holiday.official ? 'badge--info' : 'badge--muted'}`}>{holiday.official ? 'Oficial' : 'De la empresa'}</span>}
      actions={
        <Button size="sm" variant="danger-outline" icon={<Trash2 size={16} />} loading={busy} disabled={disabled} aria-label={`Eliminar el festivo ${holiday.name}`} onClick={onRemove}>
          Eliminar
        </Button>
      }
    >
      <small className="muted">{longDate(holiday.holiday_date)}</small>
    </ShiftItem>
  );
}

/** Lo que agregó "Agregar festivos oficiales": cada uno con su fecha, o que ya estaban todos. */
function useOfficialNotice() {
  const feedback = useFeedback();
  return (result: OfficialHolidaysResult) => {
    const { added, existing, year } = result;
    if (!added.length) {
      void feedback.info('Ya estaban todos', `Los ${existing} festivos oficiales de ${year} ya estaban en tu calendario: no se agregó nada.`);
      return;
    }
    void feedback.success(added.length === 1 ? 'Se agregó 1 festivo oficial' : `Se agregaron ${added.length} festivos oficiales`, `Días de descanso obligatorio de ${year} (Ley Federal del Trabajo, art. 74):`, {
      details: added.map((holiday) => `${formatDate(holiday.holiday_date)} · ${holiday.name}`),
      detailsStyle: 'checks',
      footnote: existing ? `${existing} ya estaban en tu calendario y se respetaron.` : undefined,
    });
  };
}

/**
 * Pestaña "Días festivos": el año (anterior / siguiente), el calendario del mes con los festivos y
 * cuántos descansan cada día, el detalle del día elegido y la lista paginada de los festivos del año
 * (oficiales y de la empresa), con "Agregar festivos oficiales" y "Agregar día festivo".
 */
export function HolidaysTab() {
  const today = businessToday();
  const [view, setView] = useState(() => {
    const now = businessDate();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [revision, setRevision] = useState(0);
  const { year, month } = view;
  const days = useMonthDaysOff(year, month, revision);
  const list = usePagedList((page, signal) => calendarService.holidays({ ...page, year }, signal), { errorTitle: 'No se pudieron cargar los días festivos', filterKey: String(year) });
  const official = useAction();
  const removal = useAction<number>();
  const officialNotice = useOfficialNotice();

  const refresh = () => {
    setRevision((current) => current + 1);
    list.retry();
  };
  const showMonth = (nextYear: number, nextMonth: number) => {
    setView({ year: nextYear, month: nextMonth });
    setSelected(defaultDay(nextYear, nextMonth, today));
  };
  const addOfficial = () =>
    official.run(() => calendarService.addOfficialHolidays(year), {
      // Qué fechas son las decide el backend (la ley y su año): aquí se dice qué hará y, al terminar,
      // el aviso lista cada festivo que agregó.
      confirm: {
        kind: 'create',
        icon: <Landmark size={30} />,
        eyebrow: 'Festivos oficiales',
        title: `¿Agregar los festivos oficiales de ${year}?`,
        message: `Se agregan los días de descanso obligatorio de ${year} (Ley Federal del Trabajo, art. 74) que aún no estén en tu calendario. Esos días nadie tiene que checar.`,
        details: ['Los que ya están en tu calendario se respetan.', 'Al terminar verás cada fecha que se agregó; cualquiera se puede eliminar después.'],
        confirmLabel: 'Agregar festivos',
        confirmIcon: <Landmark size={18} />,
      },
      errorTitle: 'No se pudieron agregar los festivos oficiales',
      onSuccess: (result) => {
        refresh();
        officialNotice(result);
      },
    });
  const remove = (holiday: Holiday) =>
    removal.run(() => calendarService.removeHoliday(holiday.id), {
      busy: holiday.id,
      confirm: {
        kind: 'delete',
        title: `¿Eliminar el festivo ${holiday.name}?`,
        message: 'Ese día vuelve a ser laborable: quien tenga turno tendrá que checar.',
        details: [
          { label: 'Fecha', value: longDate(holiday.holiday_date) },
          { label: 'Origen', value: holiday.official ? 'Oficial (Ley Federal del Trabajo)' : 'De la empresa' },
        ],
      },
      errorTitle: 'No se pudo eliminar el día festivo',
      success: ['Día festivo eliminado', `${holiday.name} (${formatDate(holiday.holiday_date)}) vuelve a ser un día laborable.`],
      onSuccess: refresh,
      onError: (error) => isStale(error) && refresh(),
    });

  return (
    <div className="cal-tab">
      <div className="cal-bar">
        <PeriodSwitcher
          label={year}
          previous={{ label: 'Año anterior', onClick: () => showMonth(year - 1, month), disabled: year <= YEAR_RANGE.from }}
          next={{ label: 'Año siguiente', onClick: () => showMonth(year + 1, month), disabled: year >= YEAR_RANGE.to }}
        />
        <div className="cal-bar__actions">
          <Button variant="secondary" icon={<Landmark size={18} />} loading={official.busy !== null} onClick={() => void addOfficial()}>
            Agregar festivos oficiales de {year}
          </Button>
          <ButtonLink to={paths.company.newHoliday} variant="primary" icon={<CalendarPlus size={18} />}>
            Agregar día festivo
          </ButtonLink>
        </div>
      </div>
      <div className="cal-month">
        <MonthCalendar
          year={year}
          month={month}
          onMonthChange={showMonth}
          markers={days.markers}
          selected={selected}
          onSelect={setSelected}
          today={today}
          years={YEAR_RANGE}
          footer={
            <p className="month-cal__legend">
              <span className="month-cal__key month-cal__key--danger">Festivo</span>
              <span className="month-cal__key month-cal__key--info">Personas que descansan</span>
            </p>
          }
        />
        <DayDetail date={selected} today={today} holiday={days.holidayOn(selected)} absences={days.absencesOn(selected)} truncated={days.truncated} />
      </div>
      <h3 className="cal-tab__title">Festivos de {year}</h3>
      <PagedItems
        list={list}
        skeletonRows={4}
        pager={{ noun: { one: 'día festivo', other: 'días festivos' } }}
        empty={{
          icon: <CalendarHeart />,
          title: `Aún no hay festivos en ${year}`,
          description: 'Agrega con un botón los días de descanso obligatorio de la ley o los días propios de tu empresa. Ese día nadie tiene que checar.',
          compact: true,
        }}
      >
        {(items) => (
          <ul className={`people-list stagger ${list.loading ? 'is-loading' : ''}`}>
            {items.map((holiday) => (
              <HolidayItem key={holiday.id} holiday={holiday} busy={removal.busy === holiday.id} disabled={removal.busy !== null} onRemove={() => void remove(holiday)} />
            ))}
          </ul>
        )}
      </PagedItems>
    </div>
  );
}
