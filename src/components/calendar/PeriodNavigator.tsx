import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useDismissOnOutsidePointer } from '../../hooks/useDismissOnOutsidePointer';
import { useT } from '../../i18n';
import { Button } from '../ui/Button';
import { moveInGrid } from '../ui/DateField';
import { Floating } from '../ui/Floating';
import { monthName, monthOf, monthTitle } from './calendarRules';

type YearRange = { from: number; to: number };

const MONTHS = Array.from({ length: 12 }, (_, month) => month);
const within = (year: number, years?: YearRange) => !years || (year >= years.from && year <= years.to);

interface MonthPickerProps {
  anchorRef: RefObject<HTMLButtonElement | null>;
  year: number;
  month: number;
  today: string;
  years?: YearRange;
  onPick: (year: number, month: number) => void;
  /** Escape: cierra y regresa el foco al título. */
  onClose: () => void;
  /** Toque fuera: cierra sin mover el foco. */
  onDismiss: () => void;
}

/**
 * Selector compacto de mes y año (superficie flotante con `Floating`, mismo estilo que el calendario de
 * `DateField`): el año con anterior / siguiente y los 12 meses. El mes que se ve está marcado y el de hoy
 * lleva un borde. Flechas entre meses, Enter elige y Escape cierra.
 */
function MonthPicker({ anchorRef, year, month, today, years, onPick, onClose, onDismiss }: MonthPickerProps) {
  const t = useT();
  const [shown, setShown] = useState(year);
  const panelRef = useRef<HTMLDivElement>(null);
  const now = monthOf(today);
  useDismissOnOutsidePointer([anchorRef, panelRef], true, onDismiss);
  // Al abrir, el foco va al mes que se ve (después, cambiar de año no lo mueve).
  useEffect(() => {
    panelRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <Floating anchorRef={anchorRef} floatingRef={panelRef} className="datepicker-layer">
      <div className="datepicker cal-picker" role="dialog" aria-label={t('calendar.period.dialog')} onKeyDown={onKeyDown}>
        <div className="datepicker__head">
          <button type="button" className="datepicker__nav" aria-label={t('calendar.period.previousYear')} disabled={!within(shown - 1, years)} onClick={() => setShown(shown - 1)}>
            <ChevronLeft size={18} />
          </button>
          <strong className="datepicker__range cal-picker__year" aria-live="polite">
            {shown}
          </strong>
          <button type="button" className="datepicker__nav" aria-label={t('calendar.period.nextYear')} disabled={!within(shown + 1, years)} onClick={() => setShown(shown + 1)}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="datepicker__options datepicker__options--months" role="group" aria-label={t('calendar.period.months', { year: shown })} onKeyDown={(event) => moveInGrid(event, 3)}>
          {MONTHS.map((option) => {
            const isSelected = shown === year && option === month;
            const isNow = shown === now.year && option === now.month;
            return (
              <button
                key={option}
                type="button"
                className={['datepicker__option', isSelected && 'is-selected', isNow && 'is-current'].filter(Boolean).join(' ')}
                aria-pressed={isSelected}
                aria-current={isNow ? 'date' : undefined}
                aria-label={monthTitle(shown, option)}
                onClick={() => onPick(shown, option)}
              >
                {monthName(option, 'short')}
              </button>
            );
          })}
        </div>
      </div>
    </Floating>
  );
}

interface PeriodNavigatorProps {
  year: number;
  /** 0 = enero. */
  month: number;
  /** Hoy en la hora del negocio (marca su mes en el selector). */
  today: string;
  /** Años a los que se puede ir (p. ej. los que acepta el backend). */
  years?: YearRange;
  onChange: (year: number, month: number) => void;
  onToday: () => void;
}

/**
 * Navegador único del periodo del calendario (como los calendarios de escritorio): "Hoy", mes anterior y
 * siguiente, y el título del mes ("Octubre 2026"), que abre el selector de mes y año. Respeta los años
 * del backend y anuncia el mes nuevo al lector de pantalla.
 */
export function PeriodNavigator({ year, month, today, years, onChange, onToday }: PeriodNavigatorProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLButtonElement>(null);
  const title = monthTitle(year, month);
  const go = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    onChange(next.getFullYear(), next.getMonth());
  };
  const close = () => {
    setOpen(false);
    titleRef.current?.focus();
  };

  return (
    <div className="cal-period">
      <Button variant="ghost" size="sm" className="cal-period__today" title={t('calendar.period.goToday')} onClick={onToday}>
        {t('calendar.period.today')}
      </Button>
      <span className="cal-period__steps">
        <Button variant="ghost" size="sm" iconOnly icon={<ChevronLeft size={20} />} aria-label={t('calendar.month.previous')} title={t('calendar.month.previous')} disabled={!within(month === 0 ? year - 1 : year, years)} onClick={() => go(-1)} />
        <Button variant="ghost" size="sm" iconOnly icon={<ChevronRight size={20} />} aria-label={t('calendar.month.next')} title={t('calendar.month.next')} disabled={!within(month === 11 ? year + 1 : year, years)} onClick={() => go(1)} />
      </span>
      {/* Su nombre es el texto visible ("Octubre 2026"): quien usa control por voz lo dice tal cual lo ve. */}
      <button ref={titleRef} type="button" className="cal-period__title" title={t('calendar.period.choose')} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <strong>{monthName(month, 'long')}</strong> <span className="cal-period__year">{year}</span>
        <ChevronDown size={18} className={open ? 'is-flipped' : ''} aria-hidden />
      </button>
      <span className="sr-only" aria-live="polite">
        {title}
      </span>
      {open && (
        <MonthPicker
          anchorRef={titleRef}
          year={year}
          month={month}
          today={today}
          years={years}
          onPick={(nextYear, nextMonth) => {
            close();
            onChange(nextYear, nextMonth);
          }}
          onClose={close}
          onDismiss={() => setOpen(false)}
        />
      )}
    </div>
  );
}
