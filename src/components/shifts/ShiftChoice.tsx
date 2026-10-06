import { CalendarClock, CalendarDays, CalendarPlus } from 'lucide-react';
import { useT } from '../../i18n';
import { paths } from '../../routes/paths';
import type { Shift } from '../../types';
import { shiftSchedule, weekdaysLabel } from '../../utils/shifts';
import { ButtonLink } from '../ui/Button';
import { DateField } from '../ui/DateField';
import { EmptyState } from '../ui/EmptyState';
import { PanelSection } from '../ui/Panel';
import { SelectField } from './formFields';
import { placeText } from './shiftRules';
import { ShiftCard } from './ShiftCard';
import type { Assignment } from './useAssignment';

/** Turnos activos que se ofrecen al asignar (la página más grande de la API). */
export const SHIFT_OPTIONS_LIMIT = 50;

interface ShiftChoiceProps {
  /** Turnos activos de la empresa. */
  shifts: Shift[];
  /** Id elegido como texto ('' mientras no se elige). */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * Qué turno se asigna (a uno o a varios empleados): la lista de turnos activos con su horario, sus
 * días y dónde se checa; el elegido se ve completo en su tarjeta (`ShiftCard`). Sin turnos activos,
 * cómo crear uno.
 */
export function ShiftChoice({ shifts, value, onChange, disabled, error }: ShiftChoiceProps) {
  const t = useT();
  if (shifts.length === 0) {
    return (
      <EmptyState
        compact
        icon={<CalendarClock />}
        title={t('shifts.choice.empty.title')}
        description={t('shifts.choice.empty.description')}
        action={
          <ButtonLink to={paths.company.newShift} variant="secondary" icon={<CalendarPlus size={18} />}>
            {t('shifts.list.new')}
          </ButtonLink>
        }
      />
    );
  }
  const shift = shifts.find((option) => String(option.id) === value);
  return (
    <div className="stack">
      <SelectField
        label={t('shifts.choice.label')}
        required
        value={value}
        placeholder={t('shifts.choice.placeholder')}
        options={shifts.map((option) => ({ value: String(option.id), label: option.name, description: `${shiftSchedule(option)} · ${weekdaysLabel(option.weekdays)} · ${placeText(option)}` }))}
        disabled={disabled}
        error={error}
        hint={shift ? t('shifts.choice.chosenHint') : t('shifts.choice.activeOnly')}
        onChange={onChange}
      />
      {shift && <ShiftCard shift={shift} />}
    </div>
  );
}

interface StartDateFieldProps {
  assignment: Assignment;
  minDate: string;
  /** Por qué esa fecha (primer turno, cambio con un día de anticipación, la fecha pedida...). */
  hint: string;
}

/** Desde cuándo aplica el turno (asignar o aprobar un cambio). */
export function StartDateField({ assignment, minDate, hint }: StartDateFieldProps) {
  const t = useT();
  return (
    <DateField
      label={t('shifts.assign.appliesFrom')}
      required
      value={assignment.validFrom}
      min={minDate}
      openTo={minDate}
      disabled={assignment.saving}
      error={assignment.errors.valid_from}
      hint={hint}
      onChange={assignment.setValidFrom}
    />
  );
}

interface AssignmentSectionsProps {
  shifts: Shift[];
  shiftId: string;
  onShift: (value: string) => void;
  assignment: Assignment;
  minDate: string;
  dateHint: string;
}

/**
 * Las secciones de una asignación (a uno o a varios empleados): qué turno (con dónde y cuándo se
 * checa) y desde cuándo. Elegir otro turno quita el error del servidor sobre el turno.
 */
export function AssignmentSections({ shifts, shiftId, onShift, assignment, minDate, dateHint }: AssignmentSectionsProps) {
  const t = useT();
  return (
    <>
      <PanelSection title={t('shifts.choice.label')} icon={<CalendarClock size={20} />}>
        <ShiftChoice
          shifts={shifts}
          value={shiftId}
          disabled={assignment.saving}
          error={assignment.errors.shift_id}
          onChange={(value) => {
            onShift(value);
            assignment.clearShiftError();
          }}
        />
      </PanelSection>
      <PanelSection title={t('shifts.choice.since')} icon={<CalendarDays size={20} />}>
        <StartDateField assignment={assignment} minDate={minDate} hint={dateHint} />
      </PanelSection>
    </>
  );
}
