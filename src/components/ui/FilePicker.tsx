import { FileText, Upload, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useT, type Translate } from '../../i18n';
import { formatBytes } from '../../utils/numbers';
import { describedBy, FieldLabel, FieldMessage } from '../FormField';
import { Button } from './Button';

/** Textos del selector (personalizables). */
export interface FilePickerLabels {
  /** Invitación cuando no hay archivo. */
  choose: string;
  /** Aclaración bajo la invitación (tipos y tamaño). */
  drop: string;
  change: string;
  remove: string;
}

/** Textos por omisión en el idioma activo. */
const defaultLabels = (t: Translate): FilePickerLabels => ({
  choose: t('ui.filePicker.choose'),
  drop: t('ui.filePicker.drop'),
  change: t('ui.filePicker.change'),
  remove: t('ui.filePicker.remove'),
});

interface FilePickerProps {
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
  /** Tipos que ofrece el selector del sistema (atributo `accept`); la regla real va en la validación. */
  accept?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  /** Ícono del archivo elegido (por omisión, un documento). */
  icon?: ReactNode;
  labels?: Partial<FilePickerLabels>;
}

/**
 * Selector de archivo propio (nunca el control del navegador): el `<input type="file">` queda oculto
 * pero es el que se enfoca y se anuncia; se dibuja una zona para elegir o soltar el archivo y, ya
 * elegido, su nombre y tamaño con "Cambiar" y "Quitar". Un archivo a la vez.
 */
export function FilePicker({ label, value, onChange, accept, hint, error, disabled = false, required, icon = <FileText size={22} />, ...props }: FilePickerProps) {
  const t = useT();
  const labels = { ...defaultLabels(t), ...props.labels };
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file && !disabled) onChange(file);
  };
  const onDrag = (event: DragEvent, over: boolean) => {
    event.preventDefault();
    setDragging(over && !disabled);
  };

  const classes = ['field', 'file-picker', error && 'field--error', dragging && 'is-dragging', value && 'has-file', disabled && 'is-disabled'];
  return (
    <div className={classes.filter(Boolean).join(' ')}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <input
        ref={input}
        id={id}
        type="file"
        className="file-picker__input"
        accept={accept}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        onChange={(event) => {
          onChange(event.target.files?.item(0) ?? null);
          event.target.value = ''; // elegir otra vez el mismo archivo también avisa
        }}
      />
      <div className="file-picker__box" onDragOver={(e) => onDrag(e, true)} onDragLeave={(e) => onDrag(e, false)} onDrop={onDrop}>
        {value ? (
          <>
            <span className="file-picker__icon" aria-hidden>
              {icon}
            </span>
            <span className="file-picker__file">
              <strong className="truncate">{value.name}</strong>
              <small>{formatBytes(value.size)}</small>
            </span>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => input.current?.click()}>
              {labels.change}
            </Button>
            <Button size="sm" variant="ghost" iconOnly icon={<X size={18} />} aria-label={labels.remove} title={labels.remove} disabled={disabled} onClick={() => onChange(null)} />
          </>
        ) : (
          <label htmlFor={id} className="file-picker__drop">
            <Upload size={22} aria-hidden />
            <strong>{labels.choose}</strong>
            <small>{labels.drop}</small>
          </label>
        )}
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}
