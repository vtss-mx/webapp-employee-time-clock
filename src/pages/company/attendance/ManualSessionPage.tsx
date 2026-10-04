import { CalendarDays, ClipboardPen, Clock, Coffee, MessageSquareText, Save, UserSearch } from 'lucide-react';
import type { SubmitEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BreaksEditor } from '../../../components/attendance/BreaksEditor';
import { emptyValues, MANUAL_LABELS, manualFacts, manualTimes, normalizeReason, sessionValues, type ManualValues } from '../../../components/attendance/manualSession';
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
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import { employeeService } from '../../../services/employeeService';
import type { BoardRow, CompanySessionDetail, EmployeeRef } from '../../../types';
import type { ConfirmInput } from '../../../types/confirm';
import { describeChanges, describeValues } from '../../../utils/changes';
import { businessToday, formatDate, formatTime } from '../../../utils/format';

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
    'No se pudo consultar su turno',
  );
  return data?.day === day ? { ...data, loading: false } : { day, row: null, loading: true, failed: false };
}

/** Lo que se dice bajo el día: su turno y, si aplica, por qué no se puede registrar. */
function dayHint({ day, row, loading, failed }: DayLookup): string {
  if (!day) return 'El día de su turno (hasta hoy).';
  if (loading) return 'Consultando su turno de ese día…';
  if (failed) return 'No se pudo consultar su turno de ese día: al registrar se revisa igual.';
  if (!row) return 'Ese día no tiene turno asignado: solo se registra un día de su turno.';
  const schedule = `Turno ${row.shift_name}: ${scheduleRange(row.scheduled_start, row.scheduled_end)}.`;
  if (row.state === 'DAY_OFF') {
    const reason = row.day_off ? ` (${row.day_off.name})` : '';
    return `${schedule} Ese día es libre${reason}: si sí trabajó, márcalo como laborable en Calendario.`;
  }
  return row.session ? `${schedule} Ya tiene su jornada registrada: corrígela en lugar de registrar otra.` : schedule;
}

/**
 * Registrar: lo que se guarda (día, entrada, salida, descansos y motivo). Corregir: lo que cambia
 * ("antes → después") y el motivo; sin cambios, no hay nada que corregir.
 */
function manualConfirm(target: Target, employee: EmployeeRef, values: ManualValues): ConfirmInput {
  const reason = { label: 'Motivo que verá', value: normalizeReason(values.reason) };
  if (target.kind === 'new') {
    return {
      kind: 'create',
      icon: <ClipboardPen size={30} />,
      eyebrow: 'Registro de la empresa',
      title: `¿Registrar la asistencia de ${employee.full_name}?`,
      message: 'Queda registrada por la empresa, sin rostro ni ubicación: la respalda el motivo.',
      details: [{ label: 'Día', value: formatDate(values.work_date) }, ...describeValues(manualFacts(values), MANUAL_LABELS), reason],
      confirmLabel: 'Registrar asistencia',
      confirmIcon: <ClipboardPen size={18} />,
    };
  }
  return {
    kind: 'edit',
    title: `¿Corregir la jornada de ${employee.full_name} del ${formatDate(target.session.work_date)}?`,
    changes: describeChanges(manualFacts(sessionValues(target.session)), manualFacts(values), MANUAL_LABELS),
    details: [reason],
    note: 'Lo que había se conserva en la bitácora y el empleado verá el motivo en su historial.',
    confirmLabel: 'Guardar corrección',
  };
}

