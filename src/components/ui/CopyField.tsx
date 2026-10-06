import { Check, Copy } from 'lucide-react';
import { useCopy } from '../../hooks/useCopy';
import { useT } from '../../i18n';
import { Button } from './Button';

interface CopyFieldProps {
  value: string;
  /** Nombre accesible del botón (p. ej. "Copiar llave"). */
  label?: string;
  /** Texto largo en varias líneas (p. ej. un comando); por omisión, una sola línea con desplazamiento. */
  multiline?: boolean;
}

/** Valor para copiar (llave, URL, comando): texto monoespaciado y su botón "Copiar" → "Copiado". */
export function CopyField({ value, label, multiline = false }: CopyFieldProps) {
  const t = useT();
  const { copied, copy } = useCopy();
  return (
    <div className={`copy-field ${multiline ? 'copy-field--multiline' : ''}`}>
      <code className="copy-field__value">{value}</code>
      <Button size="sm" variant={copied ? 'success' : 'secondary'} icon={copied ? <Check size={16} /> : <Copy size={16} />} aria-label={label ?? t('common.actions.copy')} onClick={() => copy(value)}>
        {copied ? t('ui.copyField.copied') : t('common.actions.copy')}
      </Button>
    </div>
  );
}
