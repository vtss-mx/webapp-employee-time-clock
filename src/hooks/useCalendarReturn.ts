import { useSearchParams } from 'react-router-dom';
import { calendarDay, calendarDayPath, calendarPath, type CalendarTab } from '../components/calendar/calendarRules';

/**
 * Un formulario del calendario abierto desde un día (`?date=`, el detalle del día elegido): ese día (o
 * null si no vino de uno o no es válido) y a dónde regresa ("Cancelar" y el enlace de regreso): a ese
 * día si vino de él; si no, a la pestaña del formulario.
 */
export function useCalendarReturn(tab: CalendarTab): { day: string | null; backTo: string } {
  const day = calendarDay(useSearchParams()[0].get('date'));
  return { day, backTo: day ? calendarDayPath(day) : calendarPath(tab) };
}
