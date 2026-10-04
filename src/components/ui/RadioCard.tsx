import { useId, type ReactNode } from 'react';

export interface RadioCardProps<T extends string> {
  /** Mismo nombre para todas las opciones del grupo: así las flechas recorren el grupo. */
  name: string;
  value: T;
  checked: boolean;
  onChange: (value: T) => void;
  /** Título de la opción (su nombre para el lector de pantalla). */
  title: ReactNode;
  /** Aclaración bajo el título (se anuncia como descripción). */
  description?: ReactNode;
  /** Ícono en un recuadro a la izquierda (se pinta con el color de la marca al elegirse). */
  icon?: ReactNode;
  disabled?: boolean;
  /** md: tarjeta normal; sm: compacta. */
  size?: 'md' | 'sm';
  /** Dónde va el indicador circular: al final (por omisión) o al inicio. */
  indicator?: 'start' | 'end';
  className?: string;
}

/**
 * Opción excluyente como tarjeta (nunca el radio del sistema): el radio nativo queda oculto pero es
 * el que se enfoca y se anuncia; se dibuja un indicador circular propio. Va dentro de un
 * `ChoiceGroup` con `radio` (grupo de opciones): con el mismo `name`, las flechas del teclado
 * recorren y eligen las opciones del grupo como en cualquier grupo de radios.
 */
export function RadioCard<T extends string>(props: RadioCardProps<T>) {
  const { name, value, checked, onChange, title, description, icon, disabled = false, size = 'md', indicator = 'end' } = props;
  const id = useId();
  const classes = ['radio-card', `radio-card--${size}`, `radio-card--indicator-${indicator}`, checked && 'is-checked', props.className];
  return (
    <label className={classes.filter(Boolean).join(' ')}>
      <input
        type="radio"
        className="radio-card__input"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        onChange={() => onChange(value)}
      />
      {icon && (
        <span className="radio-card__icon" aria-hidden>
          {icon}
        </span>
      )}
      <span className="radio-card__text">
        <strong id={`${id}-title`} className="radio-card__title">
          {title}
        </strong>
        {description && (
          <small id={`${id}-description`} className="radio-card__description">
            {description}
          </small>
        )}
      </span>
      <span className="radio-card__indicator" aria-hidden />
    </label>
  );
}
