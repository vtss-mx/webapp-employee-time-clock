import { Coffee, Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT, type Translate } from '../../i18n';
import type { BreakTimes } from '../../types';
import { Button } from '../ui/Button';
import { ChoiceGroup } from '../ui/ChoiceGroup';
import { TimeField } from '../ui/TimeField';

/** Textos del editor (todos personalizables). */
export interface BreaksEditorLabels {
  legend: string;
  /** Título de cada descanso: "Descanso 1". */
  item: (index: number) => string;
  start: string;
  end: string;
  add: string;
  /** Nombre del botón que quita un descanso (para el lector de pantalla). */
  remove: (index: number) => string;
  /** Sin descansos declarados. */
  empty: string;
  /** Una hora que falta (con `markMissing`). */
  missing: string;
  /** Cuántos se permiten (la ayuda por omisión). */
  limit: (max: number) => string;
}

/** Textos por omisión en el idioma activo (se arman en cada dibujo: siguen al idioma). */
const defaultLabels = (t: Translate): BreaksEditorLabels => ({
  legend: t('attendance.fields.breaks'),
  item: (index) => t('attendance.breaks.item', { number: index + 1 }),
  start: t('attendance.breaks.start'),
  end: t('attendance.breaks.end'),
  add: t('attendance.breaks.add'),
  remove: (index) => t('attendance.breaks.remove', { number: index + 1 }),
  empty: t('attendance.breaks.empty'),
  missing: t('attendance.breaks.missing'),
  limit: (max) => (max === 0 ? t('attendance.breaks.none') : t('attendance.breaks.limit', { count: max })),
});

export interface BreaksEditorProps {
  /** Los descansos ("HH:MM" de la hora del negocio; "" mientras falta una hora). */
  value: BreakTimes[];
  onChange: (breaks: BreakTimes[]) => void;
  /** Cuántos se pueden declarar (los del turno): al llegar, "Agregar" se deshabilita. */
  max: number;
  error?: string;
  /** Ayuda del grupo (por omisión, cuántos permite el turno). */
  hint?: string;
  disabled?: boolean;
  /** Marca las horas que faltan (p. ej. después de intentar enviar). */
  markMissing?: boolean;
  /** Horas de un toque en el selector de cada hora. */
  presets?: ReadonlyArray<string>;
  /** Ícono de cada descanso (por omisión, una taza). */
  icon?: ReactNode;
  labels?: Partial<BreaksEditorLabels>;
}

/**
 * Descansos que tomó una persona en su jornada: una fila por descanso con su inicio y su fin
 * (`TimeField`, nunca el control del sistema), un botón para quitarlo y "Agregar descanso" hasta el
 * máximo. El grupo muestra su ayuda o su error (del servidor: encimados, fuera del horario...) como
 * cualquier campo. En el teléfono las dos horas van una junto a otra y los botones miden 44 px.
 *
 *   <BreaksEditor value={breaks} onChange={setBreaks} max={2} error={errors.breaks} />
 */
export function BreaksEditor({ value, onChange, max, error, hint, disabled = false, markMissing = false, presets = [], icon = <Coffee size={18} />, labels: custom }: BreaksEditorProps) {
  const t = useT();
  const labels = { ...defaultLabels(t), ...custom };
  const missing = (time: string) => (markMissing && !time ? labels.missing : undefined);
  const update = (index: number, item: BreakTimes) => onChange(value.map((current, i) => (i === index ? item : current)));
  const full = value.length >= max;

  return (
    <ChoiceGroup label={labels.legend} className="breaks-editor" error={error} hint={hint ?? labels.limit(max)}>
      {value.length ? (
        <ol className="breaks-editor__list">
          {value.map((item, index) => (
            // El índice basta: cada campo de hora se sincroniza con su valor al quitar una fila.
            <li key={index} className="breaks-editor__row">
              <span className="breaks-editor__title">
                <span className="breaks-editor__icon" aria-hidden>
                  {icon}
                </span>
                {labels.item(index)}
              </span>
              <div className="breaks-editor__times">
                <TimeField label={labels.start} size="sm" value={item.start} presets={presets} disabled={disabled} error={missing(item.start)} onChange={(start) => update(index, { ...item, start })} />
                <TimeField label={labels.end} size="sm" value={item.end} presets={presets} disabled={disabled} error={missing(item.end)} onChange={(end) => update(index, { ...item, end })} />
              </div>
              <Button
                variant="ghost"
                iconOnly
                className="breaks-editor__remove"
                icon={<X size={18} />}
                aria-label={labels.remove(index)}
                title={labels.remove(index)}
                disabled={disabled}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="breaks-editor__empty">{labels.empty}</p>
      )}
      <Button variant="secondary" icon={<Plus size={18} />} className="breaks-editor__add" disabled={disabled || full} onClick={() => onChange([...value, { start: '', end: '' }])}>
        {labels.add}
      </Button>
    </ChoiceGroup>
  );
}
