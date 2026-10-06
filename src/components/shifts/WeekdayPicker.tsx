import { useT } from '../../i18n';
import type { Weekday } from '../../types';
import { weekdayOptions } from '../../utils/shifts';
import { ChoiceGroup } from '../ui/ChoiceGroup';
import { QuickChoices } from './formFields';
import { sortedDays } from './shiftRules';

export interface WeekdayPreset {
  label: string;
  days: readonly Weekday[];
}

interface WeekdayPickerProps {
  label: string;
  value: readonly Weekday[];
  onChange: (days: Weekday[]) => void;
  /** Solo estos días se pueden elegir (p. ej. los días remotos dentro de los días del turno). */
  allowed?: readonly Weekday[];
  /** Selecciones de un toque ("Lun a vie", "Todos"...). */
  presets?: readonly WeekdayPreset[];
  error?: string;
  hint?: string;
  disabled?: boolean;
}

const sameDays = (a: readonly Weekday[], b: readonly Weekday[]) => a.length === b.length && a.every((day) => b.includes(day));

/**
 * Días de la semana como fichas que se prenden y apagan (Lun ... Dom), con selecciones rápidas.
 * Cada ficha mide al menos 44 px (dedo); en un contenedor angosto pasan a dos renglones.
 */
export function WeekdayPicker({ label, value, onChange, allowed, presets = [], error, hint, disabled = false }: WeekdayPickerProps) {
  const t = useT();
  const toggle = (day: Weekday) => onChange(value.includes(day) ? value.filter((d) => d !== day) : sortedDays([...value, day]));
  // La selección rápida que coincide con los días elegidos se ve marcada (por su posición).
  const picked = String(presets.findIndex((preset) => sameDays(preset.days, value)));
  return (
    <ChoiceGroup label={label} className="weekday-picker" error={error} hint={hint}>
      <div className="weekday-picker__days">
        {weekdayOptions().map(({ value: day, short, name }) => {
          const on = value.includes(day);
          const blocked = allowed !== undefined && !allowed.includes(day);
          return (
            <button
              key={day}
              type="button"
              className={on ? 'chip weekday-picker__day is-active' : 'chip weekday-picker__day'}
              aria-pressed={on}
              aria-label={name}
              title={blocked ? t('shifts.weekdayPicker.blocked') : undefined}
              disabled={disabled || blocked}
              onClick={() => toggle(day)}
            >
              {short}
            </button>
          );
        })}
      </div>
      {presets.length > 0 && (
        <QuickChoices
          label={t('shifts.weekdayPicker.quick', { label: label.toLowerCase() })}
          value={picked}
          choices={presets.map((preset, index) => ({ value: String(index), text: preset.label }))}
          disabled={disabled}
          onPick={(index) => onChange(sortedDays(presets[Number(index)].days))}
        />
      )}
    </ChoiceGroup>
  );
}
