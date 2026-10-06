import { useT } from '../../../i18n';
import type { Holiday } from '../../../types';
import { formatDate, localeDateFormat } from '../../../utils/format';

// Partes de una fecha del calendario ("YYYY-MM-DD"): no es un instante, no cambia con la zona. El
// formato se pide al dibujar (en el idioma activo), no se guarda en una constante del módulo.
const month = (day: Date) => localeDateFormat({ month: 'short', timeZone: 'UTC' }).format(day).replace('.', '');
const weekday = (day: Date) => localeDateFormat({ weekday: 'long', timeZone: 'UTC' }).format(day);

const dayOf = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * Próximos días festivos de la empresa, compactos: una hoja de calendario (día y mes), el nombre, el
 * día de la semana con la fecha y si es oficial (Ley Federal del Trabajo) o propio de la empresa.
 */
export function HolidayList({ holidays, loading }: { holidays: Holiday[]; loading: boolean }) {
  const t = useT();
  return (
    <ul className={`holiday-list ${loading ? 'is-loading' : ''}`.trim()}>
      {holidays.map((holiday) => {
        const day = dayOf(holiday.holiday_date);
        return (
          <li key={holiday.id} className="holiday-list__item">
            <span className="holiday-list__sheet" aria-hidden>
              <small>{month(day)}</small>
              <strong>{day.getUTCDate()}</strong>
            </span>
            <span className="holiday-list__text">
              <strong>{holiday.name}</strong>
              <small>
                <span className="holiday-list__weekday">{weekday(day)}</span> · {formatDate(holiday.holiday_date)}
              </small>
            </span>
            <span className={`badge badge--plain ${holiday.official ? 'badge--info' : 'badge--muted'}`}>{t(holiday.official ? 'myAttendance.items.official' : 'myAttendance.items.companyHoliday')}</span>
          </li>
        );
      })}
    </ul>
  );
}
