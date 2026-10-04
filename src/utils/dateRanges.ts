import { toIso } from '../components/ui/DateField';
import { businessDate } from './format';

export interface QuickRange {
  key: string;
  label: string;
  start: string;
  end: string;
}

const shift = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * Rangos de un clic, calculados con el "hoy" de la zona del negocio (no la del dispositivo): "hoy"
 * abarca el día del calendario de la empresa. Las semanas empiezan en lunes.
 */
export function quickRanges(today: Date = businessDate()): QuickRange[] {
  const weekStart = shift(today, -((today.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthEnd = shift(monthStart, -1);
  const range = (key: string, label: string, start: Date, end: Date): QuickRange => ({ key, label, start: toIso(start), end: toIso(end) });
  return [
    range('today', 'Hoy', today, today),
    range('yesterday', 'Ayer', shift(today, -1), shift(today, -1)),
    range('week', 'Esta semana', weekStart, today),
    range('last-week', 'Semana pasada', shift(weekStart, -7), shift(weekStart, -1)),
    range('month', 'Este mes', monthStart, today),
    range('last-month', 'Mes pasado', new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1), lastMonthEnd),
    range('last-30', 'Últimos 30 días', shift(today, -29), today),
  ];
}
