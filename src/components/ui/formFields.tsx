import { useId, type ReactNode } from 'react';
import { FieldLabel, FieldMessage } from '../FormField';
import { Select, type SelectProps } from '../ui/Select';

type SelectFieldProps<T extends string> = Omit<SelectProps<T>, 'id' | 'aria-label' | 'aria-labelledby' | 'className'> & {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
};

/** Lista desplegable (`Select`) con etiqueta visible, ayuda y error, como los demás campos. */
export function SelectField<T extends string>({ label, error, hint, required, ...select }: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <Select<T> {...select} id={id} className="select--block" />
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

interface QuickChoicesProps {
  /** Nombre del grupo para el lector de pantalla (p. ej. "Radios sugeridos"). */
  label: string;
  /** Valor actual del campo (texto): la opción igual se marca como elegida. */
  value: string;
  choices: ReadonlyArray<{ value: string; text: ReactNode }>;
  disabled?: boolean;
  onPick: (value: string) => void;
}

/** Valores sugeridos de un campo como fichas de un toque (el campo sigue aceptando cualquier valor). */
export function QuickChoices({ label, value, choices, disabled, onPick }: QuickChoicesProps) {
  return (
    <div className="chips quick-choices" role="group" aria-label={label}>
      {choices.map((choice) => {
        const picked = choice.value === value.trim();
        return (
          <button key={choice.value} type="button" className={picked ? 'chip is-active' : 'chip'} aria-pressed={picked} disabled={disabled} onClick={() => onPick(choice.value)}>
            {choice.text}
          </button>
        );
      })}
    </div>
  );
}
