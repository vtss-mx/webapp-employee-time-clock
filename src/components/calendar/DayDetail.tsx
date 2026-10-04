import { CalendarPlus, PartyPopper } from 'lucide-react';
import { useId } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { paths } from '../../routes/paths';
import type { Absence, Holiday } from '../../types';
import { PersonItem } from '../departments/PersonItem';
import { ButtonLink } from '../ui/Button';
import { longDate, MONTH_DATA_LIMIT, rangeText } from './calendarRules';

interface DayDetailProps {
  date: string;
  today: string;
  holiday: Holiday | undefined;
  /** Ausencias aprobadas que incluyen el día. */
  absences: Absence[];
  /** Ausencias del mes si son más de las que se cargaron. */
  truncated: number | null;
}

/**
 * El día elegido en el calendario: si es festivo (y si es oficial), quién descansa por vacaciones,
 * permiso o incapacidad y, si aún no pasa y no es festivo, el acceso para hacerlo festivo.
 */
export function DayDetail({ date, today, holiday, absences, truncated }: DayDetailProps) {
  const { nameOf } = useCatalogs();
  const titleId = useId();
  return (
    <section className="cal-day" aria-labelledby={titleId} aria-live="polite">
      <h3 id={titleId} className="cal-day__title">
        {longDate(date)} {date === today && <span className="badge badge--info badge--plain">Hoy</span>}
      </h3>
      {holiday ? (
        <p className="cal-day__holiday">
          <PartyPopper size={18} aria-hidden /> <strong>{holiday.name}</strong>
          <span className={`badge badge--plain ${holiday.official ? 'badge--info' : 'badge--muted'}`}>{holiday.official ? 'Oficial' : 'De la empresa'}</span>
        </p>
      ) : (
        <p className="muted">No es día festivo.</p>
      )}
      {absences.length > 0 ? (
        <ul className="people-list cal-day__people" aria-label="Descansan este día">
          {absences.map((absence) => (
            <PersonItem key={absence.id} name={absence.employee.full_name} detail={`${nameOf('day_off_types', absence.type)} · ${rangeText(absence.starts_on, absence.ends_on)}`} />
          ))}
        </ul>
      ) : (
        <p className="muted">Nadie tiene vacaciones, permiso ni incapacidad este día.</p>
      )}
      {truncated !== null && (
        <small className="muted">
          El calendario cuenta las primeras {MONTH_DATA_LIMIT} de {truncated} ausencias del mes; la lista completa está en «Ausencias».
        </small>
      )}
      {!holiday && date >= today && (
        <ButtonLink to={`${paths.company.newHoliday}?date=${date}`} size="sm" variant="secondary" icon={<CalendarPlus size={16} />}>
          Hacer festivo este día
        </ButtonLink>
      )}
    </section>
  );
}
