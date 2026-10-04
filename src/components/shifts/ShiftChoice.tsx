import { CalendarClock, CalendarPlus, MapPinned } from 'lucide-react';
import { paths } from '../../routes/paths';
import type { Shift } from '../../types';
import { shiftSchedule, weekdaysLabel } from '../../utils/shifts';
import { ButtonLink } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { PanelSection } from '../ui/Panel';
import { SelectField } from './formFields';
import { PlacementFields } from './PlacementFields';
import { breaksText } from './shiftRules';
import type { Placement } from './usePlacement';

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
 * Qué turno se asigna (a uno o a varios empleados): la lista de turnos activos con su horario y
 * días; sin turnos activos, cómo crear uno.
 */
export function ShiftChoice({ shifts, value, onChange, disabled, error }: ShiftChoiceProps) {
  if (shifts.length === 0) {
    return (
      <EmptyState
        compact
        icon={<CalendarClock />}
        title="No hay turnos activos"
        description="Crea un turno (o activa uno) para poder asignarlo."
        action={
          <ButtonLink to={paths.company.newShift} variant="secondary" icon={<CalendarPlus size={18} />}>
            Nuevo turno
          </ButtonLink>
        }
      />
    );
  }
  const shift = shifts.find((option) => String(option.id) === value);
  return (
    <SelectField
      label="Turno"
      required
      value={value}
      placeholder="Elige un turno"
      options={shifts.map((option) => ({ value: String(option.id), label: option.name, description: `${shiftSchedule(option)} · ${weekdaysLabel(option.weekdays)}` }))}
      disabled={disabled}
      error={error}
      hint={shift ? `${shiftSchedule(shift)} · ${weekdaysLabel(shift.weekdays)} · ${breaksText(shift.breaks_count, shift.break_minutes)}` : 'Solo se ofrecen los turnos activos.'}
      onChange={onChange}
    />
  );
}

interface AssignmentSectionsProps {
  shifts: Shift[];
  shiftId: string;
  onShift: (value: string) => void;
  placement: Placement;
  minDate: string;
  dateHint: string;
  /** Título de la sección de fecha y lugar ("Desde cuándo y dónde checa"). */
  placeTitle: string;
}

/**
 * Las secciones de una asignación (a uno o a varios empleados): qué turno y desde cuándo, qué días
 * remotos y en qué sitios. Elegir otro turno quita el error del servidor sobre el turno.
 */
export function AssignmentSections({ shifts, shiftId, onShift, placement, minDate, dateHint, placeTitle }: AssignmentSectionsProps) {
  const shift = shifts.find((option) => String(option.id) === shiftId) ?? null;
  return (
    <>
      <PanelSection title="Turno" icon={<CalendarClock size={20} />}>
        <ShiftChoice
          shifts={shifts}
          value={shiftId}
          disabled={placement.saving}
          error={placement.errors.shift_id}
          onChange={(value) => {
            onShift(value);
            placement.clearShiftError();
          }}
        />
      </PanelSection>
      <PanelSection title={placeTitle} icon={<MapPinned size={20} />}>
        <PlacementFields placement={placement} shift={shift} minDate={minDate} dateHint={dateHint} withPlace />
      </PanelSection>
    </>
  );
}
