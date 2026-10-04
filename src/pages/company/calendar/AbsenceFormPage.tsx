import { CalendarOff, CalendarPlus, Users } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { bulkResultMessage } from '../../../components/BulkResultSummary';
import { absenceFacts, calendarPath, dateError, daysText, rangeError, spanDays } from '../../../components/calendar/calendarRules';
import { describeEmployees, EmployeePicker } from '../../../components/employees/EmployeePicker';
import { TextAreaField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { SelectField } from '../../../components/shifts/formFields';
import { DateField, parseIso } from '../../../components/ui/DateField';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useFeedback } from '../../../hooks/useFeedback';
import { useFormState } from '../../../hooks/useFormState';
import { notifyAbsenceRequestsChanged } from '../../../hooks/usePendingAbsenceRequests';
import { fieldErrorsFrom } from '../../../services/apiClient';
import { calendarService } from '../../../services/calendarService';

/** Lo que se captura además de los empleados (que se eligen con `EmployeePicker`). */
interface AbsenceFormValues {
  type: string;
  starts_on: string;
  ends_on: string;
  note: string;
}

const NOTE_MAX = 500;
const EMPTY: AbsenceFormValues = { type: '', starts_on: '', ends_on: '', note: '' };
const COPY = { title: 'Ausencia registrada', done: 'Registrada', unchanged: 'Ya la tenían', skipped: 'No se registró' };

/** Reglas de la ausencia (solo UX: el backend vuelve a validar todo, también el tipo y los empleados; la nota la limita su campo). */
export function absenceErrors(values: AbsenceFormValues, employees: number): Partial<Record<keyof AbsenceFormValues | 'employee_ids', string>> {
  return {
    employee_ids: employees ? undefined : 'Elige al menos un empleado',
    type: values.type ? undefined : 'Elige el tipo de ausencia',
    starts_on: dateError(values.starts_on, 'Elige el primer día'),
    ends_on: dateError(values.ends_on, 'Elige el último día') ?? rangeError(values.starts_on, values.ends_on),
  };
}

const serverErrors = (error: unknown) => fieldErrorsFrom<AbsenceFormValues>(error, { DAY_OFF_TYPE_INVALID: 'type' });

/**
 * Registrar una ausencia (/company/calendar/absences/new): vacaciones, permiso, incapacidad u otro
 * día libre para uno o varios empleados a la vez (vacaciones colectivas). Queda aprobada; el resultado
 * dice a quién se registró, quién ya la tenía y a quién no (inactivo o se encima con otra ausencia).
 */
export function AbsenceFormPage() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { active, byCode, nameOf } = useCatalogs();
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const form = useFormState<AbsenceFormValues>(EMPTY, { serverErrors });
  const { values } = form;
  const clientErrors = absenceErrors(values, employeeIds.length);
  const errors = form.visibleErrors(clientErrors);
  const back = () => void navigate(calendarPath('absences'));
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
      clientErrors,
      async () => {
        const result = await calendarService.createAbsences({ ...values, employee_ids: employeeIds });
        notifyAbsenceRequestsChanged();
        void feedback.show(bulkResultMessage(result, COPY));
        back();
      },
      'No se pudo registrar la ausencia',
      () => {
        const kind = nameOf('day_off_types', values.type);
        const many = employeeIds.length > 1;
        return {
          kind: 'create',
          icon: <CalendarOff size={30} />,
          eyebrow: many ? 'Ausencia colectiva' : 'Ausencia',
          title: many ? `¿Registrar ${kind.toLowerCase()} a ${employeeIds.length} empleados?` : `¿Registrar ${kind.toLowerCase()}?`,
          message: 'Queda aprobada: esos días no tienen que checar. A quien esté inactivo o ya tenga otra ausencia esos días no se le registra (el resultado lo dice).',
          details: [describeEmployees(employeeIds.length, names), ...absenceFacts({ ...values, days: spanDays(values.starts_on, values.ends_on) }, kind)],
          confirmLabel: 'Registrar ausencia',
          confirmIcon: <CalendarPlus size={18} />,
        };
      },
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title="Registrar ausencia" subtitle="Vacaciones, permiso o incapacidad de uno o varios empleados: esos días no tienen que checar." backTo={calendarPath('absences')} backLabel="Calendario" />
        <PanelSection title="Empleados" icon={<Users size={20} />}>
          <EmployeePicker
            value={employeeIds}
            onChange={(ids, known) => {
              setEmployeeIds(ids);
              setNames(known);
            }}
            disabled={form.saving}
            error={submitted ? clientErrors.employee_ids : undefined}
            hint="Elige a varios para unas vacaciones colectivas: a cada uno se le registra la misma ausencia."
          />
        </PanelSection>
        <PanelSection title="Ausencia" icon={<CalendarOff size={20} />}>
          <div className="stack">
            <SelectField
              label="Tipo"
              required
              value={values.type}
              placeholder="Elige el tipo"
              options={active('day_off_types').map((item) => ({ value: item.code, label: item.name, description: item.description ?? undefined }))}
              disabled={form.saving}
              error={errors.type}
              hint={type?.description ?? undefined}
              onChange={(next) => form.setValues({ ...values, type: next })}
            />
            <div className="form-grid">
              <DateField label="Primer día" name="starts_on" required value={values.starts_on} disabled={form.saving} error={errors.starts_on} onChange={(value) => setDate('starts_on', value)} />
              <DateField
                label="Último día"
                name="ends_on"
                required
                value={values.ends_on}
                min={parseIso(values.starts_on) ? values.starts_on : undefined}
                openTo={values.starts_on || undefined}
                disabled={form.saving}
                error={errors.ends_on}
                hint={range ? `${daysText(range)}, ambos incluidos` : 'Ambos días se incluyen.'}
                onChange={(value) => setDate('ends_on', value)}
              />
            </div>
            <TextAreaField
              label="Nota (opcional)"
              maxLength={NOTE_MAX}
              disabled={form.saving}
              value={values.note}
              error={errors.note}
              placeholder="P. ej. vacaciones de fin de año o el folio de la incapacidad"
              onBlur={() => form.touch('note')}
              onChange={(note) => form.setValues({ ...values, note })}
            />
          </div>
        </PanelSection>
        <FormFooter submitLabel="Registrar ausencia" submitIcon={<CalendarPlus size={20} />} saving={form.saving} onCancel={back} />
      </Panel>
    </div>
  );
}
