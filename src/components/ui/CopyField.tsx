import { Check, Copy } from 'lucide-react';
import { useCopy } from '../../hooks/useCopy';
import { Button } from './Button';

interface CopyFieldProps {
  value: string;
  /** Nombre accesible del botón (p. ej. "Copiar llave"). */
  label?: string;
  /** Texto largo en varias líneas (p. ej. un comando); por omisión, una sola línea con desplazamiento. */
  multiline?: boolean;
}

/** Valor para copiar (llave, URL, comando): texto monoespaciado y su botón "Copiar" → "Copiado". */
export function CopyField({ value, label = 'Copiar', multiline = false }: CopyFieldProps) {
  const { copied, copy } = useCopy();
  return (
    <div className={`copy-field ${multiline ? 'copy-field--multiline' : ''}`}>
      <code className="copy-field__value">{value}</code>
      <Button size="sm" variant={copied ? 'success' : 'secondary'} icon={copied ? <Check size={16} /> : <Copy size={16} />} aria-label={label} onClick={() => copy(value)}>
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  );
}
