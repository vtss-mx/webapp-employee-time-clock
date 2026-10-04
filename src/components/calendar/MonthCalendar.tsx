import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { businessToday } from '../../utils/format';
import { addDays, addMonths, longDate, monthBounds, monthTitle, weekdayIndex, WEEKDAYS } from './calendarRules';
import { PeriodSwitcher } from './PeriodSwitcher';

/** Color de una marca (tokens de la app). */
export type MarkerTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'muted';

/** Algo que pasa un día (un festivo, cuántos descansan...). */
export interface CalendarMarker {
  /** Única dentro del día. */
  key: string;
  /** Lo que lee el lector de pantalla y el globo de ayuda ("Festivo: Navidad"). */
  label: string;
  tone?: MarkerTone;
  /** Lo que se dibuja en la celda (un nombre corto, un número); sin él, un punto. */
  content?: ReactNode;
}

export interface MonthCalendarLabels {
  previous: string;
  next: string;
  /** Se agrega al nombre del día de hoy. */
  today: string;
}

const DEFAULT_LABELS: MonthCalendarLabels = { previous: 'Mes anterior', next: 'Mes siguiente', today: 'hoy' };

interface MonthCalendarProps {
  year: number;
  /** 0 = enero. */
  month: number;
  /** Otro mes (botones o teclado): lo decide la pantalla. */
  onMonthChange: (year: number, month: number) => void;
  /** Marcas por día ("YYYY-MM-DD"). */
  markers?: Readonly<Record<string, readonly CalendarMarker[]>>;
  /** Dibujo propio de cada marca (por omisión, su `content`). */
  renderMarker?: (marker: CalendarMarker, date: string) => ReactNode;
  /** Día elegido (se resalta); con `onSelect`, tocar un día lo elige. */
  selected?: string | null;
  onSelect?: (date: string) => void;
  /** Hoy en la hora del negocio (por omisión, `businessToday()`). */
  today?: string;
  /** Años a los que se puede ir (p. ej. los que acepta el backend). */
  years?: { from: number; to: number };
  labels?: Partial<MonthCalendarLabels>;
  /** Pie del calendario (p. ej. la leyenda de las marcas). */
  footer?: ReactNode;
  className?: string;
}

/** Semanas del mes de lunes a domingo; null: un día de otro mes (celda vacía). */
function monthWeeks(year: number, month: number): Array<Array<string | null>> {
  const { start, end } = monthBounds(year, month);
  const cells: Array<string | null> = Array.from({ length: weekdayIndex(start) }, () => null);
  for (let day = start; day <= end; day = addDays(day, 1)) cells.push(day);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** A qué día lleva una tecla: flechas (día y semana), Inicio/Fin (la semana), Re Pág/Av Pág (el mes). */
function targetFor(key: string, date: string): string | null {
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (key in steps) return addDays(date, steps[key]);
  if (key === 'Home') return addDays(date, -weekdayIndex(date));
  if (key === 'End') return addDays(date, 6 - weekdayIndex(date));
  if (key === 'PageUp' || key === 'PageDown') return addMonths(date, key === 'PageUp' ? -1 : 1);
  return null;
}

const yearOf = (date: string) => Number(date.slice(0, 4));

/**
 * Calendario de un mes (propio, sin controles del navegador): cuadrícula accesible (`role="grid"`
 * con encabezados de la semana y un nombre completo por día), hoy resaltado, marcas por día
 * personalizables y navegación con teclado (flechas, Inicio/Fin, Re Pág/Av Pág; al salir del mes
 * cambia de mes). Mobile first: las celdas se ajustan al ancho del contenedor y en uno angosto las
 * marcas quedan como puntos.
 */
export function MonthCalendar({ year, month, onMonthChange, markers = {}, renderMarker, selected = null, onSelect, today = businessToday(), years, labels, footer, className = '' }: MonthCalendarProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const titleId = useId();
  const gridRef = useRef<HTMLTableElement>(null);
  const moved = useRef(false);
  const [focused, setFocused] = useState<string | null>(selected);
  const { start, end } = monthBounds(year, month);
  // El día que recibe el foco: el enfocado, el elegido u hoy si están en el mes; si no, el primero.
  const active = [focused, selected, today].find((day) => day && day >= start && day <= end) ?? start;
  const allowed = (target: number) => !years || (target >= years.from && target <= years.to);
  const go = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    onMonthChange(next.getFullYear(), next.getMonth());
  };

  // Solo el teclado mueve el foco (abrir la pantalla o cambiar de mes con los botones no lo roba).
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${active}"]`)?.focus();
  }, [active]);

  const onKeyDown = (event: KeyboardEvent) => {
    const target = targetFor(event.key, active);
    if (!target) return;
    event.preventDefault();
    if (target === active || !allowed(yearOf(target))) return;
    moved.current = true;
    setFocused(target);
    if (target < start || target > end) onMonthChange(yearOf(target), Number(target.slice(5, 7)) - 1);
  };

  return (
    <div className={`month-cal ${className}`.trim()}>
      <PeriodSwitcher
        className="month-cal__head"
        label={monthTitle(year, month)}
        labelId={titleId}
        previous={{ label: text.previous, onClick: () => go(-1), disabled: !allowed(month === 0 ? year - 1 : year) }}
        next={{ label: text.next, onClick: () => go(1), disabled: !allowed(month === 11 ? year + 1 : year) }}
      />
      <table ref={gridRef} className="month-cal__grid" role="grid" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <thead>
          <tr>
            {WEEKDAYS.map((day) => (
              <th key={day.long} scope="col" abbr={day.long} className="month-cal__weekday">
                {day.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(year, month).map((week) => (
            <tr key={week.find(Boolean)}>
              {week.map((date, index) => {
                if (!date) return <td key={`empty-${index}`} className="month-cal__cell is-outside" />;
                const dayMarkers = markers[date] ?? [];
                const name = [longDate(date), date === today && text.today, ...dayMarkers.map((marker) => marker.label)].filter(Boolean).join('. ');
                const classes = ['month-cal__day', date === today && 'is-today', date === selected && 'is-selected', dayMarkers.length > 0 && 'has-markers'].filter(Boolean).join(' ');
                return (
                  <td key={date} className="month-cal__cell" aria-selected={onSelect ? date === selected : undefined}>
                    <button
                      type="button"
                      className={classes}
                      data-date={date}
                      tabIndex={date === active ? 0 : -1}
                      aria-label={name}
                      aria-current={date === today ? 'date' : undefined}
                      onClick={() => {
                        setFocused(date);
                        onSelect?.(date);
                      }}
                    >
                      <span className="month-cal__number" aria-hidden>
                        {Number(date.slice(8))}
                      </span>
                      {dayMarkers.length > 0 && (
                        <span className="month-cal__markers" aria-hidden>
                          {dayMarkers.map((marker) => (
                            <span key={marker.key} className={`month-cal__marker month-cal__marker--${marker.tone ?? 'primary'}`} title={marker.label}>
                              {renderMarker ? renderMarker(marker, date) : marker.content}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
