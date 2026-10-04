import { ChevronDown, Clock } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useDismissOnOutsidePointer } from '../../hooks/useDismissOnOutsidePointer';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { describedBy, FieldLabel, FieldMessage } from '../FormField';
import { clockDisplay, clockText, clockValue, completeClock, LAST_MINUTE_OF_DAY, maskClock, overlapsRange, parseClock, type ClockRange } from './clock';
import { Floating } from './Floating';
import { TimePanel, type TimePanelLabels, type TimePreset } from './TimePanel';

/** Textos del campo y de su selector (todos personalizables). */
export interface TimeFieldLabels extends TimePanelLabels {
  /** Nombre del botón que abre el selector. */
  open: string;
  placeholder: string;
  /** Hora completa que no existe (p. ej. 25:00). */
  invalid: string;
  /** Hora fuera de `min`/`max` (recibe los límites ya escritos como "HH:MM"). */
  outOfRange: (min: string, max: string) => string;
}

const DEFAULT_LABELS: TimeFieldLabels = {
  open: 'Elegir hora',
  title: 'Elegir hora',
  hours: 'Hora',
  minutes: 'Min',
  presets: 'Horas sugeridas',
  placeholder: 'hh:mm',
  invalid: 'Escribe una hora entre 00:00 y 23:59',
  outOfRange: (min, max) => `Elige una hora entre ${min} y ${max}`,
};

export interface TimeFieldProps {
  label: string;
  /** "HH:MM" (24 h, hora del negocio); "" mientras no hay una hora completa. */
  value: string;
  onChange: (value: string) => void;
  /** Al salir del campo de texto (p. ej. para marcarlo como tocado). */
  onBlur?: () => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  /** Hora mínima y máxima permitidas ("HH:MM"). */
  min?: string;
  max?: string;
  /** Cada cuántos minutos ofrece el selector (por omisión 5). La hora exacta elegida siempre aparece. */
  minuteStep?: number;
  /** Horas de un toque dentro del selector (p. ej. ["07:00", "08:00"] o con texto propio). */
  presets?: ReadonlyArray<string | TimePreset>;
  /** Dónde abre el selector si aún no hay hora ("HH:MM"; por omisión, el mínimo o 00:00). */
  openTo?: string;
  /** Ícono a la izquierda (por omisión, un reloj); `null` lo quita. */
  icon?: ReactNode;
  /** Ícono del botón que abre el selector (por omisión, una flecha que gira al abrir). */
  toggleIcon?: ReactNode;
  labels?: Partial<TimeFieldLabels>;
  /** md: alto de los controles; sm: compacto (con el dedo nunca baja de 44 px). */
  size?: 'md' | 'sm';
}

/** Por qué lo escrito no sirve (solo con la hora completa: mientras se escribe no se regaña). */
function clockProblem(text: string, range: ClockRange, labels: TimeFieldLabels): string | undefined {
  if (text.length < 5) return undefined;
  const minutes = parseClock(text);
  if (minutes === null) return labels.invalid;
  return overlapsRange(minutes, minutes, range) ? undefined : labels.outOfRange(clockText(range.min ?? 0), clockText(range.max ?? LAST_MINUTE_OF_DAY));
}

/**
 * Hora del día propia (nunca el `<input type="time">` del sistema): se escribe con máscara "HH:MM"
 * (teclado numérico en el teléfono; "0730" → "07:30" y "7" → "07:00" al salir) o se elige en un
 * selector flotante con columnas de horas y minutos, horas sugeridas, límites y teclado completo.
 * Mismo alto, borde, foco, error y ayuda que los demás campos; el selector usa `Floating` (ningún
 * panel lo recorta) y se cierra al tocar fuera o con Escape, regresando el foco a su botón.
 */
export function TimeField(props: TimeFieldProps) {
  const { label, value, onChange, error, hint, disabled = false, required, name, minuteStep = 5, presets = [], icon = <Clock size={18} />, size = 'md' } = props;
  const labels = { ...DEFAULT_LABELS, ...props.labels };
  const id = useId();
  const [text, setText] = useState(() => clockDisplay(value));
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const range: ClockRange = { min: parseClock(props.min), max: parseClock(props.max) };
  const message = clockProblem(text, range, labels) ?? error;

  // Cambios externos (p. ej. al cargar el turno a editar).
  useSyncOnChange(value, (next) => {
    if (clockValue(text) !== next) setText(clockDisplay(next));
  });
  useDismissOnOutsidePointer([controlRef, panelRef], open, () => setOpen(false));

  const update = (next: string) => {
    setText(next);
    onChange(clockValue(next));
  };
  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === 'Escape' && open) {
      event.stopPropagation(); // cierra el selector, no la ventana emergente que contiene el campo
      setOpen(false);
    }
  };

  return (
    <div className={['field time-field', icon && 'field--with-icon', size === 'sm' && 'field--sm', message && 'field--error'].filter(Boolean).join(' ')}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <div className="field__control" ref={controlRef}>
        {icon && <span className="field__icon">{icon}</span>}
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          placeholder={labels.placeholder}
          value={text}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(message)}
          aria-describedby={describedBy(id, message, hint)}
          onChange={(e) => update(maskClock(e.target.value))}
          onBlur={() => {
            const completed = completeClock(text);
            if (completed !== text) update(completed);
            props.onBlur?.();
          }}
          onKeyDown={onKeyDown}
        />
        <button
          ref={toggleRef}
          type="button"
          className="field__toggle"
          aria-label={labels.open}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          {props.toggleIcon ?? <ChevronDown size={18} className={open ? 'is-flipped' : ''} />}
        </button>
        {open && (
          <Floating anchorRef={controlRef} floatingRef={panelRef} className="timepicker-layer">
            <TimePanel
              value={parseClock(value)}
              openTo={parseClock(props.openTo) ?? range.min ?? 0}
              minuteStep={minuteStep}
              range={range}
              presets={presets}
              labels={labels}
              onPick={(minutes, done) => {
                update(clockText(minutes));
                if (done) close();
              }}
              onClose={close}
            />
          </Floating>
        )}
      </div>
      <FieldMessage id={id} error={message} hint={hint} />
    </div>
  );
}
