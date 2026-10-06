import { CalendarCheck, CalendarDays, UserRound } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarPath, dateError, inlineDate, longDate } from '../../../components/calendar/calendarRules';
import { describeEmployees, EmployeePicker } from '../../../components/employees/EmployeePicker';
import { TextAreaField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { DateField } from '../../../components/ui/DateField';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useFeedback } from '../../../hooks/useFeedback';
import { useFormState } from '../../../hooks/useFormState';
import { t, useT } from '../../../i18n';
import { fieldErrorsFrom } from '../../../services/apiClient';
import { calendarService } from '../../../services/calendarService';
import type { Workday } from '../../../types';
import type { ConfirmInput } from '../../../types/confirm';
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
  const date = dateError(values.work_date, t('calendar.workdayForm.validation.date'));
  return {
    employee_id: values.employee_id ? undefined : t('calendar.workdayForm.validation.employee'),
    work_date: date ?? (values.work_date < today ? t('calendar.workdayForm.validation.past') : undefined),
  };
}

const serverErrors = (error: unknown) => fieldErrorsFrom<WorkdayFormValues>(error, { EMPLOYEE_NOT_FOUND: 'employee_id' });

/** Lo que se agrega: la persona, el día y la nota (se arma al dibujarse: sigue al idioma activo). */
function workdayConfirm(values: WorkdayFormValues, names: string[]): ConfirmInput {
  const note = values.note.trim();
  return {
    kind: 'create',
    icon: <CalendarCheck size={30} />,
    eyebrow: t('calendar.workdayForm.confirm.eyebrow'),
    title: t('calendar.workdayForm.confirm.title'),
    message: t('calendar.workdayForm.confirm.message'),
    details: [describeEmployees(1, names), { label: t('calendar.workdayForm.workDate'), value: longDate(values.work_date) }, ...(note ? [{ label: t('common.fields.note'), value: note }] : [])],
    confirmLabel: t('calendar.workdays.create'),
    confirmIcon: <CalendarCheck size={18} />,
  };
}

const saveError = () => t('calendar.workdayForm.error');
const savedTitle = () => t('calendar.workdayForm.done');
const savedText = (saved: Workday) => () => t('calendar.workdayForm.doneText', { name: saved.employee.full_name, date: inlineDate(saved.work_date) });

/**
 * Agregar un día laborable especial (/company/calendar/workdays/new): una persona trabaja un día que
 * para ella sería libre (un festivo o un día dentro de su ausencia). Ese día sí checa.
 */
export function WorkdayFormPage() {
  const t = useT();
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
      () => workdayErrors(values, today),
      async () => {
        const saved = await calendarService.createWorkday({ employee_id: Number(values.employee_id), work_date: values.work_date, note: values.note });
        void feedback.success(savedTitle, savedText(saved));
        back();
      },
      saveError,
      () => workdayConfirm(values, names),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title={t('calendar.workdays.create')} subtitle={t('calendar.workdayForm.subtitle')} backTo={calendarPath('workdays')} backLabel={t('calendar.page.title')} />
        <PanelSection title={t('common.fields.employee')} icon={<UserRound size={20} />}>
          <EmployeePicker
            single
            label={t('common.fields.employee')}
            value={values.employee_id ? [Number(values.employee_id)] : []}
            onChange={(ids, known) => {
              form.setValues({ ...values, employee_id: ids.length ? String(ids[0]) : '' });
              setNames(known);
              form.touch('employee_id');
            }}
            disabled={form.saving}
            error={errors.employee_id}
            hint={t('calendar.workdayForm.employeeHint')}
          />
        </PanelSection>
        <PanelSection title={t('calendar.fields.day')} icon={<CalendarDays size={20} />}>
          <div className="stack">
            <DateField
              label={t('calendar.workdayForm.workDate')}
              name="work_date"
              required
              min={today}
              value={values.work_date}
              disabled={form.saving}
              error={errors.work_date}
              hint={t('calendar.workdayForm.dateHint')}
              onChange={(work_date) => form.setValues({ ...values, work_date })}
            />
            <TextAreaField
              label={t('calendar.fields.noteOptional')}
              maxLength={NOTE_MAX}
              disabled={form.saving}
              value={values.note}
              placeholder={t('calendar.workdayForm.notePlaceholder')}
              onChange={(note) => form.setValues({ ...values, note })}
            />
          </div>
        </PanelSection>
        <FormFooter submitLabel={t('calendar.workdays.create')} submitIcon={<CalendarCheck size={20} />} saving={form.saving} onCancel={back} />
      </Panel>
    </div>
  );
}
