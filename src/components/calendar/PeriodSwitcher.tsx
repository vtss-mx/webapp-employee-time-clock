import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

/** Un botón del selector: su nombre accesible, qué hace y si está disponible (p. ej. en un límite). */
export interface PeriodStep {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface PeriodSwitcherProps {
  /** Periodo visible ("2026", "Octubre de 2026"); se anuncia al cambiar. */
  label: ReactNode;
  /** Id del texto del periodo (para nombrar con él una cuadrícula o una sección). */
  labelId?: string;
  previous: PeriodStep;
  next: PeriodStep;
  /** Íconos propios (por omisión, flechas). */
  icons?: { previous?: ReactNode; next?: ReactNode };
  className?: string;
}

/**
 * Selector de periodo propio (año del calendario, mes de la cuadrícula): anterior, el periodo y
 * siguiente, con botones de 44 px en pantallas táctiles. Lo usan el año de los festivos y el mes de
 * `MonthCalendar`.
 */
export function PeriodSwitcher({ label, labelId, previous, next, icons = {}, className = '' }: PeriodSwitcherProps) {
  return (
    <div className={`period-switcher ${className}`.trim()}>
      <Button variant="ghost" size="sm" iconOnly icon={icons.previous ?? <ChevronLeft size={20} />} aria-label={previous.label} title={previous.label} disabled={previous.disabled} onClick={previous.onClick} />
      <strong id={labelId} className="period-switcher__label" aria-live="polite">
        {label}
      </strong>
      <Button variant="ghost" size="sm" iconOnly icon={icons.next ?? <ChevronRight size={20} />} aria-label={next.label} title={next.label} disabled={next.disabled} onClick={next.onClick} />
    </div>
  );
}
