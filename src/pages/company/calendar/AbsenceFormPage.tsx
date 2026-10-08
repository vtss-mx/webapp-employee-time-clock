import { CalendarOff, CalendarPlus, Users } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { bulkResultMessage } from '../../../components/BulkResultSummary';
import { absenceFacts, dateError, daysText, rangeError, spanDays } from '../../../components/calendar/calendarRules';
import { describeEmployees, EmployeePicker } from '../../../components/employees/EmployeePicker';
import { TextAreaField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { SelectField } from '../../../components/shifts/formFields';
import { DateField, parseIso } from '../../../components/ui/DateField';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useCalendarReturn } from '../../../hooks/useCalendarReturn';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useFeedback } from '../../../hooks/useFeedback';
import { useFormState } from '../../../hooks/useFormState';
import { notifyAbsenceRequestsChanged } from '../../../hooks/usePendingAbsenceRequests';
import { t, useT } from '../../../i18n';
import { fieldErrorsFrom } from '../../../services/apiClient';
import { calendarService } from '../../../services/calendarService';
import type { BulkResult } from '../../../types';
import type { ConfirmInput } from '../../../types/confirm';
import { inSentence } from '../../../utils/text';

/** Lo que se captura además de los empleados (que se eligen con `EmployeePicker`). */
interface AbsenceFormValues {
  type: string;
  starts_on: string;
  ends_on: string;
  note: string;
}

const NOTE_MAX = 500;
const EMPTY: AbsenceFormValues = { type: '', starts_on: '', ends_on: '', note: '' };
/** Textos del resultado por empleado (en el idioma activo). */
const resultCopy = () => ({
  title: t('calendar.absenceForm.result.title'),
  done: t('calendar.absenceForm.result.done'),
  unchanged: t('calendar.absenceForm.result.unchanged'),
  skipped: t('calendar.absenceForm.result.skipped'),
});

/** Reglas de la ausencia (solo UX: el backend vuelve a validar todo, también el tipo y los empleados; la nota la limita su campo). */
export function absenceErrors(values: AbsenceFormValues, employees: number): Partial<Record<keyof AbsenceFormValues | 'employee_ids', string>> {
  return {
    employee_ids: employees ? undefined : t('calendar.absenceForm.validation.employees'),
    type: values.type ? undefined : t('calendar.absenceForm.validation.type'),
    starts_on: dateError(values.starts_on, t('calendar.absenceForm.validation.firstDay')),
    ends_on: dateError(values.ends_on, t('calendar.absenceForm.validation.lastDay')) ?? rangeError(values.starts_on, values.ends_on),
  };
}

const serverErrors = (error: unknown) => fieldErrorsFrom<AbsenceFormValues>(error, { DAY_OFF_TYPE_INVALID: 'type' });

/**
 * Lo que se registra: a quiénes, el tipo, las fechas con sus días y la nota (se arma al dibujarse:
 * la confirmación abierta sigue al idioma activo). `kind` es el nombre del tipo (catálogo).
 */
function absenceConfirm(values: AbsenceFormValues, employeeIds: number[], names: string[], kind: string): ConfirmInput {
  const many = employeeIds.length > 1;
  const type = inSentence(kind);
  return {
    kind: 'create',
    icon: <CalendarOff size={30} />,
    eyebrow: t(many ? 'calendar.absenceForm.confirm.eyebrowMany' : 'calendar.absenceForm.confirm.eyebrow'),
    title: many ? t('calendar.absenceForm.confirm.titleMany', { kind: type, total: employeeIds.length }) : t('calendar.absenceForm.confirm.title', { kind: type }),
    message: t('calendar.absenceForm.confirm.message'),
    details: [describeEmployees(employeeIds.length, names), ...absenceFacts({ ...values, days: spanDays(values.starts_on, values.ends_on) }, kind)],
    confirmLabel: t('calendar.absences.create'),
    confirmIcon: <CalendarPlus size={18} />,
  };
}

const saveError = () => t('calendar.absenceForm.error');
const resultMessage = (result: BulkResult) => () => bulkResultMessage(result, resultCopy());

