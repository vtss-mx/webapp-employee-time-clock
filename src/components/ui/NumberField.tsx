import { Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { describedBy, FieldLabel, FieldMessage } from '../FormField';

/** Textos de los botones (nombre accesible; personalizables). */
export interface NumberFieldLabels {
  decrement: string;
  increment: string;
}

const DEFAULT_LABELS: NumberFieldLabels = { decrement: 'Disminuir', increment: 'Aumentar' };

export interface NumberFieldProps {
  label: string;
  /** Lo escrito (como lo guarda el formulario): solo dígitos; "" mientras está vacío. */
  value: string;
  onChange: (value: string) => void;
  /** Al salir del campo (después de ajustar el valor a los límites). */
  onBlur?: () => void;
  /** Mínimo (por omisión 0: el campo solo acepta enteros no negativos). */
  min?: number;
  max?: number;
  /** Cuánto suman o restan los botones y las flechas (por omisión 1; Re Pág/Av Pág: 10 pasos). */
  step?: number;
  /** Unidad que se ve junto al número (p. ej. "min", "m", "km/h"). */
  unit?: string;
  icon?: ReactNode;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  placeholder?: string;
  /** Al salir, un número fuera de los límites se ajusta al más cercano (por omisión, sí). */
  clampOnBlur?: boolean;
  /** Mantener presionado − o + repite el paso (por omisión, sí). */
  holdToRepeat?: boolean;
  labels?: Partial<NumberFieldLabels>;
  /** md: alto de los controles; sm: compacto (con el dedo nunca baja de 44 px). */
  size?: 'md' | 'sm';
}

interface Limits {
  min: number;
  max?: number;
  step: number;
}

/** Más dígitos de los que caben en un número exacto no tienen sentido en un campo. */
const MAX_DIGITS = 15;
const HOLD_DELAY_MS = 450;
const REPEAT_MS = 75;
const KEY_STEPS: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };

/** Lo escrito: solo dígitos y no más de los que admite el máximo (pegar "1,500 m" deja "1500"). */
export function digitsOf(text: string, max?: number): string {
  return text.replace(/\D/g, '').slice(0, max === undefined ? MAX_DIGITS : String(Math.trunc(max)).length);
}

/** Lleva un número a los límites. */
export const clampNumber = (n: number, { min, max = Infinity }: Limits) => Math.min(max, Math.max(min, n));

/** El valor tras `steps` pasos (negativos restan); desde vacío empieza en el mínimo. */
export function steppedValue(text: string, steps: number, limits: Limits): string {
  return String(clampNumber(text === '' ? limits.min : Number(text) + steps * limits.step, limits));
}

/**
 * Mantener presionado un botón repite su acción (como los controles del sistema) hasta soltar o
 * hasta que la acción ya no cambia nada (llegó al límite). Un toque corto es un solo paso.
 */
function useHoldRepeat(action: (steps: number) => boolean, enabled: boolean) {
  const timer = useRef(0);
  const repeated = useRef(false);
  const actionRef = useRef(action);
  useLayoutEffect(() => {
    actionRef.current = action; // el valor más reciente en cada repetición
  });
  const stop = useCallback(() => window.clearTimeout(timer.current), []);
  useEffect(() => stop, [stop]);

  const start = (steps: number) => {
    repeated.current = false;
    if (!enabled) return;
    stop();
    const tick = () => {
      repeated.current = true;
      if (actionRef.current(steps)) timer.current = window.setTimeout(tick, REPEAT_MS);
    };
    timer.current = window.setTimeout(tick, HOLD_DELAY_MS);
    // Soltar en cualquier parte (también fuera del botón o si este se deshabilita al llegar al límite).
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
  };
  const click = (steps: number) => {
    if (repeated.current) repeated.current = false; // ya avanzó mientras se mantenía presionado
    else actionRef.current(steps);
  };
  return { start, stop, click };
}

/**
 * Número propio (sin las flechas nativas del navegador): texto con teclado numérico, botones − y +
 * (mantener presionado repite), unidad junto al número, mínimo, máximo y paso. Las flechas ↑/↓ del
 * teclado suman o restan un paso (Re Pág/Av Pág, diez); al salir, el valor se ajusta a los límites.
 * Vacío se queda vacío: "obligatorio" lo decide la validación del formulario.
 */
export function NumberField(props: NumberFieldProps) {
  const { label, value, onChange, min = 0, max, step = 1, unit, icon, error, hint, disabled = false, required, size = 'md' } = props;
  const labels = { ...DEFAULT_LABELS, ...props.labels };
  const limits: Limits = { min, max, step };
  const id = useId();
  const number = value === '' ? null : Number(value);
  // Último valor entregado: al repetir, cada paso parte del anterior aunque aún no se redibuje.
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  });

  const bump = (steps: number) => {
    const next = steppedValue(latest.current, steps, limits);
    if (next === latest.current) return false;
    latest.current = next;
    onChange(next);
    return true;
  };
  const hold = useHoldRepeat(bump, props.holdToRepeat ?? true);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!(event.key in KEY_STEPS)) return;
    event.preventDefault();
    bump(KEY_STEPS[event.key]);
  };
  const onBlur = () => {
    if ((props.clampOnBlur ?? true) && number !== null) {
      const clamped = String(clampNumber(number, limits));
      if (clamped !== value) onChange(clamped);
    }
    props.onBlur?.();
  };

  const stepButton = (steps: 1 | -1, atLimit: boolean) => (
    <button
      type="button"
      className="number-field__step"
      tabIndex={-1} // con teclado se usan las flechas dentro del campo
      aria-label={steps > 0 ? labels.increment : labels.decrement}
      aria-controls={id}
      disabled={disabled || atLimit}
      onMouseDown={(e) => e.preventDefault()} // el foco se queda en el campo (y el teclado del teléfono no se abre)
      onPointerDown={(e) => e.button === 0 && hold.start(steps)}
      onPointerLeave={hold.stop}
      onClick={() => hold.click(steps)}
    >
      {steps > 0 ? <Plus size={18} strokeWidth={2.5} /> : <Minus size={18} strokeWidth={2.5} />}
    </button>
  );

  return (
    <div className={['field number-field', icon && 'field--with-icon', size === 'sm' && 'field--sm', error && 'field--error'].filter(Boolean).join(' ')}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <div className="field__control">
        {icon && <span className="field__icon">{icon}</span>}
        <input
          id={id}
          name={props.name}
          type="text"
          role="spinbutton"
          inputMode="numeric"
          autoComplete="off"
          placeholder={props.placeholder}
          value={value}
          disabled={disabled}
          required={required}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={number ?? undefined}
          aria-valuetext={unit && number !== null ? `${value} ${unit}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(id, error, hint)}
          onChange={(e) => onChange(digitsOf(e.target.value, max))}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
        {unit && (
          // La unidad sigue al número: una copia invisible del texto ocupa su ancho exacto.
          <span className="number-field__affix" aria-hidden>
            <span className="number-field__ghost">{value}</span>
            <span className="number-field__unit">{unit}</span>
          </span>
        )}
        <span className="number-field__steppers">
          {stepButton(-1, number !== null && number <= min)}
          {stepButton(1, number !== null && max !== undefined && number >= max)}
        </span>
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}
