import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { businessToday } from '../../utils/format';
import { addDays, addMonths, gridWeeks, isWeekend, longDate, monthBounds, monthOf, monthTitle, weekdayIndex, weekdays } from './calendarRules';

/** Color de una marca (tokens de la app). */
export type MarkerTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'muted';

/** Algo que pasa un día (un festivo, cuántos descansan...). */
export interface CalendarMarker {
  /** Única dentro del día. */
  key: string;
  /** Lo que lee el lector de pantalla y el globo de ayuda ("Festivo: Navidad"). */
  label: string;
  tone?: MarkerTone;
  /** Lo que se dibuja en la celda (un nombre corto, "3 descansan"); sin él, solo su color. */
  content?: ReactNode;
  /** Ícono junto al contenido (p. ej. personas). */
  icon?: LucideIcon;
  /** Cifra que la resume cuando su texto no cabe (cuadrícula mediana): "3" en lugar de "3 descansan". */
  count?: number;
}

export interface MonthCalendarLabels {
  /** Se agrega al nombre del día de hoy. */
  today: string;
}

/** Cuántas marcas se ven por día; las demás se resumen en "+N". */
const MAX_MARKERS = 3;

interface MonthCalendarProps {
  year: number;
  /** 0 = enero. */
  month: number;
  /** Otro mes (teclado o un día de otro mes): lo decide la pantalla. */
  onMonthChange: (year: number, month: number) => void;
  /** Marcas por día ("YYYY-MM-DD"). */
  markers?: Readonly<Record<string, readonly CalendarMarker[]>>;
  /** Dibujo propio de cada marca (por omisión, su ícono y su `content`). */
  renderMarker?: (marker: CalendarMarker, date: string) => ReactNode;
  /** Día elegido (se resalta); con `onSelect`, tocar un día lo elige. */
  selected?: string | null;
  onSelect?: (date: string) => void;
  /** Hoy en la hora del negocio (por omisión, `businessToday()`). */
  today?: string;
  /** Años a los que se puede ir con el teclado (p. ej. los que acepta el backend). */
  years?: { from: number; to: number };
  /** Nombre accesible de la cuadrícula (por omisión, el mes: "Octubre de 2026"). */
  label?: string;
  labels?: Partial<MonthCalendarLabels>;
  /** Marcas visibles por día (las demás, "+N"). */
  maxMarkers?: number;
  /** Pie del calendario (p. ej. la leyenda de las marcas en contenedores angostos). */
  footer?: ReactNode;
  className?: string;
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

/** Una marca en la celda: chip con su ícono y su texto (en un contenedor angosto, solo un punto de su color). */
function MarkerChip({ marker, date, render }: { marker: CalendarMarker; date: string; render?: MonthCalendarProps['renderMarker'] }) {
  const Icon = marker.icon;
  return (
    <span className={`month-cal__marker month-cal__marker--${marker.tone ?? 'primary'} ${marker.count === undefined ? '' : 'has-count'}`.trim()} title={marker.label}>
      {Icon && <Icon size={12} aria-hidden />}
      {render ? render(marker, date) : marker.content !== undefined && <span className="month-cal__marker-text">{marker.content}</span>}
      {marker.count !== undefined && <span className="month-cal__marker-count">{marker.count}</span>}
    </span>
  );
}

interface DayCellProps {
  date: string;
  outside: boolean;
  markers: readonly CalendarMarker[];
  max: number;
  state: { today: boolean; selected: boolean; active: boolean; selectable: boolean };
  name: string;
  render?: MonthCalendarProps['renderMarker'];
  onClick: () => void;
}

/** Un día de la cuadrícula: el número arriba (en un círculo si es hoy) y sus marcas, con "+N" si no caben. */
function DayCell({ date, outside, markers, max, state, name, render, onClick }: DayCellProps) {
  const shown = markers.slice(0, max);
  const hidden = markers.slice(max);
  const cell = ['month-cal__cell', outside && 'is-outside', isWeekend(date) && 'is-weekend'].filter(Boolean).join(' ');
  const day = ['month-cal__day', state.today && 'is-today', state.selected && 'is-selected', markers.length > 0 && 'has-markers'].filter(Boolean).join(' ');
  return (
    <td className={cell} aria-selected={state.selectable ? state.selected : undefined}>
      <button type="button" className={day} data-date={date} tabIndex={state.active ? 0 : -1} aria-label={name} aria-current={state.today ? 'date' : undefined} onClick={onClick}>
        <span className="month-cal__number" aria-hidden>
          {Number(date.slice(8))}
        </span>
        {markers.length > 0 && (
          <span className="month-cal__markers" aria-hidden>
            {shown.map((marker) => (
              <MarkerChip key={marker.key} marker={marker} date={date} render={render} />
            ))}
            {hidden.length > 0 && (
              <span className="month-cal__marker month-cal__marker--more" title={hidden.map((marker) => marker.label).join(' · ')}>
                +{hidden.length}
              </span>
            )}
          </span>
        )}
      </button>
    </td>
  );
}

/**
 * Calendario de un mes (propio, sin controles del navegador): cuadrícula accesible (`role="grid"` con
 * encabezados de la semana y un nombre completo por día) de 6 semanas fijas (la altura no cambia entre
 * meses), con líneas finas, fines de semana sombreados, los días del mes anterior y del siguiente
 * atenuados (tocarlos lleva a su mes), hoy en un círculo, el día elegido con su anillo y las marcas de
 * cada día (con "+N" si no caben). Navegación con teclado: flechas, Inicio/Fin, Re Pág/Av Pág y Enter;
 * al salir del mes cambia de mes. Mobile first: en un contenedor angosto las marcas son puntos.
 */
export function MonthCalendar(props: MonthCalendarProps) {
  const { year, month, onMonthChange, markers = {}, renderMarker, selected = null, onSelect, today = businessToday(), years, labels, maxMarkers = MAX_MARKERS, footer, className = '' } = props;
  const t = useT();
  const text = { today: t('calendar.month.today'), ...labels };
  const gridRef = useRef<HTMLTableElement>(null);
  const moved = useRef(false);
  const [focused, setFocused] = useState<string | null>(selected);
  const { start, end } = monthBounds(year, month);
  const inMonth = (day: string | null) => Boolean(day && day >= start && day <= end);
  // El día que recibe el foco: el enfocado, el elegido u hoy si están en el mes; si no, el primero.
  const active = [focused, selected, today].find(inMonth) ?? start;
  const allowed = (target: string) => !years || (monthOf(target).year >= years.from && monthOf(target).year <= years.to);
  const showMonthOf = (date: string) => onMonthChange(monthOf(date).year, monthOf(date).month);

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
    if (target === active || !allowed(target)) return;
    moved.current = true;
    setFocused(target);
    if (!inMonth(target)) showMonthOf(target);
  };