/**
 * Registrar una ausencia (/company/calendar/absences/new): vacaciones, permiso, incapacidad u otro
 * día libre para uno o varios empleados a la vez (vacaciones colectivas). Queda aprobada; el resultado
 * dice a quién se registró, quién ya la tenía y a quién no (inactivo o se encima con otra ausencia).
 * Abierta desde un día del calendario (`?date=`), empieza y termina ese día y regresa a él.
 */
export function AbsenceFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { active, byCode, nameOf } = useCatalogs();
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const { day, backTo } = useCalendarReturn('absences');
  const form = useFormState<AbsenceFormValues>(day ? { ...EMPTY, starts_on: day, ends_on: day } : EMPTY, { serverErrors });
  const { values } = form;
  const clientErrors = absenceErrors(values, employeeIds.length);
  const errors = form.visibleErrors(clientErrors);
  const back = () => void navigate(backTo);
  const type = byCode('day_off_types', values.type);
  const range = parseIso(values.starts_on) && parseIso(values.ends_on) && !rangeError(values.starts_on, values.ends_on) ? spanDays(values.starts_on, values.ends_on) : null;
  // Una fecha completa marca el campo: el orden del rango se revisa en cuanto hay dos fechas.
  const setDate = (field: 'starts_on' | 'ends_on', value: string) => {
    form.setValues({ ...values, [field]: value });
    if (parseIso(value)) form.touch(field);
  };

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    setSubmitted(true);
    form.saveIfValid(
      () => absenceErrors(values, employeeIds.length),
      async () => {
        const result = await calendarService.createAbsences({ ...values, employee_ids: employeeIds });
        notifyAbsenceRequestsChanged();
        void feedback.show(resultMessage(result));
        back();
      },
      saveError,
      () => absenceConfirm(values, employeeIds, names, nameOf('day_off_types', values.type)),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title={t('calendar.absences.create')} subtitle={t('calendar.absenceForm.subtitle')} backTo={backTo} backLabel={t('calendar.page.title')} />
        <PanelSection title={t('calendar.absenceForm.employees')} icon={<Users size={20} />}>
          <EmployeePicker
            value={employeeIds}
            onChange={(ids, known) => {
              setEmployeeIds(ids);
              setNames(known);
            }}
            disabled={form.saving}
            error={submitted ? clientErrors.employee_ids : undefined}
            hint={t('calendar.absenceForm.employeesHint')}
          />
        </PanelSection>
        <PanelSection title={t('calendar.absenceForm.section')} icon={<CalendarOff size={20} />}>
          <div className="stack">
            <SelectField
              label={t('calendar.fields.type')}
              required
              value={values.type}
              placeholder={t('calendar.absenceForm.typePlaceholder')}
              options={active('day_off_types').map((item) => ({ value: item.code, label: item.name, description: item.description ?? undefined }))}
              disabled={form.saving}
              error={errors.type}
              hint={type?.description ?? undefined}
              onChange={(next) => form.setValues({ ...values, type: next })}
            />
            <div className="form-grid">
              <DateField label={t('calendar.absenceForm.firstDay')} name="starts_on" required value={values.starts_on} disabled={form.saving} error={errors.starts_on} onChange={(value) => setDate('starts_on', value)} />
              <DateField
                label={t('calendar.absenceForm.lastDay')}
                name="ends_on"
                required
                value={values.ends_on}
                min={parseIso(values.starts_on) ? values.starts_on : undefined}
                openTo={values.starts_on || undefined}
                disabled={form.saving}
                error={errors.ends_on}
                hint={range ? t('calendar.absenceForm.rangeHint', { days: daysText(range) }) : t('calendar.absenceForm.bothIncluded')}
                onChange={(value) => setDate('ends_on', value)}
              />
            </div>
            <TextAreaField
              label={t('calendar.fields.noteOptional')}
              maxLength={NOTE_MAX}
              disabled={form.saving}
              value={values.note}
              error={errors.note}
              placeholder={t('calendar.absenceForm.notePlaceholder')}
              onBlur={() => form.touch('note')}
              onChange={(note) => form.setValues({ ...values, note })}
            />
          </div>
        </PanelSection>
        <FormFooter submitLabel={t('calendar.absences.create')} submitIcon={<CalendarPlus size={20} />} saving={form.saving} onCancel={back} />
      </Panel>
    </div>
  );
}
