import { CalendarClock, Clock, Coffee, ListChecks, LogIn, LogOut, Plus, Save, Timer, UsersRound, type LucideIcon } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { QuickChoices, SelectField } from '../../../components/shifts/formFields';
import { RecordLoader } from '../../../components/shifts/PageStates';
import { RecordStatus, type RecordStatusTexts } from '../../../components/shifts/RecordStatus';
import { BREAK_MINUTES_MAX, BREAK_MINUTES_MIN, MAX_BREAKS, SHIFT_NAME_MAX } from '../../../components/shifts/shiftRules';
import { ShiftSummary } from '../../../components/shifts/ShiftSummary';
import { TOLERANCE_LIMITS, useShiftForm, WORKWEEK, type ShiftForm } from '../../../components/shifts/useShiftForm';
import { WeekdayPicker, type WeekdayPreset } from '../../../components/shifts/WeekdayPicker';
import { ButtonLink } from '../../../components/ui/Button';
import { NumberField } from '../../../components/ui/NumberField';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { TimeField } from '../../../components/ui/TimeField';
import { useFeedback } from '../../../hooks/useFeedback';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import type { Shift } from '../../../types';

const PRESETS: WeekdayPreset[] = [
  { label: 'Lun a vie', days: WORKWEEK },
  { label: 'Lun a sáb', days: [0, 1, 2, 3, 4, 5] },
  { label: 'Todos', days: [0, 1, 2, 3, 4, 5, 6] },
];

const BREAK_OPTIONS = Array.from({ length: MAX_BREAKS + 1 }, (_, count) => ({
  value: String(count),
  label: count === 0 ? 'Sin descansos' : count === 1 ? '1 descanso' : `${count} descansos`,
}));

const BREAK_CHOICES = [15, 30, 45, 60].map((minutes) => ({ value: String(minutes), text: `${minutes} min` }));

/** Horas de un toque en el selector: los arranques y cierres de turno más comunes. */
const START_PRESETS = ['06:00', '07:00', '08:00', '09:00', '14:00', '22:00'];
const END_PRESETS = ['14:00', '15:00', '16:00', '17:00', '18:00', '06:00'];

const STATUS_TEXTS: RecordStatusTexts = {
  title: 'Estado del turno',
  subject: 'El turno',
  activeMeaning: 'Se puede asignar a tus empleados y elegir en las solicitudes de cambio.',
  inactiveMeaning: 'No se puede asignar y quienes lo tienen no tienen jornadas programadas mientras siga inactivo.',
  deactivateWarning: 'No se podrá asignar ni pedir, y quienes lo tienen asignado dejarán de tener jornadas programadas con él hasta que lo actives. Lo ya registrado se conserva.',
  removeWarning: 'Solo se puede eliminar un turno que nadie tiene ni tuvo asignado (las solicitudes de cambio a ese turno se eliminan con él). Si ya se usó, desactívalo para conservar su historial.',
  inUseCode: 'SHIFT_IN_USE',
};

/** Alta (/company/shifts/new) o edición (/company/shifts/:id/edit) de un turno de trabajo. */
export function ShiftFormPage() {
  const { id } = useParams();
  return (
    <RecordLoader
      id={id ? Number(id) : null}
      load={(shiftId, signal) => shiftService.get(shiftId, signal)}
      errorTitle="No se pudo cargar el turno"
      failed={{ title: 'Editar turno', backTo: paths.company.shifts, backLabel: 'Turnos' }}
    >
      {(shift) => <ShiftFormView key={shift?.id ?? 'new'} original={shift} />}
    </RecordLoader>
  );
}

function ShiftFormView({ original }: { original: Shift | null }) {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const form = useShiftForm(original);
  const [active, setActive] = useState(original?.active ?? true);
  const back = () => void navigate(paths.company.shifts);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    void form.save((saved) => {
      if (original) void feedback.success('Turno actualizado', `${saved.name} quedó actualizado: aplica a las jornadas que aún no empiezan.`);
      else void feedback.success('Turno creado', `${saved.name} ya se puede asignar a tus empleados.`);
      back();
    });
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader
          title={original ? 'Editar turno' : 'Nuevo turno'}
          subtitle={original ? 'Los cambios aplican a las jornadas que aún no empiezan: lo ya registrado conserva su horario.' : 'Horario, días, descansos y tolerancias para checar.'}
          backTo={paths.company.shifts}
          backLabel="Turnos"
          actions={
            original &&
            active && (
              <ButtonLink to={`${paths.company.bulkAssignShift}?shift=${original.id}`} variant="secondary" icon={<UsersRound size={18} />}>
                Asignar este turno a…
              </ButtonLink>
            )
          }
        />
        <ScheduleSection form={form} />
        <BreaksSection form={form} />
        <PanelGrid>
          <TolerancesSection form={form} />
          <PanelSection title="Así queda la jornada" icon={<ListChecks size={20} />}>
            <ShiftSummary timeline={form.timeline} weekdays={form.weekdays} breaksCount={Number(form.values.breaks_count)} breakMinutes={Number(form.values.break_minutes)} />
          </PanelSection>
        </PanelGrid>
        {original && (
          <RecordStatus
            name={original.name}
            active={active}
            texts={STATUS_TEXTS}
            setStatus={(next) => shiftService.setStatus(original.id, next)}
            remove={() => shiftService.remove(original.id)}
            onStatus={setActive}
            onRemoved={() => void navigate(paths.company.shifts, { replace: true })}
          />
        )}
        <FormFooter submitLabel={original ? 'Guardar cambios' : 'Crear turno'} submitIcon={original ? <Save size={20} /> : <Plus size={20} />} saving={form.saving} onCancel={back} />
      </Panel>
    </div>
  );
}

