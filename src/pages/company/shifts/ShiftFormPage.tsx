import { CalendarClock, Clock, Coffee, ListChecks, LogIn, LogOut, MapPinned, Plus, Save, Timer, UsersRound, type LucideIcon } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormField } from '../../../components/FormField';
import { FormFooter } from '../../../components/FormFooter';
import { QuickChoices, SelectField } from '../../../components/shifts/formFields';
import { RecordLoader } from '../../../components/shifts/PageStates';
import { RecordStatus, type RecordStatusTexts } from '../../../components/shifts/RecordStatus';
import { DeletedShift } from '../../../components/shifts/RecordTrash';
import { BREAK_MINUTES_MAX, BREAK_MINUTES_MIN, MAX_BREAKS, SHIFT_NAME_MAX } from '../../../components/shifts/shiftRules';
import { ShiftPlaceFields } from '../../../components/shifts/ShiftPlaceFields';
import { ShiftSummary } from '../../../components/shifts/ShiftSummary';
import { affectsText, TOLERANCE_LIMITS, useShiftForm, WORKWEEK, type ShiftForm } from '../../../components/shifts/useShiftForm';
import { WeekdayPicker, type WeekdayPreset } from '../../../components/shifts/WeekdayPicker';
import { ButtonLink } from '../../../components/ui/Button';
import { NumberField } from '../../../components/ui/NumberField';
import { Panel, PanelGrid, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { TimeField } from '../../../components/ui/TimeField';
import { useFeedback } from '../../../hooks/useFeedback';
import { t as translate, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { shiftService } from '../../../services/shiftService';
import type { Shift, Weekday } from '../../../types';
import { weekdaysLabel } from '../../../utils/shifts';

const MONDAY_TO_SATURDAY: Weekday[] = [0, 1, 2, 3, 4, 5];
const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Selecciones rápidas de los días ("Lun a vie", "Lun a sáb", "Todos"), en el idioma activo. */
const presets = (): WeekdayPreset[] => [
  { label: weekdaysLabel(WORKWEEK), days: WORKWEEK },
  { label: weekdaysLabel(MONDAY_TO_SATURDAY), days: MONDAY_TO_SATURDAY },
  { label: translate('shifts.form.allDays'), days: EVERY_DAY },
];

/** "Sin descansos", "1 descanso", "2 descansos"... */
const breakOptions = () => Array.from({ length: MAX_BREAKS + 1 }, (_, count) => ({ value: String(count), label: translate('shifts.form.breaksOption', { count }) }));

const breakChoices = () => [15, 30, 45, 60].map((minutes) => ({ value: String(minutes), text: translate('shifts.form.minutes', { minutes }) }));

/** Horas de un toque en el selector: los arranques y cierres de turno más comunes. */
const START_PRESETS = ['06:00', '07:00', '08:00', '09:00', '14:00', '22:00'];
const END_PRESETS = ['14:00', '15:00', '16:00', '17:00', '18:00', '06:00'];

/** Textos del estado de un turno (activar, desactivar, eliminar), en el idioma activo. */
const statusTexts = (name: string): RecordStatusTexts => ({
  title: translate('shifts.status.title'),
  activeMeaning: translate('shifts.status.activeMeaning'),
  inactiveMeaning: translate('shifts.status.inactiveMeaning'),
  deactivateWarning: translate('shifts.status.deactivateWarning'),
  removeWarning: translate('shifts.status.removeWarning'),
  activateQuestion: translate('shifts.status.activateQuestion', { name }),
  deactivateQuestion: translate('shifts.status.deactivateQuestion', { name }),
  removeQuestion: translate('shifts.status.removeQuestion', { name }),
  activated: translate('shifts.status.activated'),
  deactivated: translate('shifts.status.deactivated'),
  removed: translate('shifts.status.removed'),
  inUse: translate('shifts.status.inUse'),
  inUseCodes: ['SHIFT_IN_USE'],
});

/** Alta (/company/shifts/new) o edición (/company/shifts/:id/edit) de un turno de trabajo (en «Eliminados», solo su aviso con «Restaurar»). */
export function ShiftFormPage() {
  const t = useT();
  const { id } = useParams();
  return (
    <RecordLoader
      id={id ? Number(id) : null}
      load={(shiftId, signal) => shiftService.get(shiftId, signal)}
      errorTitle={() => translate('shifts.form.loadError')}
      failed={{ title: t('shifts.form.editTitle'), backTo: paths.company.shifts, backLabel: t('shifts.list.title') }}
    >
      {(shift, replace) => (shift?.deleted_at ? <DeletedShift record={shift} onRestored={replace} /> : <ShiftFormView key={shift?.id ?? 'new'} original={shift} />)}
    </RecordLoader>
  );
}

function ShiftFormView({ original }: { original: Shift | null }) {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const form = useShiftForm(original);
  const [active, setActive] = useState(original?.active ?? true);
  const back = () => void navigate(paths.company.shifts);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    void form.save((saved) => {
      const notice = original ? 'updated' : 'created';
      void feedback.success(
        () => translate(`shifts.form.${notice}.title`),
        () => translate(`shifts.form.${notice}.text`, { name: saved.name }),
      );
      back();
    });
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit}>
        <PanelHeader
          title={original ? t('shifts.form.editTitle') : t('shifts.form.newTitle')}
          subtitle={original ? t('shifts.form.editSubtitle', { affects: affectsText(original.employees) }) : t('shifts.form.newSubtitle')}
          backTo={paths.company.shifts}
          backLabel={t('shifts.list.title')}
          actions={
            original &&
            active && (
              <ButtonLink to={`${paths.company.bulkAssignShift}?shift=${original.id}`} variant="secondary" icon={<UsersRound size={18} />}>
                {t('shifts.form.assignThis')}
              </ButtonLink>
            )
          }
        />
        <ScheduleSection form={form} />
        <PanelSection title={t('shifts.form.sections.place')} icon={<MapPinned size={20} />}>
          <ShiftPlaceFields place={form.place} weekdays={form.weekdays} disabled={form.saving} />
        </PanelSection>
        <BreaksSection form={form} />
        <PanelGrid>
          <TolerancesSection form={form} />
          <PanelSection title={t('shifts.form.sections.summary')} icon={<ListChecks size={20} />}>
            <ShiftSummary timeline={form.timeline} weekdays={form.weekdays} breaksCount={Number(form.values.breaks_count)} breakMinutes={Number(form.values.break_minutes)} />
          </PanelSection>
        </PanelGrid>
        {original && (
          <RecordStatus
            name={original.name}
            active={active}
            texts={() => statusTexts(original.name)}
            setStatus={(next) => shiftService.setStatus(original.id, next)}
            remove={() => shiftService.remove(original.id)}
            onStatus={setActive}
            onRemoved={() => void navigate(paths.company.shifts, { replace: true })}
          />
        )}
        <FormFooter submitLabel={original ? t('common.actions.saveChanges') : t('shifts.form.create')} submitIcon={original ? <Save size={20} /> : <Plus size={20} />} saving={form.saving} onCancel={back} />
      </Panel>
    </div>
  );
}