  const pick = (date: string) => {
    // Un día de otro mes fuera de los años permitidos (diciembre de 1999 junto a enero de 2000) no lleva a nada.
    if (!allowed(date)) return;
    setFocused(date);
    if (!inMonth(date)) showMonthOf(date);
    onSelect?.(date);
  };

  return (
    <div className={`month-cal ${className}`.trim()}>
      <table ref={gridRef} className="month-cal__grid" role="grid" aria-label={props.label ?? monthTitle(year, month)} onKeyDown={onKeyDown}>
        <thead>
          <tr>
            {weekdays().map((day, index) => (
              <th key={day.long} scope="col" abbr={day.long} className={`month-cal__weekday ${index >= 5 ? 'is-weekend' : ''}`.trim()}>
                {day.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gridWeeks(year, month).map((week) => (
            <tr key={week[0]}>
              {week.map((date) => {
                const dayMarkers = markers[date] ?? [];
                const isToday = date === today;
                return (
                  <DayCell
                    key={date}
                    date={date}
                    outside={!inMonth(date)}
                    markers={dayMarkers}
                    max={maxMarkers}
                    state={{ today: isToday, selected: date === selected, active: date === active, selectable: Boolean(onSelect) }}
                    name={[longDate(date), isToday && text.today, ...dayMarkers.map((marker) => marker.label)].filter(Boolean).join('. ')}
                    render={renderMarker}
                    onClick={() => pick(date)}
                  />
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