/** Nombre, entrada, salida y días en que empieza. */
function ScheduleSection({ form }: { form: ShiftForm }) {
  const { values, errors, set, touch, saving } = form;
  return (
    <PanelSection title="Horario" icon={<CalendarClock size={20} />}>
      <div className="stack">
        <FormField
          label="Nombre del turno"
          icon={<CalendarClock size={18} />}
          required
          maxLength={SHIFT_NAME_MAX}
          disabled={saving}
          value={values.name}
          error={errors.name}
          hint="Único en tu empresa: p. ej. “Matutino” o “Nocturno planta 2”"
          onBlur={() => touch('name')}
          onChange={(e) => set('name', e.target.value)}
        />
        <div className="form-grid">
          <TimeField
            label="Hora de entrada"
            required
            disabled={saving}
            presets={START_PRESETS}
            value={values.start_time}
            error={errors.start_time}
            onBlur={() => touch('start_time')}
            onChange={(value) => set('start_time', value)}
          />
          <TimeField
            label="Hora de salida"
            required
            disabled={saving}
            presets={END_PRESETS}
            value={values.end_time}
            error={errors.end_time}
            hint="Si es igual o antes que la entrada, termina al día siguiente"
            onBlur={() => touch('end_time')}
            onChange={(value) => set('end_time', value)}
          />
        </div>
        <WeekdayPicker
          label="Días en que empieza"
          value={form.weekdays}
          onChange={form.setWeekdays}
          presets={PRESETS}
          disabled={saving}
          error={form.weekdaysError}
          hint="Un turno nocturno cuenta el día en que se entra."
        />
      </div>
    </PanelSection>
  );
}

/** Cuántos descansos hay por jornada y cuánto dura cada uno. */
function BreaksSection({ form }: { form: ShiftForm }) {
  const { values, errors, set, touch, saving } = form;
  const hasBreaks = values.breaks_count !== '0';
  return (
    <PanelSection title="Descansos" icon={<Coffee size={20} />}>
      <div className="form-grid">
        <SelectField label="Descansos por jornada" value={values.breaks_count} options={BREAK_OPTIONS} disabled={saving} onChange={(count) => set('breaks_count', count)} />
        {hasBreaks && (
          <div className="field-stack">
            <NumberField
              label="Minutos de cada descanso"
              icon={<Timer size={18} />}
              unit="min"
              step={5}
              required
              min={BREAK_MINUTES_MIN}
              max={BREAK_MINUTES_MAX}
              disabled={saving}
              value={values.break_minutes}
              error={errors.break_minutes}
              hint={`Entre ${BREAK_MINUTES_MIN} y ${BREAK_MINUTES_MAX} min`}
              onBlur={() => touch('break_minutes')}
              onChange={(value) => set('break_minutes', value)}
            />
            <QuickChoices label="Duraciones sugeridas" value={values.break_minutes} choices={BREAK_CHOICES} disabled={saving} onPick={(value) => set('break_minutes', value)} />
          </div>
        )}
      </div>
    </PanelSection>
  );
}

type ToleranceField = keyof typeof TOLERANCE_LIMITS;

const TOLERANCES: Array<{ group: string; icon: LucideIcon; fields: Array<{ field: ToleranceField; label: string; hint: string }> }> = [
  {
    group: 'Entrada',
    icon: LogIn,
    fields: [
      { field: 'early_check_in_minutes', label: 'Checar antes de la entrada', hint: 'Minutos antes de la hora de entrada en que ya puede checar' },
      { field: 'late_tolerance_minutes', label: 'Retardo tolerado', hint: 'Minutos después de la entrada que aún no cuentan como retardo' },
    ],
  },
  {
    group: 'Salida',
    icon: LogOut,
    fields: [
      { field: 'early_check_out_minutes', label: 'Salida anticipada tolerada', hint: 'Minutos antes de la salida que no cuentan como salida anticipada' },
      { field: 'late_check_out_minutes', label: 'Límite para checar la salida', hint: 'Minutos después de la hora de salida para checarla' },
    ],
  },
];

/** Ventanas para checar: antes y después de la entrada y de la salida. */
function TolerancesSection({ form }: { form: ShiftForm }) {
  const { values, errors, set, touch, saving } = form;
  return (
    <PanelSection title="Tolerancias" icon={<Timer size={20} />}>
      <div className="tolerance-groups">
        {TOLERANCES.map(({ group, icon: Icon, fields }) => (
          <div key={group} className="tolerance-group" role="group" aria-label={group}>
            <h3 className="tolerance-group__title">
              <Icon size={16} aria-hidden /> {group}
            </h3>
            {fields.map(({ field, label, hint }) => (
              <NumberField
                key={field}
                label={label}
                icon={<Timer size={18} />}
                unit="min"
                step={5}
                required
                min={0}
                max={TOLERANCE_LIMITS[field]}
                disabled={saving}
                value={values[field]}
                error={errors[field]}
                hint={`${hint} (0 a ${TOLERANCE_LIMITS[field]})`}
                onBlur={() => touch(field)}
                onChange={(value) => set(field, value)}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="small muted inline-note">
        <Clock size={16} aria-hidden /> Las horas son de la hora del negocio, igual para todos los dispositivos.
      </p>
    </PanelSection>
  );
}
