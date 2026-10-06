import { CalendarDays, ClipboardPen, Clock, Coffee, MessageSquareText, Save, UserSearch } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BreaksEditor } from '../../../components/attendance/BreaksEditor';
import { businessClock, clockLabel, emptyValues, manualFacts, manualLabels, manualTimes, normalizeReason, sessionValues, type ManualValues } from '../../../components/attendance/manualSession';
import { scheduleRange } from '../../../components/attendance/sessionFacts';
import { useManualSession, type ManualSessionForm } from '../../../components/attendance/useManualSession';
import { FormFooter } from '../../../components/FormFooter';
import { ReasonField } from '../../../components/ReasonField';
import { LoadFailed } from '../../../components/shifts/PageStates';
import { MAX_BREAKS } from '../../../components/shifts/shiftRules';
import { ButtonLink } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { DateField, parseIso } from '../../../components/ui/DateField';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { TimeField } from '../../../components/ui/TimeField';
import { useFeedback } from '../../../hooks/useFeedback';
import { useResource } from '../../../hooks/useResource';
import { t, useT, type Translate } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import { employeeService } from '../../../services/employeeService';
import type { BoardRow, CompanySessionDetail, EmployeeRef } from '../../../types';
import type { ConfirmInput } from '../../../types/confirm';
import { describeChanges, describeValues } from '../../../utils/changes';
import { businessToday, formatDate } from '../../../utils/format';

/** Empleados que puede traer la búsqueda por número en el tablero (la página más grande de la API). */
const SCHEDULE_LOOKUP = 50;

/** El horario de ese día (lo programado): orienta las horas y da las sugerencias de un toque. */
interface DaySchedule {
  shift_name: string;
  scheduled_start: string;
  scheduled_end: string;
}

/** Registrar la jornada de un empleado en un día, o corregir una jornada ya registrada. */
type Target = { kind: 'new'; employee: EmployeeRef; workDate: string } | { kind: 'correct'; session: CompanySessionDetail };

/** Lo que el tablero dice del empleado ese día (su turno, si es día libre, si ya tiene jornada). */
interface DayLookup {
  day: string;
  row: BoardRow | null;
  loading: boolean;
  /** No se pudo consultar (el registro funciona igual). */
  failed: boolean;
}

/**
 * Su turno el día elegido, desde el tablero de ese día (búsqueda por su número). Solo orienta: si no
 * se puede saber, el formulario funciona igual y el backend valida el día (sin turno, día libre o ya
 * registrado).
 */
function useDayLookup(employee: EmployeeRef, workDate: string): DayLookup {
  const day = parseIso(workDate) ? workDate : '';
  const { data } = useResource(
    (signal) =>
      day
        ? attendanceService
            .board({ date: day, search: employee.employee_number, page: 1, size: SCHEDULE_LOOKUP }, signal)
            .then((board) => ({ day, row: board.items.find((row) => row.employee.id === employee.id) ?? null, failed: false }))
            // Accesorio (horario y horas sugeridas): sin él se registra igual, por eso no abre un popup.
            .catch(() => ({ day, row: null, failed: true }))
        : Promise.resolve({ day, row: null, failed: false }),
    `${employee.id}|${day}`,
    // Nunca se muestra (la consulta no falla: `catch` la vuelve "no se pudo consultar"); se pide igual.
    t('attendance.manual.dayHint.lookupError'),
  );
  return data?.day === day ? { ...data, loading: false } : { day, row: null, loading: true, failed: false };
}

/** Lo que se dice bajo el día: su turno y, si aplica, por qué no se puede registrar (en el idioma de `t`). */
function dayHint({ day, row, loading, failed }: DayLookup, t: Translate): string {
  if (!day) return t('attendance.manual.dayHint.pick');
  if (loading) return t('attendance.manual.dayHint.loading');
  if (failed) return t('attendance.manual.dayHint.failed');
  if (!row) return t('attendance.manual.dayHint.noShift');
  const schedule = t('attendance.manual.dayHint.schedule', { shift: row.shift_name, range: scheduleRange(row.scheduled_start, row.scheduled_end) });
  if (row.state === 'DAY_OFF') {
    const dayOff = row.day_off ? t('attendance.manual.dayHint.dayOffReason', { reason: row.day_off.name }) : t('attendance.manual.dayHint.dayOff');
    return `${schedule} ${dayOff}`;
  }
  return row.session ? `${schedule} ${t('attendance.manual.dayHint.registered')}` : schedule;
}

