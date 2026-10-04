import { CalendarDays, CalendarOff, MessageSquareText, Repeat, Send } from 'lucide-react';
import { useId, type ReactNode, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeRequest } from '../../../components/attendance/employee/useEmployeeRequest';
import { FieldLabel, FieldMessage, TextAreaField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { ButtonLink } from '../../../components/ui/Button';
import { DateField, toIso } from '../../../components/ui/DateField';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { Select, type SelectOption } from '../../../components/ui/Select';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useFormState } from '../../../hooks/useFormState';
import { useResource } from '../../../hooks/useResource';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import { fieldErrorsFrom } from '../../../services/http/envelope';
import type { Shift } from '../../../types';
import { businessDate, formatDate } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';

interface ShiftRequestValues {
  shift_id: string;
  valid_from: string;
  reason: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Mañana en la zona del negocio: el cambio se pide con al menos un día de anticipación. */
function tomorrow(): string {
  const today = businessDate();
  return toIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
}

/** Fecha "Desde": completa, válida y desde mañana. */
function dateError(value: string, minDate: string): string | undefined {
  if (!value) return 'Elige desde cuándo quieres el cambio';
  if (!ISO_DATE.test(value)) return 'Escribe una fecha válida (dd/mm/aaaa)';
  return value < minDate ? 'Elige desde mañana: el cambio se pide con al menos un día de anticipación' : undefined;
}

/** Reglas del formulario (solo UX: el backend las vuelve a validar). */
export function validateShiftRequest(values: ShiftRequestValues, minDate: string): Partial<Record<keyof ShiftRequestValues, string>> {
  const reason = values.reason.trim().replace(/\s+/g, ' ');
  return {
    shift_id: values.shift_id ? undefined : 'Elige el turno que quieres',
    valid_from: dateError(values.valid_from, minDate),
    reason: reason.length < 5 ? 'Explica brevemente el motivo (al menos 5 caracteres)' : undefined,
  };
}

// Errores del servidor llevados a su campo: turno inactivo y fecha sin anticipación.
const serverErrors = (error: unknown) => fieldErrorsFrom<ShiftRequestValues>(error, { SHIFT_INACTIVE: 'shift_id', SHIFT_REQUEST_NOTICE_REQUIRED: 'valid_from' });

/** Cada turno con su horario y sus días; el actual se marca y no se puede elegir. */
function shiftOptions(shifts: Shift[], currentId: number | null): SelectOption[] {
  return shifts.map((shift) => {
    const current = shift.id === currentId;
    return {
      value: String(shift.id),
      label: shift.name,
      description: `${shiftSchedule(shift)} · ${weekdaysLabel(shift.weekdays)}${current ? ' · Tu turno actual' : ''}`,
      disabled: current,
    };
  });
}

function ShiftRequestForm({ shifts, currentShiftId }: { shifts: Shift[]; currentShiftId: number | null }) {
  const navigate = useNavigate();
  const shiftFieldId = useId();
  const minDate = tomorrow();
  const form = useFormState<ShiftRequestValues>({ shift_id: '', valid_from: '', reason: '' }, { serverErrors });
  const send = useEmployeeRequest(form, paths.employee.shiftRequests);
  const { values } = form;
  const clientErrors = validateShiftRequest(values, minDate);
  const errors = form.visibleErrors(clientErrors);
  const back = () => void navigate(paths.employee.shiftRequests);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    send(
      clientErrors,
      () => attendanceService.requestChange({ shift_id: Number(values.shift_id), valid_from: values.valid_from, reason: values.reason }),
      () => ({
        title: '¿Pedir el cambio de turno?',
        details: [
          // El turno elegido (el formulario solo se envía con uno de la lista).
          ...shifts.filter((shift) => String(shift.id) === values.shift_id).map((shift) => ({ label: 'Turno que pides', value: `${shift.name} · ${shiftSchedule(shift)} · ${weekdaysLabel(shift.weekdays)}` })),
          { label: 'Desde', value: formatDate(values.valid_from) },
          { label: 'Motivo', value: values.reason.trim() },
        ],
        done: 'Aquí verás si la aprueba y desde cuándo aplica tu nuevo turno.',
      }),
    );
  };

