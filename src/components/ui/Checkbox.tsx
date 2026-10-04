import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Texto principal: es el nombre de la casilla para el lector de pantalla. */
  label: ReactNode;
  /** Aclaración bajo el texto (se anuncia como descripción). */
  description?: ReactNode;
  /** Ícono antes del texto. */
  icon?: ReactNode;
  /** Contenido al final de la fila (p. ej. una insignia); también se anuncia como descripción. */
  aside?: ReactNode;
  disabled?: boolean;
  /** card: tarjeta tocable completa (formularios y listas); inline: casilla compacta junto a su texto. */
  variant?: 'card' | 'inline';
  /** md: caja de 24 px; sm: de 20 px. Con el dedo, la zona tocable mide al menos 44 px. */
  size?: 'md' | 'sm';
  /** Marca dentro de la caja (por omisión, una palomita). */
  checkIcon?: ReactNode;
  name?: string;
  value?: string;
  title?: string;
  className?: string;
  /** Descripción adicional (id de un texto de la pantalla). */
  'aria-describedby'?: string;
}

const CHECK_SIZES = { md: 16, sm: 14 } as const;

/**
 * Casilla propia (nunca la del sistema ni `accent-color`): la casilla nativa queda oculta pero sigue
 * siendo la que se enfoca, se anuncia y responde a Espacio; se dibuja una caja con palomita
 * animada con los tokens de los controles. Toda la fila es una `<label>`: se toca en cualquier parte.
 */
export function Checkbox(props: CheckboxProps) {
  const { checked, onChange, label, description, icon, aside, disabled = false, variant = 'card', size = 'md' } = props;
  const id = useId();
  const describedBy = [description && `${id}-description`, aside && `${id}-aside`, props['aria-describedby']].filter(Boolean).join(' ');
  const classes = ['checkbox', `checkbox--${variant}`, `checkbox--${size}`, checked && 'is-checked', disabled && 'is-disabled', props.className];
  return (
    <label className={classes.filter(Boolean).join(' ')} title={props.title}>
      <input
        type="checkbox"
        className="checkbox__input"
        name={props.name}
        value={props.value}
        checked={checked}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="checkbox__box" aria-hidden>
        {props.checkIcon ?? <Check size={CHECK_SIZES[size]} strokeWidth={3} />}
      </span>
      <span className="checkbox__text">
        <span id={`${id}-label`} className="checkbox__label">
          {icon && (
            <span className="checkbox__icon" aria-hidden>
              {icon}
            </span>
          )}
          {label}
        </span>
        {description && (
          <small id={`${id}-description`} className="checkbox__description">
            {description}
          </small>
        )}
      </span>
      {aside && (
        <span id={`${id}-aside`} className="checkbox__aside">
          {aside}
        </span>
      )}
    </label>
  );
}
