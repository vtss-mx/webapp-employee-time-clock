import { CalendarCheck, CalendarDays, UserRound } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarPath, dateError, longDate } from '../../../components/calendar/calendarRules';
import { describeEmployees, EmployeePicker } from '../../../components/employees/EmployeePicker';
import { TextAreaField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { DateField } from '../../../components/ui/DateField';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useFeedback } from '../../../hooks/useFeedback';
import { useFormState } from '../../../hooks/useFormState';
import { fieldErrorsFrom } from '../../../services/apiClient';
import { calendarService } from '../../../services/calendarService';
import { businessToday } from '../../../utils/format';

/** Lo capturado: el empleado (su id como texto, vacío si no se elige), el día y la nota. */
interface WorkdayFormValues {
  employee_id: string;
  work_date: string;
  note: string;
}

const NOTE_MAX = 300;

/** Reglas del día laborable (solo UX: el backend revisa además que ese día sí sea libre para la persona). */
export function workdayErrors(values: WorkdayFormValues, today: string): Partial<Record<keyof WorkdayFormValues, string>> {
  const date = dateError(values.work_date, 'Elige el día que trabaja');
  return {
    employee_id: values.employee_id ? undefined : 'Elige al empleado',
    work_date: date ?? (values.work_date < today ? 'Elige hoy o un día futuro: un día que ya pasó no se puede volver laborable' : undefined),
  };
}

const serverErrors = (error: unknown) => fieldErrorsFrom<WorkdayFormValues>(error, { EMPLOYEE_NOT_FOUND: 'employee_id' });

/**
 * Agregar un día laborable especial (/company/calendar/workdays/new): una persona trabaja un día que
 * para ella sería libre (un festivo o un día dentro de su ausencia). Ese día sí checa.
 */
export function WorkdayFormPage() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const today = businessToday();
  const form = useFormState<WorkdayFormValues>({ employee_id: '', work_date: '', note: '' }, { serverErrors });
  // Nombre de la persona elegida (para la confirmación).
  const [names, setNames] = useState<string[]>([]);
  const { values } = form;
  const clientErrors = workdayErrors(values, today);
  const errors = form.visibleErrors(clientErrors);
  const back = () => void navigate(calendarPath('workdays'));

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    form.saveIfValid(
      clientErrors,
      async () => {
        const saved = await calendarService.createWorkday({ employee_id: Number(values.employee_id), work_date: values.work_date, note: values.note });
        void feedback.success('Día laborable agregado', `${saved.employee.full_name} trabaja el ${longDate(saved.work_date).toLowerCase()}: ese día sí checa.`);
        back();
      },
      'No se pudo agregar el día laborable',
      () => ({
        kind: 'create',
        icon: <CalendarCheck size={30} />,
        eyebrow: 'Día laborable especial',
        title: '¿Agregar el día laborable?',
        message: 'Ese día, aunque sea festivo o esté dentro de su ausencia, la persona sí trabaja y checa.',
        details: [describeEmployees(1, names), { label: 'Día que trabaja', value: longDate(values.work_date) }, ...(values.note.trim() ? [{ label: 'Nota', value: values.note.trim() }] : [])],
        confirmLabel: 'Agregar día laborable',
        confirmIcon: <CalendarCheck size={18} />,
      }),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title="Agregar día laborable" subtitle="Una persona trabaja un festivo o un día dentro de sus vacaciones o permiso." backTo={calendarPath('workdays')} backLabel="Calendario" />
        <PanelSection title="Empleado" icon={<UserRound size={20} />}>
          <EmployeePicker
            single
            label="Empleado"
            value={values.employee_id ? [Number(values.employee_id)] : []}
            onChange={(ids, known) => {
              form.setValues({ ...values, employee_id: ids.length ? String(ids[0]) : '' });
              setNames(known);
              form.touch('employee_id');
            }}
            disabled={form.saving}
            error={errors.employee_id}
            hint="Solo una persona: el día laborable es una excepción para ella."
          />
        </PanelSection>
        <PanelSection title="Día" icon={<CalendarDays size={20} />}>
          <div className="stack">
            <DateField
              label="Día que trabaja"
              name="work_date"
              required
              min={today}
              value={values.work_date}
              disabled={form.saving}
              error={errors.work_date}
              hint="Debe ser un festivo o un día dentro de una ausencia suya, de hoy en adelante."
              onChange={(work_date) => form.setValues({ ...values, work_date })}
            />
            <TextAreaField
              label="Nota (opcional)"
              maxLength={NOTE_MAX}
              disabled={form.saving}
              value={values.note}
              placeholder="P. ej. cubre la guardia del festivo"
              onChange={(note) => form.setValues({ ...values, note })}
            />
          </div>
        </PanelSection>
        <FormFooter submitLabel="Agregar día laborable" submitIcon={<CalendarCheck size={20} />} saving={form.saving} onCancel={back} />
      </Panel>
    </div>
  );
}
