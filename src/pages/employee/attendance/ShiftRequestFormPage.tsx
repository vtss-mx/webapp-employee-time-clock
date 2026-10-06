import { CalendarDays, CalendarOff, MessageSquareText, Repeat, Send } from 'lucide-react';
import { useId, type ReactNode, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeRequest } from '../../../components/attendance/employee/useEmployeeRequest';
import { dateError } from '../../../components/calendar/calendarRules';
import { FieldLabel, FieldMessage, TextAreaField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { ShiftCard } from '../../../components/shifts/ShiftCard';
import { ButtonLink } from '../../../components/ui/Button';
import { DateField, toIso } from '../../../components/ui/DateField';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { Select, type SelectOption } from '../../../components/ui/Select';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useFormState } from '../../../hooks/useFormState';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
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

/** Mañana en la zona del negocio: el cambio se pide con al menos un día de anticipación. */
function tomorrow(): string {
  const today = businessDate();
  return toIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
}

/** Fecha "Desde": completa, real y desde mañana. */
function validFromError(value: string, minDate: string): string | undefined {
  const tooSoon = value < minDate ? t('myAttendance.shiftRequestForm.errors.dateTooSoon') : undefined;
  return dateError(value, t('myAttendance.shiftRequestForm.errors.dateMissing')) ?? tooSoon;
}

/** Reglas del formulario (solo UX: el backend las vuelve a validar), en el idioma activo. */
export function validateShiftRequest(values: ShiftRequestValues, minDate: string): Partial<Record<keyof ShiftRequestValues, string>> {
  const reason = values.reason.trim().replace(/\s+/g, ' ');
  return {
    shift_id: values.shift_id ? undefined : t('myAttendance.shiftRequestForm.errors.shift'),
    valid_from: validFromError(values.valid_from, minDate),
    reason: reason.length < 5 ? t('myAttendance.shiftRequestForm.errors.reason') : undefined,
  };
}

// Errores del servidor llevados a su campo: turno inactivo y fecha sin anticipación.
const serverErrors = (error: unknown) => fieldErrorsFrom<ShiftRequestValues>(error, { SHIFT_INACTIVE: 'shift_id', SHIFT_REQUEST_NOTICE_REQUIRED: 'valid_from' });

/** Horario y días de un turno: "08:00 – 16:00 · Lun a vie". */
const shiftWhen = (shift: Shift) => `${shiftSchedule(shift)} · ${weekdaysLabel(shift.weekdays)}`;

/** Cada turno con su horario y sus días; el actual se marca y no se puede elegir. */
function shiftOptions(shifts: Shift[], currentId: number | null): SelectOption[] {
  return shifts.map((shift) => {
    const current = shift.id === currentId;
    return {
      value: String(shift.id),
      label: shift.name,
      description: [shiftWhen(shift), ...(current ? [t('myAttendance.shiftRequestForm.currentShift')] : [])].join(' · '),
      disabled: current,
    };
  });
}

/** Lo que se confirma y se avisa al pedir el cambio (se arma al dibujarse: sigue al idioma activo). */
function shiftRequestSummary(shifts: Shift[], values: ShiftRequestValues) {
  return {
    title: t('myAttendance.shiftRequestForm.confirm.title'),
    details: [
      // El turno elegido (el formulario solo se envía con uno de la lista).
      ...shifts
        .filter((shift) => String(shift.id) === values.shift_id)
        .map((shift) => ({ label: t('myAttendance.shiftRequestForm.confirm.shift'), value: `${shift.name} · ${shiftWhen(shift)}` })),
      { label: t('myAttendance.labels.from'), value: formatDate(values.valid_from) },
      { label: t('common.fields.reason'), value: values.reason.trim() },
    ],
    done: t('myAttendance.shiftRequestForm.confirm.done'),
  };
}

