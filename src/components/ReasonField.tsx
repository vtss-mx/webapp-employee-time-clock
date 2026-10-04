import { TextAreaField } from './FormField';
import { ReasonChips, type ReasonCatalog } from './ReasonChips';

interface ReasonFieldProps {
  /** Catálogo de motivos sugeridos (chips que llenan el campo); sin él, solo texto libre (p. ej. una nota). */
  catalog?: ReasonCatalog;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  /** Ayuda bajo el campo (p. ej. quién verá el motivo). */
  hint?: string;
  disabled?: boolean;
}

/** Motivo que verá la persona: sugerencias del catálogo y texto libre (hasta 500 caracteres). */
export function ReasonField({ catalog, label, value, onChange, required = false, placeholder, error, hint, disabled = false }: ReasonFieldProps) {
  return (
    <div className="stack">
      {catalog && <ReasonChips catalog={catalog} value={value} onPick={onChange} />}
      <TextAreaField label={label} required={required} maxLength={500} value={value} disabled={disabled} placeholder={placeholder} error={error} hint={hint} onChange={onChange} />
    </div>
  );
}
