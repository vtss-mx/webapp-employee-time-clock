import { CalendarDays, CalendarOff, MessageSquareText, Send, TreePalm } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { dayOffIcon } from '../../../components/attendance/employee/DayOffCard';
import { useEmployeeRequest } from '../../../components/attendance/employee/useEmployeeRequest';
import { absenceFacts, dateError, daysText, rangeError, spanDays } from '../../../components/calendar/calendarRules';
import { TextAreaField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { ButtonLink } from '../../../components/ui/Button';
import { ChoiceGroup } from '../../../components/ui/ChoiceGroup';
import { DateField, parseIso } from '../../../components/ui/DateField';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RadioCard } from '../../../components/ui/RadioCard';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useFormState } from '../../../hooks/useFormState';
import { paths } from '../../../routes/paths';
import { calendarService } from '../../../services/calendarService';
import { fieldErrorsFrom } from '../../../services/http/envelope';
import type { DayOffTypeItem } from '../../../types';
import { businessToday } from '../../../utils/format';

interface AbsenceRequestValues {
  type: string;
  starts_on: string;
  ends_on: string;
  note: string;
}

type AbsenceErrors = Partial<Record<keyof AbsenceRequestValues, string>>;

/**
 * Reglas del formulario (solo UX: el backend las vuelve a validar): las del calendario (fechas reales,
 * en orden y de hasta un año) y que se pida desde hoy.
 */
export function validateAbsenceRequest(values: AbsenceRequestValues, today: string): AbsenceErrors {
  const past = values.starts_on < today ? 'Pide tus días desde hoy en adelante' : undefined;
  return {
    type: values.type ? undefined : 'Elige qué quieres pedir',
    starts_on: dateError(values.starts_on, 'Elige el primer día') ?? past,
    ends_on: dateError(values.ends_on, 'Elige el último día') ?? rangeError(values.starts_on, values.ends_on),
  };
}

/** Al elegir el primer día, el último lo sigue si aún no hay o quedó antes (un solo día, por omisión). */
function followEnd(endsOn: string, startsOn: string): string {
  return parseIso(startsOn) && (!endsOn || endsOn < startsOn) ? startsOn : endsOn;
}

// Errores del servidor llevados a su campo: tipo que no se puede pedir, fechas pasadas o encimadas.
const serverErrors = (error: unknown) =>
  fieldErrorsFrom<AbsenceRequestValues>(error, { DAY_OFF_TYPE_NOT_REQUESTABLE: 'type', DAY_OFF_TYPE_INVALID: 'type', ABSENCE_IN_PAST: 'starts_on', ABSENCE_OVERLAP: 'starts_on' });

/** Cuántos días son (ambos incluidos), cuando las dos fechas están completas y en orden. */
function rangeHint(values: AbsenceRequestValues): string {
  if (!parseIso(values.starts_on) || !parseIso(values.ends_on) || values.ends_on < values.starts_on) return 'El mismo día si es solo uno.';
  const days = spanDays(values.starts_on, values.ends_on);
  return days === 1 ? 'Es 1 día.' : `Son ${daysText(days)} (ambos incluidos).`;
}

