import { TextAreaField } from './FormField';
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
  return (
    <div className="stack">
      <ReasonChips catalog={catalog} value={value} onPick={onChange} />
      <TextAreaField label={label} required={required} maxLength={500} value={value} disabled={disabled} placeholder={placeholder} error={error} onChange={onChange} />
    </div>
  );
}
