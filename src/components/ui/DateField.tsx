import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useDismissOnOutsidePointer } from '../../hooks/useDismissOnOutsidePointer';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { useT } from '../../i18n';
import { businessDate, localeDateFormat } from '../../utils/format';
import { describedBy, FieldLabel, FieldMessage } from '../FormField';
import { Floating } from './Floating';

/**
 * Campo de fecha propio (no el nativo del navegador): mismo alto y estilo que los demás
 * controles, la fecha se escribe en el orden del idioma activo ("dd/mm/aaaa" en es-MX,
 * "mm/dd/yyyy" en en-US) y el calendario personalizado (nombres de meses y días del idioma)
 * tiene selección rápida de mes y año, límites (min/max) y navegación con teclado.
 *
 * El valor es ISO "aaaa-mm-dd" (como un <input type="date">) en cualquier idioma. Mientras se
 * escribe una fecha incompleta el valor es "" y, si está completa pero no existe (31/02), se
 * entrega el texto tal cual para que la validación del formulario la marque como inválida. Al
 * cambiar el idioma, la fecha elegida se vuelve a escribir en el orden del idioma nuevo.
 */
interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  /** Mes en que abre el calendario si aún no hay fecha (ISO). Por defecto, la fecha máxima. */
  openTo?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Orden en que se escriben el día y el mes: "dd/mm/aaaa" (es-MX) o "mm/dd/yyyy" (en-US). */
export type DateOrder = 'dmy' | 'mdy';

/** El orden de la fecha corta del idioma activo (lo dice `Intl`, no una lista de idiomas). */
export function dateOrder(): DateOrder {
  const parts = localeDateFormat({ day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).formatToParts(0);
  return parts.findIndex((part) => part.type === 'month') < parts.findIndex((part) => part.type === 'day') ? 'mdy' : 'dmy';
}

/** Primera letra en mayúscula: `Intl` da los meses y los días del español en minúsculas ("junio" → "Junio" en un título). */
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Formato de un día de calendario (fecha local) en el idioma activo; en UTC para que la zona no cambie el día. */
const formatDay = (date: Date, options: Intl.DateTimeFormatOptions) =>
  localeDateFormat({ ...options, timeZone: 'UTC' }).format(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

/** Nombre del mes (0-11) en el idioma activo: "Junio" / "June" (largo) o "Jun" (corto). */
const monthName = (month: number, style: 'long' | 'short') => capitalize(formatDay(new Date(2000, month, 1), { month: style }));

/** Días de la semana de lunes a domingo en dos letras: "Lu", "Ma"… / "Mo", "Tu"… (el 1 de enero de 2024 fue lunes). */
const weekdayNames = () => Array.from({ length: 7 }, (_, i) => capitalize(formatDay(new Date(2024, 0, 1 + i), { weekday: 'short' }).slice(0, 2)));

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseIso(value: string | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getMonth() === Number(match[2]) - 1 ? date : null;
}

/** ISO → lo que se ve en el campo, en el orden del idioma ("" si no es una fecha). */
export function isoToDisplay(value: string, order: DateOrder = dateOrder()): string {
  const date = parseIso(value);
  if (!date) return '';
  const [day, month] = [pad(date.getDate()), pad(date.getMonth() + 1)];
  return `${order === 'mdy' ? `${month}/${day}` : `${day}/${month}`}/${date.getFullYear()}`;
}

/** Aplica la máscara mientras se escribe (dd/mm/aaaa y mm/dd/yyyy tienen la misma forma: 2/2/4 dígitos). */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

/** Lo escrito (en el orden del idioma) → ISO; "" si está incompleta; el texto si está completa pero no existe. */
export function displayToValue(text: string, order: DateOrder = dateOrder()): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return '';
  const [day, month] = order === 'mdy' ? [match[2], match[1]] : [match[1], match[2]];
  const iso = `${match[3]}-${month}-${day}`;
  return parseIso(iso) ? iso : text;
}

function sameDay(a: Date | null, b: Date | null): boolean {
  return Boolean(a && b && a.toDateString() === b.toDateString());
}

function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // lunes primero
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, i - offset + 1));
}

