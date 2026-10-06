import { toIso } from '../components/ui/DateField';
import { t } from '../i18n/core';
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
 * abarca el día del calendario de la empresa. Las semanas empiezan en lunes. Las etiquetas salen en
 * el idioma activo: se piden al dibujar (nunca se guardan).
 */
export function quickRanges(today: Date = businessDate()): QuickRange[] {
  const weekStart = shift(today, -((today.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthEnd = shift(monthStart, -1);
  const range = (key: string, label: string, start: Date, end: Date): QuickRange => ({ key, label, start: toIso(start), end: toIso(end) });
  return [
    range('today', t('forms.ranges.today'), today, today),
    range('yesterday', t('forms.ranges.yesterday'), shift(today, -1), shift(today, -1)),
    range('week', t('forms.ranges.week'), weekStart, today),
    range('last-week', t('forms.ranges.lastWeek'), shift(weekStart, -7), shift(weekStart, -1)),
    range('month', t('forms.ranges.month'), monthStart, today),
    range('last-month', t('forms.ranges.lastMonth'), new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1), lastMonthEnd),
    range('last-30', t('forms.ranges.last30'), shift(today, -29), today),
  ];
}
