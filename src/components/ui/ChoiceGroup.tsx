import { useId, type ReactNode } from 'react';
import { describedBy, FieldMessage } from '../FormField';

interface ChoiceGroupProps {
  /** Nombre visible del grupo (leyenda). */
  label: string;
  /** Clase propia del grupo (días, sitios, modos...): su acomodo. */
  className?: string;
  /** Opciones excluyentes (`RadioCard`): se anuncia como grupo de opciones (radiogroup). */
  radio?: boolean;
  /** Deshabilita todas las opciones a la vez (fieldset nativo). */
  disabled?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/**
 * Grupo de opciones con nombre (`fieldset` + `legend`): días de la semana, sitios, modos de un
 * validador... Muestra su ayuda o su error debajo, como cualquier campo. Con `radio` es un grupo de
 * opciones excluyentes (`RadioCard`).
 */
export function ChoiceGroup({ label, className = '', radio = false, disabled, error, hint, children }: ChoiceGroupProps) {
  const id = useId();
  return (
    <fieldset
      className={`field choice-group ${className} ${error ? 'field--error' : ''}`}
      role={radio ? 'radiogroup' : undefined}
      disabled={disabled}
      aria-labelledby={`${id}-legend`}
      aria-describedby={describedBy(id, error, hint)}
    >
      <legend id={`${id}-legend`} className="choice-group__legend">
        {label}
      </legend>
      {children}
      <FieldMessage id={id} error={error} hint={hint} />
    </fieldset>
  );
}
