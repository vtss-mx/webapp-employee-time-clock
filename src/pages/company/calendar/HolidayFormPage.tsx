import { CalendarHeart, CalendarPlus, PartyPopper } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { calendarPath, dateError, longDate } from '../../../components/calendar/calendarRules';
import { FormField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { DateField, parseIso } from '../../../components/ui/DateField';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useFeedback } from '../../../hooks/useFeedback';
import { useFormState } from '../../../hooks/useFormState';
import { fieldErrorsFrom } from '../../../services/apiClient';
import { calendarService } from '../../../services/calendarService';
import type { HolidayPayload } from '../../../types';

/** Largo del nombre (el mismo del backend). */
const NAME_MAX = 120;

/** Reglas del festivo (solo UX: el backend las vuelve a validar y no admite dos el mismo día). */
export function holidayErrors(values: HolidayPayload): Partial<Record<keyof HolidayPayload, string>> {
  const name = values.name.trim();
  return {
    holiday_date: dateError(values.holiday_date, 'Elige el día festivo'),
    name: name.length < 2 ? 'Escribe el nombre del festivo (al menos 2 letras)' : undefined,
  };
}

const serverErrors = (error: unknown) => fieldErrorsFrom<HolidayPayload>(error);

/**
 * Agregar un día festivo propio de la empresa (/company/calendar/holidays/new; `?date=` lo deja
 * elegido desde el calendario). Ese día nadie tiene que checar, salvo quien tenga un día laborable
 * especial.
 */
export function HolidayFormPage() {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const preset = useSearchParams()[0].get('date') ?? '';
  const form = useFormState<HolidayPayload>({ holiday_date: parseIso(preset) ? preset : '', name: '' }, { serverErrors });
  const { values } = form;
  const clientErrors = holidayErrors(values);
  const errors = form.visibleErrors(clientErrors);
  const back = () => void navigate(calendarPath('holidays'));

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    form.saveIfValid(
      clientErrors,
      async () => {
        const saved = await calendarService.createHoliday(values);
        void feedback.success('Día festivo agregado', `${saved.name}: ${longDate(saved.holiday_date)}. Ese día nadie tiene que checar.`);
        back();
      },
      'No se pudo agregar el día festivo',
      () => ({
        kind: 'create',
        icon: <CalendarHeart size={30} />,
        eyebrow: 'Día festivo',
        title: `¿Agregar ${values.name.trim()} como día festivo?`,
        message: 'Es un día de descanso para toda la empresa: nadie tiene que checar, salvo quien tenga un día laborable especial.',
        details: [
          { label: 'Fecha', value: longDate(values.holiday_date) },
          { label: 'Nombre', value: values.name.trim() },
        ],
        confirmLabel: 'Agregar festivo',
        confirmIcon: <CalendarPlus size={18} />,
      }),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader title="Agregar día festivo" subtitle="Un día de descanso para toda la empresa: aniversario, fiesta local, puente…" backTo={calendarPath('holidays')} backLabel="Calendario" />
        <PanelSection title="Día festivo" icon={<CalendarHeart size={20} />}>
          <div className="stack">
            <DateField
              label="Fecha"
              name="holiday_date"
              required
              value={values.holiday_date}
              disabled={form.saving}
              error={errors.holiday_date}
              hint="Los festivos oficiales del año se agregan con un botón en el calendario."
              onChange={(holiday_date) => form.setValues({ ...values, holiday_date })}
            />
            <FormField
              label="Nombre"
              icon={<PartyPopper size={18} />}
              required
              maxLength={NAME_MAX}
              disabled={form.saving}
              value={values.name}
              error={errors.name}
              placeholder="Aniversario de la empresa"
              onBlur={() => form.touch('name')}
              onChange={(event) => form.setValues({ ...values, name: event.target.value })}
            />
          </div>
        </PanelSection>
        <FormFooter submitLabel="Agregar festivo" submitIcon={<CalendarPlus size={20} />} saving={form.saving} onCancel={back} />
      </Panel>
    </div>
  );
}