/** Nombre, entrada, salida y días en que empieza. */
function ScheduleSection({ form }: { form: ShiftForm }) {
  const t = useT();
  const { values, errors, set, touch, saving } = form;
  return (
    <PanelSection title={t('shifts.form.sections.schedule')} icon={<CalendarClock size={20} />}>
      <div className="stack">
        <FormField
          label={t('shifts.form.fields.name')}
          icon={<CalendarClock size={18} />}
          required
          maxLength={SHIFT_NAME_MAX}
          disabled={saving}
          value={values.name}
          error={errors.name}
          hint={t('shifts.form.nameHint')}
          onBlur={() => touch('name')}
          onChange={(e) => set('name', e.target.value)}
        />
        <div className="form-grid">
          <TimeField
            label={t('shifts.form.fields.startTime')}
            required
            disabled={saving}
            presets={START_PRESETS}
            value={values.start_time}
            error={errors.start_time}
            onBlur={() => touch('start_time')}
            onChange={(value) => set('start_time', value)}
          />
          <TimeField
            label={t('shifts.form.fields.endTime')}
            required
            disabled={saving}
            presets={END_PRESETS}
            value={values.end_time}
            error={errors.end_time}
            hint={t('shifts.form.endHint')}
            onBlur={() => touch('end_time')}
            onChange={(value) => set('end_time', value)}
          />
        </div>
        <WeekdayPicker
          label={t('shifts.form.fields.weekdays')}
          value={form.weekdays}
          onChange={form.setWeekdays}
          presets={presets()}
          disabled={saving}
          error={form.weekdaysError}
          hint={t('shifts.form.weekdaysHint')}
        />
      </div>
    </PanelSection>
  );
}

