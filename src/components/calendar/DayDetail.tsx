import { CalendarCheck2, CalendarPlus, CalendarX2, PartyPopper, Plane } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useLocale, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import type { Absence, Holiday, Workday } from '../../types';
import { localeDateFormat } from '../../utils/format';
import { PersonItem } from '../departments/PersonItem';
import { Button, ButtonLink } from '../ui/Button';
import { DayOffTypeBadge } from './AbsenceItem';
import { isWeekend, longDate, MONTH_DATA_LIMIT, rangeText } from './calendarRules';

/** Personas que se ven de entrada en cada lista del día; "Ver todos" muestra las demás. */
const VISIBLE_PEOPLE = 5;

/** Insignia del origen de un festivo: "Oficial" (de la ley) o "De la empresa". */
export function HolidayOrigin({ official }: { official: boolean }) {
  const t = useT();
  return <span className={`badge badge--plain ${official ? 'badge--info' : 'badge--muted'}`}>{t(official ? 'calendar.holidays.official' : 'calendar.holidays.company')}</span>;
}

/** Día y mes como una hoja de calendario (el mes abreviado en el idioma activo). */
function DateTile({ date, holiday }: { date: string; holiday: boolean }) {
  useLocale();
  const month = localeDateFormat({ month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  return (
    <span className={`cal-date-tile ${holiday ? 'is-holiday' : ''}`.trim()} aria-hidden>
      <small>{month.replace('.', '')}</small>
      <strong>{Number(date.slice(8))}</strong>
    </span>
  );
}

/** Qué es el día: festivo, fin de semana o laborable. */
function DayStatus({ date, holiday }: { date: string; holiday: boolean }) {
  const t = useT();
  if (holiday) return <span className="badge badge--danger">{t('calendar.day.status.holiday')}</span>;
  if (isWeekend(date)) return <span className="badge badge--muted">{t('calendar.day.status.weekend')}</span>;
  return <span className="badge badge--success">{t('calendar.day.status.workday')}</span>;
}

/** Título de una sección del día con cuántos hay. */
function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <h4 className="cal-day__label">
      {title}
      {count ? <span className="cal-day__count">{count}</span> : null}
    </h4>
  );
}

/**
 * Lista de personas del día: las primeras VISIBLE_PEOPLE y "Ver todos (N)" / "Ver menos". Lleva la fecha
 * como `key`: otro día empieza con la lista corta (el detalle no se vuelve a montar y su región en vivo
 * sigue anunciando el día nuevo).
 */
function PeopleList<T>({ items, label, render }: { items: T[]; label: string; render: (item: T) => ReactNode }) {
  const t = useT();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, VISIBLE_PEOPLE);
  return (
    <>
      <ul className="people-list cal-day__people" aria-label={label}>
        {shown.map(render)}
      </ul>
      {items.length > VISIBLE_PEOPLE && (
        <Button variant="link" size="sm" className="cal-day__more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? t('calendar.day.showLess') : t('calendar.day.showAll', { count: items.length })}
        </Button>
      )}
    </>
  );
}

interface DayDetailProps {
  date: string;
  today: string;
  holiday: Holiday | undefined;
  /** Ausencias aprobadas que incluyen el día. */
  absences: Absence[];
  /** Días laborables especiales del día (personas que trabajan aunque sea su día libre). */
  workdays: Workday[];
  /** Ausencias del mes si son más de las que se cargaron. */
  truncated: number | null;
  /** Quitar el festivo del día (pregunta antes) y si hay una eliminación en curso. */
  onRemoveHoliday: (holiday: Holiday) => void;
  removing: boolean;
}

/**
 * El día elegido en el calendario: la fecha con su estado (festivo, fin de semana o laborable), el
 * festivo con su origen, quién descansa (con su tipo de ausencia del catálogo) y quién trabaja aunque sea
 * su día libre, y las acciones del día: marcar como festivo (si aún no pasa) o quitarlo, y registrar una
 * ausencia desde ese día.
 */
export function DayDetail({ date, today, holiday, absences, workdays, truncated, onRemoveHoliday, removing }: DayDetailProps) {
  const t = useT();
  const titleId = useId();
  return (
    <section className="cal-day" aria-labelledby={titleId} aria-live="polite">
      <header className="cal-day__head">
        <DateTile date={date} holiday={Boolean(holiday)} />
        <div className="cal-day__heading">
          <h3 id={titleId} className="cal-day__title">
            {longDate(date)}
          </h3>
          <span className="cal-day__badges">
            <DayStatus date={date} holiday={Boolean(holiday)} />
            {date === today && <span className="badge badge--info badge--plain">{t('calendar.day.today')}</span>}
          </span>
        </div>
      </header>

      {holiday && (
        <div className="cal-day__section">
          <SectionTitle title={t('calendar.day.holiday')} />
          <div className="cal-day__holiday">
            <span className="cal-day__holiday-icon" aria-hidden>
              <PartyPopper size={18} />
            </span>
            <strong>{holiday.name}</strong>
            <HolidayOrigin official={holiday.official} />
          </div>
        </div>
      )}

      <div className="cal-day__section">
        <SectionTitle title={t('calendar.day.restingTitle')} count={absences.length} />
        {absences.length > 0 ? (
          <PeopleList
            key={date}
            items={absences}
            label={t('calendar.day.resting')}
            render={(absence) => (
              <PersonItem key={absence.id} name={absence.employee.full_name} deleted={absence.employee.deleted} detail={rangeText(absence.starts_on, absence.ends_on)} badges={<DayOffTypeBadge code={absence.type} />} />
            )}
          />
        ) : (
          <p className="cal-day__empty">
            <CalendarCheck2 size={18} aria-hidden /> {t('calendar.day.nobody')}
          </p>
        )}
        {truncated !== null && <small className="muted">{t('calendar.day.truncated', { limit: MONTH_DATA_LIMIT, total: truncated })}</small>}
      </div>

      {workdays.length > 0 && (
        <div className="cal-day__section">
          <SectionTitle title={t('calendar.day.workingTitle')} count={workdays.length} />
          <PeopleList
            key={date}
            items={workdays}
            label={t('calendar.day.working')}
            render={(workday) => (
              <PersonItem
                key={workday.id}
                name={workday.employee.full_name}
                deleted={workday.employee.deleted}
                detail={workday.note ?? workday.employee.employee_number}
                badges={<span className="badge badge--plain badge--success">{t('calendar.workdays.works')}</span>}
              />
            )}
          />
        </div>
      )}

      <footer className="cal-day__actions">
        {holiday ? (
          <Button size="sm" variant="danger-outline" icon={<CalendarX2 size={16} />} disabled={removing} onClick={() => onRemoveHoliday(holiday)}>
            {t('calendar.day.removeHoliday')}
          </Button>
        ) : (
          date >= today && (
            <ButtonLink to={`${paths.company.newHoliday}?date=${date}`} size="sm" variant="secondary" icon={<CalendarPlus size={16} />}>
              {t('calendar.day.makeHoliday')}
            </ButtonLink>
          )
        )}
        <ButtonLink to={`${paths.company.newAbsence}?date=${date}`} size="sm" variant="ghost" icon={<Plane size={16} />}>
          {t('calendar.absences.create')}
        </ButtonLink>
      </footer>
    </section>
  );
}