function ShiftRequestForm({ shifts, currentShiftId }: { shifts: Shift[]; currentShiftId: number | null }) {
  const t = useT();
  const navigate = useNavigate();
  const shiftFieldId = useId();
  const minDate = tomorrow();
  const form = useFormState<ShiftRequestValues>({ shift_id: '', valid_from: '', reason: '' }, { serverErrors });
  const send = useEmployeeRequest(form, paths.employee.shiftRequests);
  const { values } = form;
  const clientErrors = validateShiftRequest(values, minDate);
  const errors = form.visibleErrors(clientErrors);
  const back = () => void navigate(paths.employee.shiftRequests);
  const chosen = shifts.find((shift) => String(shift.id) === values.shift_id);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    send(
      () => validateShiftRequest(values, minDate),
      () => attendanceService.requestChange({ shift_id: Number(values.shift_id), valid_from: values.valid_from, reason: values.reason }),
      () => shiftRequestSummary(shifts, values),
    );
  };

  return (
    <Panel onSubmit={onSubmit}>
      <PanelHeader
        title={t('myAttendance.shiftRequests.new')}
        subtitle={t('myAttendance.request.subtitle')}
        backTo={paths.employee.shiftRequests}
        backLabel={t('myAttendance.home.shiftChange')}
      />
      <PanelSection title={t('myAttendance.shiftRequestForm.shiftSection')} icon={<Repeat size={20} />}>
        <div className="stack">
          <div className={`field ${errors.shift_id ? 'field--error' : ''}`}>
            <FieldLabel htmlFor={shiftFieldId} label={t('myAttendance.labels.shift')} required />
            <Select
              id={shiftFieldId}
              value={values.shift_id}
              options={shiftOptions(shifts, currentShiftId)}
              placeholder={t('myAttendance.shiftRequestForm.shiftPlaceholder')}
              disabled={form.saving}
              onChange={(shift_id) => form.setValues({ ...values, shift_id })}
            />
            <FieldMessage id={shiftFieldId} error={errors.shift_id} hint={t('myAttendance.shiftRequestForm.shiftHint')} />
          </div>
          {chosen && <ShiftCard shift={chosen} />}
        </div>
      </PanelSection>
      <PanelSection title={t('myAttendance.shiftRequestForm.fromSection')} icon={<CalendarDays size={20} />}>
        <DateField
          label={t('myAttendance.labels.from')}
          name="valid_from"
          value={values.valid_from}
          min={minDate}
          openTo={minDate}
          required
          disabled={form.saving}
          error={errors.valid_from}
          hint={t('myAttendance.shiftRequestForm.fromHint')}
          onChange={(valid_from) => form.setValues({ ...values, valid_from })}
        />
      </PanelSection>
      <PanelSection title={t('myAttendance.shiftRequestForm.reasonSection')} icon={<MessageSquareText size={20} />}>
        <TextAreaField
          label={t('myAttendance.shiftRequestForm.reasonLabel')}
          required
          maxLength={500}
          disabled={form.saving}
          value={values.reason}
          error={errors.reason}
          placeholder={t('myAttendance.shiftRequestForm.reasonPlaceholder')}
          hint={t('myAttendance.shiftRequestForm.reasonHint')}
          onBlur={() => form.touch('reason')}
          onChange={(reason) => form.setValues({ ...values, reason })}
        />
      </PanelSection>
      <FormFooter submitLabel={t('myAttendance.request.send')} submitIcon={<Send size={18} />} saving={form.saving} onCancel={back} />
    </Panel>
  );
}

/** Título del popup si los turnos no cargan (se arma al dibujarse: sigue al idioma activo). */
const loadError = () => t('myAttendance.shiftRequestForm.loadError');

/** La pantalla sin formulario (no cargó o no hay turnos): el encabezado y lo que corresponda. */
function RequestShell({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('myAttendance.shiftRequests.new')} backTo={paths.employee.shiftRequests} backLabel={t('myAttendance.home.shiftChange')} />
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
  const t = useT();
  const { data, error, retry } = useResource(
    (signal) =>
      Promise.all([
        attendanceService.availableShifts({ page: 1, size: 50 }, signal),
        // Solo para marcar el turno actual: si no se puede saber, el formulario funciona igual.
        attendanceService.today(signal).catch(() => null),
      ]),
    'shift-request-form',
    loadError,
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
          title={t('myAttendance.shiftRequestForm.noShifts.title')}
          description={t('myAttendance.shiftRequestForm.noShifts.description')}
          action={
            <ButtonLink to={paths.employee.shiftRequests} variant="secondary">
              {t('common.actions.back')}
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
