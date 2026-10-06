import { Minus, Plus } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from './Button';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Nombre del control para el lector de pantalla. */
  label: string;
  /** Cómo se lee el valor (`aria-valuetext` y la cifra junto al control): "2.5 ×". */
  format?: (value: number) => string;
  /** Muestra la cifra al final del control. */
  showValue?: boolean;
  disabled?: boolean;
  /** Botones − y + a los lados (con su nombre); sin nombre, no se dibujan. */
  decrementLabel?: string;
  incrementLabel?: string;
  /** Íconos propios de los botones. */
  decrementIcon?: ReactNode;
  incrementIcon?: ReactNode;
  className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Deslizador propio (nunca el del sistema): el `<input type="range">` nativo queda transparente encima del
 * dibujo y es el que se enfoca, se anuncia y responde al teclado (flechas, RePág/AvPág, Inicio, Fin), al ratón
 * y al dedo; se dibuja una pista con relleno y un pulgar con los tokens `--slider-*` (color, pista y pulgar). Con el dedo, la zona
 * tocable y los botones − / + miden al menos 44 px.
 */
export function Slider({ value, min, max, step, onChange, label, format = String, showValue = false, disabled = false, ...props }: SliderProps) {
  // Fracción recorrida (0 a 1): la pista, el relleno y el pulgar se dibujan con ella (`--slider-ratio`).
  const ratio = max > min ? (clamp(value, min, max) - min) / (max - min) : 0;
  const nudge = (direction: 1 | -1) => onChange(clamp(value + direction * step, min, max));
  const classes = ['slider', disabled && 'is-disabled', props.className];
  return (
    <div className={classes.filter(Boolean).join(' ')} style={{ '--slider-ratio': ratio } as CSSProperties}>
      {props.decrementLabel && (
        <Button
          iconOnly
          size="sm"
          variant="ghost"
          className="slider__button"
          icon={props.decrementIcon ?? <Minus size={18} />}
          aria-label={props.decrementLabel}
          title={props.decrementLabel}
          disabled={disabled || value <= min}
          onClick={() => nudge(-1)}
        />
      )}
      <span className="slider__track">
        <span className="slider__fill" aria-hidden />
        <span className="slider__thumb" aria-hidden />
        <input
          type="range"
          className="slider__input"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={format(value)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </span>
      {props.incrementLabel && (
        <Button
          iconOnly
          size="sm"
          variant="ghost"
          className="slider__button"
          icon={props.incrementIcon ?? <Plus size={18} />}
          aria-label={props.incrementLabel}
          title={props.incrementLabel}
          disabled={disabled || value >= max}
          onClick={() => nudge(1)}
        />
      )}
      {showValue && (
        <output className="slider__value" aria-hidden>
          {format(value)}
        </output>
      )}
    </div>
  );
}
