import { CalendarDays, Coffee, LogIn, LogOut, Moon } from 'lucide-react';
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
  if (!timeline) {
    return <p className="shift-summary shift-summary--empty muted">Elige la hora de entrada y la de salida (distintas) para ver cómo queda la jornada.</p>;
  }
  return (
    <div className="shift-summary" aria-live="polite">
      <div className="shift-summary__head">
        <strong className="shift-summary__duration">{formatMinutes(timeline.duration)}</strong>
        <span className="muted">de jornada</span>
        {timeline.overnight && (
          <span className="badge badge--info">
            <Moon size={14} aria-hidden /> Termina al día siguiente
          </span>
        )}
      </div>
      <dl className="shift-summary__rows">
        <div>
          <dt>
            <LogIn size={16} aria-hidden /> Entrada
          </dt>
          <dd>
            Puede checar desde las {momentText(timeline.opens)}; después de las {momentText(timeline.lateAfter)} es retardo.
          </dd>
        </div>
        <div>
          <dt>
            <LogOut size={16} aria-hidden /> Salida
          </dt>
          <dd>
            Desde las {momentText(timeline.leavesFrom)} y a más tardar a las {momentText(timeline.deadline)}.
          </dd>
        </div>
        <div>
          <dt>
            <Coffee size={16} aria-hidden /> Descansos
          </dt>
          <dd>{breaksText(breaksCount, breakMinutes)}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays size={16} aria-hidden /> Días
          </dt>
          <dd>{weekdaysLabel(weekdays)}</dd>
        </div>
      </dl>
    </div>
  );
}