interface CalendarProps {
  selected: Date | null;
  initial: Date | null;
  min: Date | null;
  max: Date | null;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

type View = 'days' | 'months' | 'years';
const MONTH_INDEXES = Array.from({ length: 12 }, (_, m) => m);
const YEARS_PER_PAGE = 20;
const COLUMNS: Record<Exclude<View, 'days'>, number> = { months: 3, years: 4 };

/** Flechas dentro de una cuadrícula de botones (meses o años): mueve el foco entre opciones (también el selector de mes del calendario). */
export function moveInGrid(event: KeyboardEvent, columns: number): boolean {
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
  if (!(event.key in steps)) return false;
  const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  buttons[Math.min(buttons.length - 1, Math.max(0, index + steps[event.key]))]?.focus();
  event.preventDefault();
  return true;
}

/**
 * Calendario propio (sin listas nativas del sistema): días, meses y años en cuadrículas con el
 * mismo estilo de la aplicación. Flujo rápido para fechas lejanas: año → mes → día.
 */
function Calendar({ selected, initial: openTo, min, max, onSelect, onClose }: CalendarProps) {
  const t = useT();
  const initial = selected ?? openTo ?? max ?? businessDate();
  const [view, setView] = useState<View>('days');
  const [month, setMonth] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [focused, setFocused] = useState<Date>(initial);
  const minYear = (min ?? new Date(1920, 0, 1)).getFullYear();
  const maxYear = (max ?? businessDate()).getFullYear();
  const [yearPage, setYearPage] = useState(() => Math.floor((month.year - minYear) / YEARS_PER_PAGE));
  const bodyRef = useRef<HTMLDivElement>(null);
  const outOfRange = (d: Date) => Boolean((min && d < min) || (max && d > max));
  const monthOutOfRange = (year: number, m: number) =>
    Boolean((min && new Date(year, m + 1, 0) < min) || (max && new Date(year, m, 1) > max));

  // Foco en la opción activa de la vista visible (día, mes o año).
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')?.focus();
  }, [focused, month, view, yearPage]);

  const goToMonth = (year: number, m: number) => {
    const next = new Date(year, m, 1);
    setMonth({ year: next.getFullYear(), month: next.getMonth() });
  };
  const moveFocus = (days: number) => {
    const next = new Date(focused);
    next.setDate(next.getDate() + days);
    setFocused(next);
    goToMonth(next.getFullYear(), next.getMonth());
  };
  const onDaysKey = (event: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in moves) {
      event.preventDefault();
      moveFocus(moves[event.key]);
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    // Escape regresa a los días; en los días, cierra.
    if (view === 'days') onClose();
    else setView('days');
  };

  const firstYear = minYear + yearPage * YEARS_PER_PAGE;
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => firstYear + i).filter((y) => y <= maxYear);
  const lastPage = Math.floor((maxYear - minYear) / YEARS_PER_PAGE);

  const shift = (delta: number) => {
    if (view === 'days') goToMonth(month.year, month.month + delta);
    else if (view === 'months') setMonth((m) => ({ ...m, year: Math.min(maxYear, Math.max(minYear, m.year + delta)) }));
    else setYearPage((p) => Math.min(lastPage, Math.max(0, p + delta)));
  };
  const canShift = (delta: number) => {
    if (view === 'years') return delta < 0 ? yearPage > 0 : yearPage < lastPage;
    if (view === 'months') return delta < 0 ? month.year > minYear : month.year < maxYear;
    const next = new Date(month.year, month.month + delta, 1);
    return !monthOutOfRange(next.getFullYear(), next.getMonth());
  };

  return (
    <div className="datepicker" role="dialog" aria-label={t('ui.dateField.dialog')} onKeyDown={onKeyDown}>
      <div className="datepicker__head">
        <button type="button" className="datepicker__nav" onClick={() => shift(-1)} disabled={!canShift(-1)} aria-label={t(`ui.dateField.nav.${view}.previous`)}>
          <ChevronLeft size={18} />
        </button>
        <div className="datepicker__title">
          {view === 'years' ? (
            <span className="datepicker__range">
              {years[0]} – {years[years.length - 1]}
            </span>
          ) : (
            <>
              {view === 'days' && (
                <button type="button" className="datepicker__switch" onClick={() => setView('months')} aria-label={t('ui.dateField.chooseMonth', { month: monthName(month.month, 'long') })}>
                  {monthName(month.month, 'long')} <ChevronDown size={14} />
                </button>
              )}
              <button
                type="button"
                className="datepicker__switch"
                onClick={() => {
                  setYearPage(Math.floor((month.year - minYear) / YEARS_PER_PAGE));
                  setView('years');
                }}
                aria-label={t('ui.dateField.chooseYear', { year: month.year })}
              >
                {month.year} <ChevronDown size={14} />
              </button>
            </>
          )}
        </div>
        <button type="button" className="datepicker__nav" onClick={() => shift(1)} disabled={!canShift(1)} aria-label={t(`ui.dateField.nav.${view}.next`)}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div ref={bodyRef} className={`datepicker__body datepicker__body--${view}`} key={view}>
        {view === 'days' && (
          <div className="datepicker__grid" role="grid" onKeyDown={onDaysKey}>
            {weekdayNames().map((day, index) => (
              <span key={index} className="datepicker__weekday" role="columnheader">
                {day}
              </span>
            ))}
            {monthMatrix(month.year, month.month).map((day) => {
              const classes = [
                'datepicker__day',
                day.getMonth() !== month.month && 'is-outside',
                sameDay(day, selected) && 'is-selected',
                sameDay(day, businessDate()) && 'is-today',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  role="gridcell"
                  className={classes}
                  disabled={outOfRange(day)}
                  tabIndex={sameDay(day, focused) ? 0 : -1}
                  data-focused={sameDay(day, focused)}
                  aria-selected={sameDay(day, selected)}
                  aria-label={formatDay(day, { dateStyle: 'long' })}
                  onClick={() => onSelect(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        )}

        {view === 'months' && (
          <div className="datepicker__options datepicker__options--months" role="group" aria-label={t('ui.dateField.monthsOf', { year: month.year })} onKeyDown={(e) => moveInGrid(e, COLUMNS.months)}>
            {MONTH_INDEXES.map((m) => {
              const isSelected = selected?.getFullYear() === month.year && selected.getMonth() === m;
              return (
                <button
                  key={m}
                  type="button"
                  className={`datepicker__option ${isSelected ? 'is-selected' : ''} ${m === month.month ? 'is-current' : ''}`}
                  disabled={monthOutOfRange(month.year, m)}
                  data-focused={m === month.month}
                  aria-pressed={isSelected}
                  aria-label={capitalize(formatDay(new Date(month.year, m, 1), { month: 'long', year: 'numeric' }))}
                  onClick={() => {
                    goToMonth(month.year, m);
                    setFocused(new Date(month.year, m, Math.min(focused.getDate(), new Date(month.year, m + 1, 0).getDate())));
                    setView('days');
                  }}
                >
                  {monthName(m, 'short')}
                </button>
              );
            })}
          </div>
        )}

        {view === 'years' && (
          <div className="datepicker__options datepicker__options--years" role="group" aria-label={t('ui.dateField.years')} onKeyDown={(e) => moveInGrid(e, COLUMNS.years)}>
            {years.map((year) => {
              const isSelected = selected?.getFullYear() === year;
              return (
                <button
                  key={year}
                  type="button"
                  className={`datepicker__option ${isSelected ? 'is-selected' : ''} ${year === month.year ? 'is-current' : ''}`}
                  data-focused={year === month.year || (!years.includes(month.year) && year === years[0])}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setMonth((m) => ({ ...m, year }));
                    setView('months'); // año → mes → día
                  }}
                >
                  {year}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function DateField({ label, value, onChange, min, max, error, hint, disabled = false, required, name, openTo }: DateFieldProps) {
  const t = useT();
  const order = dateOrder();
  const id = useId();
  const [text, setText] = useState(() => isoToDisplay(value, order) || value);
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const minDate = parseIso(min);
  const maxDate = parseIso(max);

  // Cambios externos (p. ej. al cargar el empleado a editar).
  useSyncOnChange(value, (next) => {
    if (displayToValue(text, order) !== next) setText(isoToDisplay(next, order) || (next.includes('/') ? next : ''));
  });
  // Cambio de idioma en caliente: la fecha elegida se escribe en el orden nuevo (el valor ISO no
  // cambia); lo que se está escribiendo a medias se conserva tal cual.
  useSyncOnChange(order, (next) => setText((current) => isoToDisplay(value, next) || current));

  useDismissOnOutsidePointer([controlRef, calendarRef], open, () => setOpen(false));

  return (
    <div className={`field field--with-icon ${error ? 'field--error' : ''}`}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <div className="field__control" ref={controlRef}>
        <span className="field__icon">
          <CalendarDays size={18} />
        </span>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder={t('ui.dateField.placeholder')}
          value={text}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, error, hint)}
          onChange={(e) => {
            const masked = maskDate(e.target.value);
            setText(masked);
            onChange(displayToValue(masked, order));
          }}
        />
        <button
          type="button"
          className="field__toggle"
          aria-label={t('ui.dateField.open')}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown size={18} className={open ? 'is-flipped' : ''} />
        </button>
        {open && (
          <Floating anchorRef={controlRef} floatingRef={calendarRef} className="datepicker-layer">
            <Calendar
              selected={parseIso(value)}
              initial={parseIso(openTo)}
              min={minDate}
              max={maxDate}
              onClose={() => setOpen(false)}
              onSelect={(date) => {
                const iso = toIso(date);
                setText(isoToDisplay(iso, order));
                onChange(iso);
                setOpen(false);
              }}
            />
          </Floating>
        )}
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}
