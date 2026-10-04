import type { Holiday } from '../../../types';
import { formatDate } from '../../../utils/format';

// Partes de una fecha del calendario ("YYYY-MM-DD"): no es un instante, no cambia con la zona.
const MONTH = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'UTC' });

const dayOf = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * Próximos días festivos de la empresa, compactos: una hoja de calendario (día y mes), el nombre, el
 * día de la semana con la fecha y si es oficial (Ley Federal del Trabajo) o propio de la empresa.
 */
export function HolidayList({ holidays, loading }: { holidays: Holiday[]; loading: boolean }) {
  return (
    <ul className={`holiday-list ${loading ? 'is-loading' : ''}`.trim()}>
      {holidays.map((holiday) => {
        const day = dayOf(holiday.holiday_date);
        return (
          <li key={holiday.id} className="holiday-list__item">
            <span className="holiday-list__sheet" aria-hidden>
              <small>{MONTH.format(day).replace('.', '')}</small>
              <strong>{day.getUTCDate()}</strong>
            </span>
            <span className="holiday-list__text">
              <strong>{holiday.name}</strong>
              <small>
                <span className="holiday-list__weekday">{WEEKDAY.format(day)}</span> · {formatDate(holiday.holiday_date)}
              </small>
            </span>
            <span className={`badge badge--plain ${holiday.official ? 'badge--info' : 'badge--muted'}`}>{holiday.official ? 'Oficial' : 'De tu empresa'}</span>
          </li>
        );
      })}
    </ul>
  );
}
