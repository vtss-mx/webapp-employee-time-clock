import { CalendarDays, CalendarOff, MessageSquareText, Send, TreePalm } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { dayOffIcon } from '../../../components/attendance/employee/DayOffCard';
import { useEmployeeRequest } from '../../../components/attendance/employee/useEmployeeRequest';
import { absenceFacts, dateError, rangeError, spanDays } from '../../../components/calendar/calendarRules';
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
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { calendarService } from '../../../services/calendarService';
import { fieldErrorsFrom } from '../../../services/http/envelope';
import type { DayOffTypeItem } from '../../../types';
import { businessToday } from '../../../utils/format';
import { inSentence } from '../../../utils/text';

interface AbsenceRequestValues {
  type: string;
  starts_on: string;
  ends_on: string;
  note: string;
}

type AbsenceErrors = Partial<Record<keyof AbsenceRequestValues, string>>;

/**
 * Reglas del formulario (solo UX: el backend las vuelve a validar): las del calendario (fechas reales,
 * en orden y de hasta un año) y que se pida desde hoy. En el idioma activo.
 */
export function validateAbsenceRequest(values: AbsenceRequestValues, today: string): AbsenceErrors {
  const past = values.starts_on < today ? t('myAttendance.absenceForm.errors.past') : undefined;
  return {
    type: values.type ? undefined : t('myAttendance.absenceForm.errors.type'),
    starts_on: dateError(values.starts_on, t('myAttendance.absenceForm.errors.firstDay')) ?? past,
    ends_on: dateError(values.ends_on, t('myAttendance.absenceForm.errors.lastDay')) ?? rangeError(values.starts_on, values.ends_on),
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
  if (!parseIso(values.starts_on) || !parseIso(values.ends_on) || values.ends_on < values.starts_on) return t('myAttendance.absenceForm.sameDay');
  return t('myAttendance.absenceForm.span', { count: spanDays(values.starts_on, values.ends_on) });
}

/** Lo que se confirma y se avisa al pedir los días (se arma al dibujarse: sigue al idioma activo). */
function absenceRequestSummary(values: AbsenceRequestValues, typeName: string) {
  return {
    title: t('myAttendance.absenceForm.confirm.title', { type: inSentence(typeName) }),
    details: absenceFacts({ ...values, days: spanDays(values.starts_on, values.ends_on) }, typeName),
    done: t('myAttendance.absenceForm.confirm.done'),
  };
}

function AbsenceRequestForm({ types }: { types: DayOffTypeItem[] }) {
  const t = useT();
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
      () => validateAbsenceRequest(values, today),
      () => calendarService.requestAbsence({ type: values.type, starts_on: values.starts_on, ends_on: values.ends_on, note: values.note }),
      () => absenceRequestSummary(values, nameOf('day_off_types', values.type)),
    );
  };

  return (
    <Panel onSubmit={onSubmit}>
      <PanelHeader
        title={t('myAttendance.daysOff.request')}
        subtitle={t('myAttendance.request.subtitle')}
        backTo={paths.employee.daysOff}
        backLabel={t('myAttendance.home.daysOff')}
      />
      <PanelSection title={t('myAttendance.absenceForm.whatSection')} icon={<TreePalm size={20} />}>
        <ChoiceGroup label={t('myAttendance.absenceForm.type')} radio className="absence-types" disabled={form.saving} error={errors.type}>
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
      <PanelSection title={t('myAttendance.absenceForm.whenSection')} icon={<CalendarDays size={20} />}>
        <div className="form-grid">
          <DateField
            label={t('myAttendance.labels.from')}
            name="starts_on"
            value={values.starts_on}
            min={today}
            openTo={today}
            required
            disabled={form.saving}
            error={errors.starts_on}
            hint={t('myAttendance.absenceForm.fromHint')}
            onChange={(starts_on) => form.setValues({ ...values, starts_on, ends_on: followEnd(values.ends_on, starts_on) })}
          />
          <DateField
            label={t('myAttendance.labels.to')}
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
      <PanelSection title={t('myAttendance.absenceForm.noteSection')} icon={<MessageSquareText size={20} />}>
        <TextAreaField
          label={t('myAttendance.absenceForm.noteLabel')}
          maxLength={500}
          disabled={form.saving}
          value={values.note}
          placeholder={t('myAttendance.absenceForm.notePlaceholder')}
          hint={t('myAttendance.absenceForm.noteHint')}
          onChange={(note) => form.setValues({ ...values, note })}
        />
      </PanelSection>
      <FormFooter submitLabel={t('myAttendance.request.send')} submitIcon={<Send size={18} />} saving={form.saving} onCancel={back} />
    </Panel>
  );
}

/**
 * Pedir vacaciones o un permiso (/employee/attendance/days-off/new): el tipo (solo los del catálogo
 * day_off_types que el empleado puede pedir), del primer al último día (desde hoy) y una nota. Queda
 * pendiente hasta que la empresa decida; al enviarla vuelve a "Mis días libres".
 */
export function AbsenceRequestFormPage() {
  const t = useT();
  const { active } = useCatalogs();
  const types = active('day_off_types').filter((type) => type.requestable);
  if (!types.length) {
    return (
      <div className="page">
        <Panel>
          <PanelHeader title={t('myAttendance.daysOff.request')} backTo={paths.employee.daysOff} backLabel={t('myAttendance.home.daysOff')} />
          <PanelSection>
            <EmptyState
              icon={<CalendarOff />}
              title={t('myAttendance.absenceForm.unavailable.title')}
              description={t('myAttendance.absenceForm.unavailable.description')}
              action={
                <ButtonLink to={paths.employee.daysOff} variant="secondary">
                  {t('common.actions.back')}
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