function AbsenceRequestForm({ types }: { types: DayOffTypeItem[] }) {
  const navigate = useNavigate();
  const { nameOf } = useCatalogs();
  const today = businessToday();
  const form = useFormState<AbsenceRequestValues>({ type: types.length === 1 ? types[0].code : '', starts_on: '', ends_on: '', note: '' }, { serverErrors });
  const send = useEmployeeRequest(form, paths.employee.daysOff);
  const { values } = form;
  const clientErrors = validateAbsenceRequest(values, today);
  const errors = form.visibleErrors(clientErrors);
  const firstDay = parseIso(values.starts_on) ? values.starts_on : today;
  const back = () => void navigate(paths.employee.daysOff);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    send(
      clientErrors,
      () => calendarService.requestAbsence({ type: values.type, starts_on: values.starts_on, ends_on: values.ends_on, note: values.note }),
      () => ({
        title: `¿Pedir ${nameOf('day_off_types', values.type).toLowerCase()}?`,
        details: absenceFacts({ ...values, days: spanDays(values.starts_on, values.ends_on) }, nameOf('day_off_types', values.type)),
        done: 'Aquí verás si la aprueba; mientras tanto la puedes cancelar.',
      }),
    );
  };

  return (
    <Panel onSubmit={onSubmit}>
      <PanelHeader title="Solicitar vacaciones o permiso" subtitle="Tu empresa revisa la solicitud y decide si la aprueba." backTo={paths.employee.daysOff} backLabel="Mis días libres" />
      <PanelSection title="¿Qué pides?" icon={<TreePalm size={20} />}>
        <ChoiceGroup label="Tipo" radio className="absence-types" disabled={form.saving} error={errors.type}>
          {types.map((type) => {
            const Icon = dayOffIcon(type.code);
            return (
              <RadioCard
                key={type.code}
                name="type"
                value={type.code}
                checked={values.type === type.code}
                title={type.name}
                icon={<Icon size={20} />}
                onChange={(code) => form.setValues({ ...values, type: code })}
              />
            );
          })}
        </ChoiceGroup>
      </PanelSection>
      <PanelSection title="¿Cuándo?" icon={<CalendarDays size={20} />}>
        <div className="form-grid">
          <DateField
            label="Desde"
            name="starts_on"
            value={values.starts_on}
            min={today}
            openTo={today}
            required
            disabled={form.saving}
            error={errors.starts_on}
            hint="Desde hoy en adelante."
            onChange={(starts_on) => form.setValues({ ...values, starts_on, ends_on: followEnd(values.ends_on, starts_on) })}
          />
          <DateField
            label="Hasta"
            name="ends_on"
            value={values.ends_on}
            min={firstDay}
            openTo={firstDay}
            required
            disabled={form.saving}
            error={errors.ends_on}
            hint={rangeHint(values)}
            onChange={(ends_on) => form.setValues({ ...values, ends_on })}
          />
        </div>
      </PanelSection>
      <PanelSection title="Nota para tu empresa" icon={<MessageSquareText size={20} />}>
        <TextAreaField
          label="Nota (opcional)"
          maxLength={500}
          disabled={form.saving}
          value={values.note}
          placeholder="Por ejemplo: viaje familiar ya pagado."
          hint="Tu empresa la verá al revisar la solicitud."
          onChange={(note) => form.setValues({ ...values, note })}
        />
      </PanelSection>
      <FormFooter submitLabel="Enviar solicitud" submitIcon={<Send size={18} />} saving={form.saving} onCancel={back} />
    </Panel>
  );
}

/**
 * Pedir vacaciones o un permiso (/employee/attendance/days-off/new): el tipo (solo los del catálogo
 * day_off_types que el empleado puede pedir), del primer al último día (desde hoy) y una nota. Queda
 * pendiente hasta que la empresa decida; al enviarla vuelve a "Mis días libres".
 */
export function AbsenceRequestFormPage() {
  const { active } = useCatalogs();
  const types = active('day_off_types').filter((type) => type.requestable);
  if (!types.length) {
    return (
      <div className="page">
        <Panel>
          <PanelHeader title="Solicitar vacaciones o permiso" backTo={paths.employee.daysOff} backLabel="Mis días libres" />
          <PanelSection>
            <EmptyState
              icon={<CalendarOff />}
              title="Por ahora no puedes pedir días desde aquí"
              description="Tu empresa registra tus vacaciones y permisos directamente: pídeselos a tu responsable."
              action={
                <ButtonLink to={paths.employee.daysOff} variant="secondary">
                  Volver
                </ButtonLink>
              }
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }
  return (
    <div className="page">
      <AbsenceRequestForm types={types} />
    </div>
  );
}