/**
 * Registrar: lo que se guarda (día, entrada, salida, descansos y motivo). Corregir: lo que cambia
 * ("antes → después") y el motivo; sin cambios, no hay nada que corregir.
 */
function manualConfirm(target: Target, employee: EmployeeRef, values: ManualValues): ConfirmInput {
  const reason = { label: t('attendance.manual.confirm.reason'), value: normalizeReason(values.reason) };
  const name = employee.full_name;
  if (target.kind === 'new') {
    return {
      kind: 'create',
      icon: <ClipboardPen size={30} />,
      eyebrow: t('attendance.manual.confirm.eyebrow'),
      title: t('attendance.manual.confirm.createTitle', { name }),
      message: t('attendance.manual.confirm.createMessage'),
      details: [{ label: t('attendance.fields.day'), value: formatDate(values.work_date) }, ...describeValues(manualFacts(values), manualLabels()), reason],
      confirmLabel: t('attendance.record'),
      confirmIcon: <ClipboardPen size={18} />,
    };
  }
  return {
    kind: 'edit',
    title: t('attendance.manual.confirm.editTitle', { name, date: formatDate(target.session.work_date) }),
    changes: describeChanges(manualFacts(sessionValues(target.session)), manualFacts(values), manualLabels()),
    details: [reason],
    note: t('attendance.manual.confirm.editNote'),
    confirmLabel: t('attendance.manual.saveCorrection'),
  };
}

/** Lo programado como hora de un toque en el selector ("08:00 (programada)"). */
const scheduledPreset = (clock: string | null, translate: Translate) => (clock ? [{ value: clock, label: translate('attendance.manual.times.preset', { time: clockLabel(clock) }) }] : []);

/** Avisos al guardar (se arman al dibujarse: el popup abierto sigue al idioma activo). */
const savedTitle = (creating: boolean) => () => t(creating ? 'attendance.manual.success.created' : 'attendance.manual.success.corrected');
function savedText(creating: boolean, name: string, workDate: string) {
  return () => (creating ? t('attendance.manual.success.createdText', { name, date: formatDate(workDate) }) : t('attendance.manual.success.correctedText', { name }));
}
const saveError = (creating: boolean) => () => t(creating ? 'attendance.manual.errors.create' : 'attendance.manual.errors.correct');
const sessionLoadError = () => t('attendance.detail.loadError');
const employeeLoadError = () => t('attendance.manual.errors.employee');

/** Hora de entrada y salida (o "aún no sale"), con el horario programado como sugerencia. */
function TimesSection({ form, schedule }: { form: ManualSessionForm; schedule: DaySchedule | null }) {
  const t = useT();
  const { values, errors, set, saving } = form;
  // El valor del campo es "HH:MM" (24 h) en todo idioma; lo que se lee, con el formato del idioma.
  const start = schedule && businessClock(schedule.scheduled_start);
  const end = schedule && businessClock(schedule.scheduled_end);
  return (
    <PanelSection title={t('attendance.manual.times.title')} icon={<Clock size={20} />}>
      <div className="stack">
        <div className="form-grid">
          <TimeField
            label={t('attendance.manual.times.checkIn')}
            required
            disabled={saving}
            value={values.check_in}
            presets={scheduledPreset(start, t)}
            openTo={start ?? undefined}
            error={errors.check_in}
            hint={start ? t('attendance.manual.times.checkInHint', { time: clockLabel(start) }) : undefined}
            onChange={(value) => set('check_in', value)}
          />
          <TimeField
            label={t('attendance.manual.times.checkOut')}
            required={!values.stillWorking}
            disabled={saving || values.stillWorking}
            value={values.stillWorking ? '' : values.check_out}
            presets={scheduledPreset(end, t)}
            openTo={end ?? undefined}
            error={errors.check_out}
            hint={end ? t('attendance.manual.times.checkOutHint', { time: clockLabel(end) }) : t('attendance.manual.times.overnightHint')}
            onChange={(value) => set('check_out', value)}
          />
        </div>
        <Checkbox
          checked={values.stillWorking}
          disabled={saving}
          label={t('attendance.manual.stillWorking')}
          description={t('attendance.manual.stillWorkingHint')}
          onChange={(checked) => set('stillWorking', checked)}
        />
      </div>
    </PanelSection>
  );
}