/** Hora de entrada y salida (o "aún no sale"), con el horario programado como sugerencia. */
function TimesSection({ form, schedule }: { form: ManualSessionForm; schedule: DaySchedule | null }) {
  const { values, errors, set, saving } = form;
  const start = schedule && formatTime(schedule.scheduled_start);
  const end = schedule && formatTime(schedule.scheduled_end);
  return (
    <PanelSection title="Entrada y salida" icon={<Clock size={20} />}>
      <div className="stack">
        <div className="form-grid">
          <TimeField
            label="Hora de entrada"
            required
            disabled={saving}
            value={values.check_in}
            presets={start ? [{ value: start, label: `${start} (programada)` }] : []}
            openTo={start ?? undefined}
            error={errors.check_in}
            hint={start ? `Programada a las ${start}` : undefined}
            onChange={(value) => set('check_in', value)}
          />
          <TimeField
            label="Hora de salida"
            required={!values.stillWorking}
            disabled={saving || values.stillWorking}
            value={values.stillWorking ? '' : values.check_out}
            presets={end ? [{ value: end, label: `${end} (programada)` }] : []}
            openTo={end ?? undefined}
            error={errors.check_out}
            hint={end ? `Programada a las ${end}; si es de madrugada, es la del día siguiente` : 'Si es de madrugada, es la del día siguiente'}
            onChange={(value) => set('check_out', value)}
          />
        </div>
        <Checkbox
          checked={values.stillWorking}
          disabled={saving}
          label="Aún no sale"
          description="La jornada queda abierta para que registre su salida; si ya venció el límite para checarla, queda «Sin salida»."
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
  const navigate = useNavigate();
  const feedback = useFeedback();
  const today = businessToday();
  const creating = target.kind === 'new';
  const employee = creating ? target.employee : target.session.employee;
  const back = creating
    ? { backTo: `${paths.company.attendance}?date=${target.workDate}`, backLabel: 'Asistencia del día' }
    : { backTo: paths.company.attendanceSession(target.session.id), backLabel: 'Jornada' };
  const { values, errors, saving } = form;

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    form.save(
      async () => {
        const times = manualTimes(values);
        const saved = creating
          ? await attendanceService.createSession({ ...times, employee_id: employee.id, work_date: values.work_date })
          : await attendanceService.correctSession(target.session.id, times);
        if (creating) void feedback.success('Asistencia registrada', `La jornada de ${employee.full_name} del ${formatDate(saved.work_date)} quedó registrada por la empresa.`);
        else void feedback.success('Jornada corregida', `Lo que había se conserva en la bitácora de ${employee.full_name}.`);
        void navigate(paths.company.attendanceSession(saved.id), { replace: true });
      },
      creating ? 'No se pudo registrar la asistencia' : 'No se pudo corregir la jornada',
      () => manualConfirm(target, employee, values),
    );
  };

  return (
    <div className="page">
      <Panel onSubmit={onSubmit} className="manual-session">
        <PanelHeader
          title={creating ? 'Registrar asistencia' : 'Corregir jornada'}
          subtitle={creating ? `${employee.full_name} · ${employee.employee_number}` : `${employee.full_name} · ${formatDate(target.session.work_date)} · ${target.session.shift_name}`}
          {...back}
        />
        {day && (
          <PanelSection title="Día" icon={<CalendarDays size={20} />}>
            <DateField
              label="Día que trabajó"
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
        <PanelSection title="Descansos" icon={<Coffee size={20} />}>
          <BreaksEditor
            value={values.breaks}
            max={creating ? MAX_BREAKS : target.session.breaks_allowed}
            hint={creating ? `Los que tomó, hasta los que permite su turno (a lo más ${MAX_BREAKS}).` : undefined}
            disabled={saving}
            markMissing={form.attempted}
            error={errors.breaks}
            onChange={(breaks) => form.set('breaks', breaks)}
          />
        </PanelSection>
        <PanelSection title="Motivo" icon={<MessageSquareText size={20} />}>
          <ReasonField
            catalog="attendance_edit_reasons"
            label={creating ? '¿Por qué la registras tú?' : '¿Por qué la corriges?'}
            required
            disabled={saving}
            value={values.reason}
            error={errors.reason}
            placeholder="Por ejemplo: olvidó checar su salida."
            hint="El empleado lo verá en su historial junto a la jornada (de 5 a 500 caracteres)."
            onChange={(reason) => form.set('reason', reason)}
          />
        </PanelSection>
        <FormFooter
          submitLabel={creating ? 'Registrar asistencia' : 'Guardar corrección'}
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
  const form = useManualSession(emptyValues(workDate), { today: businessToday(), withDate: true });
  const lookup = useDayLookup(employee, form.values.work_date);
  return <ManualForm target={{ kind: 'new', employee, workDate }} schedule={lookup.row} form={form} day={{ hint: dayHint(lookup) }} />;
}

/** Corregir: lo registrado ya viene en el formulario (horas en la hora del negocio). */
function CorrectSessionForm({ session }: { session: CompanySessionDetail }) {
  const form = useManualSession(sessionValues(session), { today: businessToday(), withDate: false });
  return <ManualForm target={{ kind: 'correct', session }} schedule={session} form={form} />;
}

function NewSession({ employeeId, workDate }: { employeeId: number; workDate: string }) {
  const { data, error, retry } = useResource((signal) => employeeService.get(employeeId, signal), employeeId, 'No se pudo cargar al empleado');
  if (!data) {
    return error ? (
      <LoadFailed title="Registrar asistencia" backTo={`${paths.company.attendance}?date=${workDate}`} backLabel="Asistencia del día" onRetry={retry} />
    ) : (
      <SkeletonCard lines={8} />
    );
  }
  return <NewSessionForm key={data.id} employee={data} workDate={workDate} />;
}

function CorrectSession({ sessionId }: { sessionId: number }) {
  const { data, error, retry } = useResource((signal) => attendanceService.session(sessionId, signal), sessionId, 'No se pudo cargar la jornada');
  if (!data) {
    return error ? <LoadFailed title="Corregir jornada" backTo={paths.company.attendanceSession(sessionId)} backLabel="Jornada" onRetry={retry} /> : <SkeletonCard lines={8} />;
  }
  return <CorrectSessionForm key={data.id} session={data} />;
}

/** Sin empleado en el enlace: se registra desde el tablero, en la fila de quien no checó. */
function MissingEmployee() {
  return (
    <div className="page">
      <Panel>
        <PanelHeader title="Registrar asistencia" backTo={paths.company.attendance} backLabel="Asistencia del día" />
        <PanelSection>
          <EmptyState
            icon={<UserSearch />}
            title="Elige a quién registrar"
            description="En el tablero del día toca «Registrar asistencia» en la fila del empleado que no checó."
            action={
              <ButtonLink to={paths.company.attendance} variant="primary">
                Ir al tablero
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
