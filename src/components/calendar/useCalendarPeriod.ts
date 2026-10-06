import { useSearchParams } from 'react-router-dom';
import { calendarDay, defaultDay, monthOf } from './calendarRules';

/**
 * El periodo del calendario y el día elegido, en la URL (`?date=AAAA-MM-DD`): se puede compartir y
 * sobrevive a recargar. El mes que se ve es el del día elegido; sin `?date=` (o con uno inválido o fuera
 * de los años del backend) es hoy. Elegir hoy limpia la URL. Cambiar de día reemplaza la entrada del
 * historial (no se acumulan "atrás" por cada clic) y conserva los demás parámetros.
 */
export function useCalendarPeriod(today: string) {
  const [params, setParams] = useSearchParams();
  const selected = calendarDay(params.get('date')) ?? today;
  const { year, month } = monthOf(selected);

  const select = (date: string) =>
    setParams(
      (current) => {
        const query = new URLSearchParams(current);
        if (date === today) query.delete('date');
        else query.set('date', date);
        return query;
      },
      { replace: true },
    );

  return {
    year,
    month,
    selected,
    select,
    /** Otro mes: se elige hoy si está en él; si no, su primer día. */
    showMonth: (nextYear: number, nextMonth: number) => select(defaultDay(nextYear, nextMonth, today)),
    goToday: () => select(today),
  };
}