interface ManualFormProps {
  target: Target;
  /** Su horario ese día (al corregir, el de la jornada; al registrar, el del tablero). */
  schedule: DaySchedule | null;
  form: ManualSessionForm;
  /** Al registrar: el día y lo que se sabe de él. */
  day?: { hint: string };
}

function ManualForm({ target, schedule, form, day }: ManualFormProps) {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const today = businessToday();
  const creating = target.kind === 'new';
  const employee = creating ? target.employee : target.session.employee;
  const back = creating
    ? { backTo: `${paths.company.attendance}?date=${target.workDate}`, backLabel: t('attendance.nav.dayBoard') }
    : { backTo: paths.company.attendanceSession(target.session.id), backLabel: t('attendance.nav.session') };
  const { values, errors, saving } = form;

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    form.save(
      async () => {
        const times = manualTimes(values);
        const saved = creating
          ? await attendanceService.createSession({ ...times, employee_id: employee.id, work_date: values.work_date })
          : await attendanceService.correctSession(target.session.id, times);
        void feedback.success(savedTitle(creating), savedText(creating, employee.full_name, saved.work_date));
        void navigate(paths.company.attendanceSession(saved.id), { replace: true });
      },
      saveError(creating),
      () => manualConfirm(target, employee, values),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit} className="manual-session">
        <PanelHeader
          title={t(creating ? 'attendance.record' : 'attendance.manual.correctTitle')}
          subtitle={creating ? `${employee.full_name} · ${employee.employee_number}` : `${employee.full_name} · ${formatDate(target.session.work_date)} · ${target.session.shift_name}`}
          {...back}
        />
        {day && (
          <PanelSection title={t('attendance.fields.day')} icon={<CalendarDays size={20} />}>
            <DateField
              label={t('attendance.manual.workDate')}
              name="work_date"
              required
              max={today}
              disabled={saving}
              value={values.work_date}
              error={errors.work_date}
              hint={day.hint}
              onChange={(value) => form.set('work_date', value)}
            />
          </PanelSection>
        )}
        <TimesSection form={form} schedule={schedule} />
        <PanelSection title={t('attendance.fields.breaks')} icon={<Coffee size={20} />}>
          <BreaksEditor
            value={values.breaks}
            max={creating ? MAX_BREAKS : target.session.breaks_allowed}
            hint={creating ? t('attendance.manual.breaksHint', { max: MAX_BREAKS }) : undefined}
            disabled={saving}
            markMissing={form.attempted}
            error={errors.breaks}
            onChange={(breaks) => form.set('breaks', breaks)}
          />
        </PanelSection>
        <PanelSection title={t('common.fields.reason')} icon={<MessageSquareText size={20} />}>
          <ReasonField
            catalog="attendance_edit_reasons"
            label={t(creating ? 'attendance.manual.reasonCreate' : 'attendance.manual.reasonCorrect')}
            required
            disabled={saving}
            value={values.reason}
            error={errors.reason}
            placeholder={t('attendance.manual.reasonPlaceholder')}
            hint={t('attendance.manual.reasonHint')}
            onChange={(reason) => form.set('reason', reason)}
          />
        </PanelSection>
        <FormFooter
          submitLabel={t(creating ? 'attendance.record' : 'attendance.manual.saveCorrection')}
          submitIcon={creating ? <ClipboardPen size={20} /> : <Save size={20} />}
          saving={saving}
          onCancel={() => void navigate(back.backTo)}
        />
      </Panel>
    </div>
  );
}

