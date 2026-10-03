import { useId } from 'react';
import { FieldLabel, FieldMessage } from './FormField';
import { ReasonChips } from './ReasonChips';

interface ReasonFieldProps {
  /** Catálogo de motivos sugeridos (chips que llenan el campo). */
  catalog: 'enrollment_rejection_reasons' | 'reverification_reasons';
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

/** Motivo que verá la persona: sugerencias del catálogo y texto libre (hasta 500 caracteres). */
export function ReasonField({ catalog, label, value, onChange, required = false, placeholder, error, disabled = false }: ReasonFieldProps) {
  const id = useId();
  return (
    <div className="stack">
      <ReasonChips catalog={catalog} value={value} onPick={onChange} />
      <div className={`field ${error ? 'field--error' : ''}`}>
        <FieldLabel htmlFor={id} label={label} required={required} />
        <textarea
          id={id}
          className="textarea"
          maxLength={500}
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <FieldMessage id={id} error={error} />
      </div>
    </div>
  );
}