/** Cuántos descansos hay por jornada y cuánto dura cada uno. */
function BreaksSection({ form }: { form: ShiftForm }) {
  const t = useT();
  const { values, errors, set, touch, saving } = form;
  const hasBreaks = values.breaks_count !== '0';
  return (
    <PanelSection title={t('shifts.form.sections.breaks')} icon={<Coffee size={20} />}>
      <div className="form-grid">
        <SelectField label={t('shifts.form.fields.breaksCount')} value={values.breaks_count} options={breakOptions()} disabled={saving} onChange={(count) => set('breaks_count', count)} />
        {hasBreaks && (
          <div className="field-stack">
            <NumberField
              label={t('shifts.form.fields.breakMinutes')}
              icon={<Timer size={18} />}
              unit="min"
              step={5}
              required
              min={BREAK_MINUTES_MIN}
              max={BREAK_MINUTES_MAX}
              disabled={saving}
              value={values.break_minutes}
              error={errors.break_minutes}
              hint={t('shifts.validation.minutesRange', { min: BREAK_MINUTES_MIN, max: BREAK_MINUTES_MAX })}
              onBlur={() => touch('break_minutes')}
              onChange={(value) => set('break_minutes', value)}
            />
            <QuickChoices label={t('shifts.form.suggestedDurations')} value={values.break_minutes} choices={breakChoices()} disabled={saving} onPick={(value) => set('break_minutes', value)} />
          </div>
        )}
      </div>
    </PanelSection>
  );
}

type ToleranceField = keyof typeof TOLERANCE_LIMITS;

/** Cada tolerancia con la llave de su nombre (`shifts.form.fields`) y de su ayuda (`shifts.form.tolerances`). */
const TOLERANCES: Array<{ group: 'checkIn' | 'checkOut'; icon: LucideIcon; fields: Array<{ field: ToleranceField; key: 'earlyCheckIn' | 'lateTolerance' | 'earlyCheckOut' | 'lateCheckOut' }> }> = [
  {
    group: 'checkIn',
    icon: LogIn,
    fields: [
      { field: 'early_check_in_minutes', key: 'earlyCheckIn' },
      { field: 'late_tolerance_minutes', key: 'lateTolerance' },
    ],
  },
  {
    group: 'checkOut',
    icon: LogOut,
    fields: [
      { field: 'early_check_out_minutes', key: 'earlyCheckOut' },
      { field: 'late_check_out_minutes', key: 'lateCheckOut' },
    ],
  },
];

/** Ventanas para checar: antes y después de la entrada y de la salida. */
function TolerancesSection({ form }: { form: ShiftForm }) {
  const t = useT();
  const { values, errors, set, touch, saving } = form;
  return (
    <PanelSection title={t('shifts.form.sections.tolerances')} icon={<Timer size={20} />}>
      <div className="tolerance-groups">
        {TOLERANCES.map(({ group, icon: Icon, fields }) => (
          <div key={group} className="tolerance-group" role="group" aria-label={t(`shifts.form.summary.${group}`)}>
            <h3 className="tolerance-group__title">
              <Icon size={16} aria-hidden /> {t(`shifts.form.summary.${group}`)}
            </h3>
            {fields.map(({ field, key }) => (
              <NumberField
                key={field}
                label={t(`shifts.form.fields.${key}`)}
                icon={<Timer size={18} />}
                unit="min"
                step={5}
                required
                min={0}
                max={TOLERANCE_LIMITS[field]}
                disabled={saving}
                value={values[field]}
                error={errors[field]}
                hint={t('shifts.form.tolerances.hint', { hint: t(`shifts.form.tolerances.${key}`), max: TOLERANCE_LIMITS[field] })}
                onBlur={() => touch(field)}
                onChange={(value) => set(field, value)}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="small muted inline-note">
        <Clock size={16} aria-hidden /> {t('shifts.form.businessTime')}
      </p>
    </PanelSection>
  );
}