/** Registrar: el empleado y el día del enlace del tablero (el día se puede cambiar, hasta hoy). */
function NewSessionForm({ employee, workDate }: { employee: EmployeeRef; workDate: string }) {
  const t = useT();
  const form = useManualSession(emptyValues(workDate), { today: businessToday(), withDate: true });
  const lookup = useDayLookup(employee, form.values.work_date);
  return <ManualForm target={{ kind: 'new', employee, workDate }} schedule={lookup.row} form={form} day={{ hint: dayHint(lookup, t) }} />;
}

/** Corregir: lo registrado ya viene en el formulario (horas en la hora del negocio). */
function CorrectSessionForm({ session }: { session: CompanySessionDetail }) {
  const form = useManualSession(sessionValues(session), { today: businessToday(), withDate: false });
  return <ManualForm target={{ kind: 'correct', session }} schedule={session} form={form} />;
}

function NewSession({ employeeId, workDate }: { employeeId: number; workDate: string }) {
  const t = useT();
  const { data, error, retry } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, employeeLoadError);
  if (!data) {
    return error ? (
      <LoadFailed title={t('attendance.record')} backTo={`${paths.company.attendance}?date=${workDate}`} backLabel={t('attendance.nav.dayBoard')} onRetry={retry} />
    ) : (
      <SkeletonCard lines={8} />
    );
  }
  return <NewSessionForm key={data.id} employee={data} workDate={workDate} />;
}

function CorrectSession({ sessionId }: { sessionId: number }) {
  const t = useT();
  const { data, error, retry } = useResource((signal) => attendanceService.session(sessionId, signal), sessionId, sessionLoadError);
  if (!data) {
    return error ? (
      <LoadFailed title={t('attendance.manual.correctTitle')} backTo={paths.company.attendanceSession(sessionId)} backLabel={t('attendance.nav.session')} onRetry={retry} />
    ) : (
      <SkeletonCard lines={8} />
    );
  }
  return <CorrectSessionForm key={data.id} session={data} />;
}

/** Sin empleado en el enlace: se registra desde el tablero, en la fila de quien no checó. */
function MissingEmployee() {
  const t = useT();
  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('attendance.record')} backTo={paths.company.attendance} backLabel={t('attendance.nav.dayBoard')} />
        <PanelSection>
          <EmptyState
            icon={<UserSearch />}
            title={t('attendance.manual.missing.title')}
            description={t('attendance.manual.missing.description')}
            action={
              <ButtonLink to={paths.company.attendance} variant="primary">
                {t('attendance.manual.missing.action')}
              </ButtonLink>
            }
          />
        </PanelSection>
      </Panel>
    </div>
  );
}

/**
 * La empresa registra la asistencia de un empleado o corrige una jornada (decisión del dueño del
 * producto: SOLO la empresa). Registrar (/company/attendance/sessions/new?employee=&date=): el día (de
 * su turno, hasta hoy), la entrada, la salida (o "aún no sale"), los descansos y el motivo. Corregir
 * (/company/attendance/sessions/:id/correct): lo mismo con lo registrado ya escrito. Sin rostro ni
 * ubicación: lo respalda el motivo, que el empleado ve en su historial. Las reglas son las del registro
 * en vivo y las aplica el backend (sus errores se marcan en su campo). Al guardar abre la jornada.
 */
export function ManualSessionPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  if (id) return <CorrectSession sessionId={Number(id)} />;
  const employeeId = Number(params.get('employee'));
  if (!Number.isInteger(employeeId) || employeeId <= 0) return <MissingEmployee />;
  const today = businessToday();
  const date = params.get('date') ?? '';
  return <NewSession employeeId={employeeId} workDate={parseIso(date) && date <= today ? date : today} />;
}