  return (
    <Panel onSubmit={onSubmit}>
      <PanelHeader title="Pedir cambio de turno" subtitle="Tu empresa revisa la solicitud y decide si la aprueba." backTo={paths.employee.shiftRequests} backLabel="Cambio de turno" />
      <PanelSection title="Turno que quieres" icon={<Repeat size={20} />}>
        <div className={`field ${errors.shift_id ? 'field--error' : ''}`}>
          <FieldLabel htmlFor={shiftFieldId} label="Turno" required />
          <Select
            id={shiftFieldId}
            value={values.shift_id}
            options={shiftOptions(shifts, currentShiftId)}
            placeholder="Elige un turno"
            disabled={form.saving}
            onChange={(shift_id) => form.setValues({ ...values, shift_id })}
          />
          <FieldMessage id={shiftFieldId} error={errors.shift_id} hint="Los turnos activos de tu empresa, con su horario y sus días." />
        </div>
      </PanelSection>
      <PanelSection title="Desde cuándo" icon={<CalendarDays size={20} />}>
        <DateField
          label="Desde"
          name="valid_from"
          value={values.valid_from}
          min={minDate}
          openTo={minDate}
          required
          disabled={form.saving}
          error={errors.valid_from}
          hint="El cambio se pide con al menos un día de anticipación (desde mañana)."
          onChange={(valid_from) => form.setValues({ ...values, valid_from })}
        />
      </PanelSection>
      <PanelSection title="Motivo" icon={<MessageSquareText size={20} />}>
        <TextAreaField
          label="¿Por qué pides el cambio?"
          required
          maxLength={500}
          disabled={form.saving}
          value={values.reason}
          error={errors.reason}
          placeholder="Por ejemplo: entro a la escuela por las mañanas."
          hint="Tu empresa lo verá al revisar la solicitud (de 5 a 500 caracteres)."
          onBlur={() => form.touch('reason')}
          onChange={(reason) => form.setValues({ ...values, reason })}
        />
      </PanelSection>
      <FormFooter submitLabel="Enviar solicitud" submitIcon={<Send size={18} />} saving={form.saving} onCancel={back} />
    </Panel>
  );
}

/** La pantalla sin formulario (no cargó o no hay turnos): el encabezado y lo que corresponda. */
function RequestShell({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <Panel>
        <PanelHeader title="Pedir cambio de turno" backTo={paths.employee.shiftRequests} backLabel="Cambio de turno" />
        <PanelSection>{children}</PanelSection>
      </Panel>
    </div>
  );
}

/**
 * Pedir un cambio de turno (/employee/attendance/requests/new): el turno (de los activos de su
 * empresa), desde cuándo (desde mañana) y el motivo. Solo una pendiente a la vez (409
 * SHIFT_REQUEST_PENDING); al enviarla vuelve a la lista.
 */
export function ShiftRequestFormPage() {
  const { data, error, retry } = useResource(
    (signal) =>
      Promise.all([
        attendanceService.availableShifts({ page: 1, size: 50 }, signal),
        // Solo para marcar el turno actual: si no se puede saber, el formulario funciona igual.
        attendanceService.today(signal).catch(() => null),
      ]),
    'shift-request-form',
    'No se pudieron cargar los turnos',
  );

  if (!data) {
    return error ? (
      <RequestShell>
        <RetryState onRetry={retry} />
      </RequestShell>
    ) : (
      <SkeletonCard lines={5} />
    );
  }
  const [shifts, today] = data;
  if (!shifts.items.length) {
    return (
      <RequestShell>
        <EmptyState
          icon={<CalendarOff />}
          title="Tu empresa no tiene turnos disponibles"
          description="Cuando tu empresa dé de alta sus turnos podrás pedir un cambio aquí."
          action={
            <ButtonLink to={paths.employee.shiftRequests} variant="secondary">
              Volver
            </ButtonLink>
          }
        />
      </RequestShell>
    );
  }
  return (
    <div className="page">
      <ShiftRequestForm shifts={shifts.items} currentShiftId={today?.shift?.id ?? null} />
    </div>
  );
}
