import { CalendarHeart, CalendarPlus, PartyPopper } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarDayPath, dateError, longDate } from '../../../components/calendar/calendarRules';
import { FormField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { DateField } from '../../../components/ui/DateField';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useCalendarReturn } from '../../../hooks/useCalendarReturn';
import { useFeedback } from '../../../hooks/useFeedback';
import { useFormState } from '../../../hooks/useFormState';
import { t, useT } from '../../../i18n';
import { fieldErrorsFrom } from '../../../services/apiClient';
import { calendarService } from '../../../services/calendarService';
import type { Holiday, HolidayPayload } from '../../../types';
import type { ConfirmInput } from '../../../types/confirm';

/** Largo del nombre (el mismo del backend). */
const NAME_MAX = 120;

/** Reglas del festivo (solo UX: el backend las vuelve a validar y no admite dos el mismo día). */
export function holidayErrors(values: HolidayPayload): Partial<Record<keyof HolidayPayload, string>> {
  const name = values.name.trim();
  return {
    holiday_date: dateError(values.holiday_date, t('calendar.holidayForm.validation.date')),
    name: name.length < 2 ? t('calendar.holidayForm.validation.name') : undefined,
  };
}

const serverErrors = (error: unknown) => fieldErrorsFrom<HolidayPayload>(error);

/** Lo que se agrega: la fecha y el nombre (se arma al dibujarse: sigue al idioma activo). */
function holidayConfirm(values: HolidayPayload): ConfirmInput {
  const name = values.name.trim();
  return {
    kind: 'create',
    icon: <CalendarHeart size={30} />,
    eyebrow: t('calendar.holidayForm.confirm.eyebrow'),
    title: t('calendar.holidayForm.confirm.title', { name }),
    message: t('calendar.holidayForm.confirm.message'),
    details: [
      { label: t('common.fields.date'), value: longDate(values.holiday_date) },
      { label: t('common.fields.name'), value: name },
    ],
    confirmLabel: t('calendar.holidayForm.submit'),
    confirmIcon: <CalendarPlus size={18} />,
  };
}

const saveError = () => t('calendar.holidayForm.error');
const savedTitle = () => t('calendar.holidayForm.done');
const savedText = (saved: Holiday) => () => t('calendar.holidayForm.doneText', { name: saved.name, date: longDate(saved.holiday_date) });

/**
 * Agregar un día festivo propio de la empresa (/company/calendar/holidays/new; `?date=` lo deja
 * elegido desde el calendario y "Cancelar" regresa a ese día). Ese día nadie tiene que checar, salvo
 * quien tenga un día laborable especial. Al guardar, el calendario muestra el festivo nuevo.
 */
export function HolidayFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { day, backTo } = useCalendarReturn('holidays');
  const form = useFormState<HolidayPayload>({ holiday_date: day ?? '', name: '' }, { serverErrors });
  const { values } = form;
  const clientErrors = holidayErrors(values);
  const errors = form.visibleErrors(clientErrors);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    form.saveIfValid(
      () => holidayErrors(values),
      async () => {
        const saved = await calendarService.createHoliday(values);
        void feedback.success(savedTitle, savedText(saved));
        // El calendario regresa con el festivo nuevo elegido (su mes a la vista).
        void navigate(calendarDayPath(saved.holiday_date));
      },
      saveError,
      () => holidayConfirm(values),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title={t('calendar.holidayForm.title')} subtitle={t('calendar.holidayForm.subtitle')} backTo={backTo} backLabel={t('calendar.page.title')} />
        <PanelSection title={t('calendar.holidayForm.section')} icon={<CalendarHeart size={20} />}>
          <div className="stack">
            <DateField
              label={t('common.fields.date')}
              name="holiday_date"
              required
              value={values.holiday_date}
              disabled={form.saving}
              error={errors.holiday_date}
              hint={t('calendar.holidayForm.dateHint')}
              onChange={(holiday_date) => form.setValues({ ...values, holiday_date })}
            />
            <FormField
              label={t('common.fields.name')}
              icon={<PartyPopper size={18} />}
              required
              maxLength={NAME_MAX}
              disabled={form.saving}
              value={values.name}
              error={errors.name}
              placeholder={t('calendar.holidayForm.namePlaceholder')}
              onBlur={() => form.touch('name')}
              onChange={(event) => form.setValues({ ...values, name: event.target.value })}
            />
          </div>
        </PanelSection>
        <FormFooter submitLabel={t('calendar.holidayForm.submit')} submitIcon={<CalendarPlus size={20} />} saving={form.saving} onCancel={() => void navigate(backTo)} />
      </Panel>
    </div>
  );
}
