import { CalendarDays, Coffee, LogIn, LogOut, Moon } from 'lucide-react';
import { useT } from '../../i18n';
import type { Weekday } from '../../types';
import { formatMinutes } from '../../utils/format';
import { weekdaysLabel } from '../../utils/shifts';
import { breaksText, momentText, type ShiftTimeline } from './shiftRules';

interface ShiftSummaryProps {
  /** null mientras la entrada y la salida no sean válidas. */
  timeline: ShiftTimeline | null;
  weekdays: readonly Weekday[];
  breaksCount: number;
  breakMinutes: number;
}

/**
 * Cómo queda la jornada con lo capturado, en vivo: duración, si termina al día siguiente, desde
 * cuándo se checa la entrada, cuándo empieza el retardo y la ventana para checar la salida.
 */
export function ShiftSummary({ timeline, weekdays, breaksCount, breakMinutes }: ShiftSummaryProps) {
  const t = useT();
  if (!timeline) {
    return <p className="shift-summary shift-summary--empty muted">{t('shifts.form.summary.empty')}</p>;
  }
  return (
    <div className="shift-summary" aria-live="polite">
      <div className="shift-summary__head">
        <strong className="shift-summary__duration">{formatMinutes(timeline.duration)}</strong>
        <span className="muted">{t('shifts.form.summary.workday')}</span>
        {timeline.overnight && (
          <span className="badge badge--info">
            <Moon size={14} aria-hidden /> {t('shifts.form.summary.overnight')}
          </span>
        )}
      </div>
      <dl className="shift-summary__rows">
        <div>
          <dt>
            <LogIn size={16} aria-hidden /> {t('shifts.form.summary.checkIn')}
          </dt>
          <dd>{t('shifts.form.summary.checkInRule', { opens: momentText(timeline.opens), late: momentText(timeline.lateAfter) })}</dd>
        </div>
        <div>
          <dt>
            <LogOut size={16} aria-hidden /> {t('shifts.form.summary.checkOut')}
          </dt>
          <dd>{t('shifts.form.summary.checkOutRule', { from: momentText(timeline.leavesFrom), until: momentText(timeline.deadline) })}</dd>
        </div>
        <div>
          <dt>
            <Coffee size={16} aria-hidden /> {t('shifts.form.summary.breaks')}
          </dt>
          <dd>{breaksText(breaksCount, breakMinutes)}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays size={16} aria-hidden /> {t('shifts.form.summary.days')}
          </dt>
          <dd>{weekdaysLabel(weekdays)}</dd>
        </div>
      </dl>
    </div>
  );
}
