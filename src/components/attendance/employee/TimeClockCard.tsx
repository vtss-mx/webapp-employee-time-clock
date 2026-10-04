import { CalendarClock, Coffee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useConfirm } from '../../../hooks/useConfirm';
import { paths } from '../../../routes/paths';
import { ATTENDANCE_SLUGS } from '../../../services/attendanceService';
import type { AttendanceAction, AttendanceToday, Occurrence, ShiftRef, WorkSession } from '../../../types';
import { businessToday, formatDate, formatMinutes, formatTime } from '../../../utils/format';
import { shiftSchedule, weekdaysLabel } from '../../../utils/shifts';
import { CatalogStatusBadge } from '../../StatusBadge';
import { Button } from '../../ui/Button';
import { MinutesBadge } from '../MinutesBadge';
import { ACTION_ICONS } from '../sessionFacts';
import { usePlaceLabel } from '../SessionTimeline';
import { DayOffCard } from './DayOffCard';
import { Countdown, Elapsed } from './LiveTime';
import { minutesBetween } from './serverTime';
import { breakWindowText, clockCountdown, clockState, openBreak, primaryAction, recordLabel } from './todayView';

interface ClockProps {
  today: AttendanceToday;
  /** El turno del empleado (sin turno, la pantalla muestra otra cosa: no hay reloj que dibujar). */
  shift: ShiftRef;
  /** Diferencia servidor − teléfono (`serverOffset`): los tiempos que corren usan la hora del servidor. */
  offsetMs: number;
}

/** Su turno (nombre, horario y días) y, si ahora no hay jornada que checar, cuándo es la siguiente. */
function ClockShift({ shift, next }: { shift: ShiftRef; next: Occurrence | null }) {
  return (
    <div className="time-clock__shift">
      <span className="time-clock__eyebrow">{shift.name}</span>
      <strong className="time-clock__hours">{shiftSchedule(shift)}</strong>
      <span className="time-clock__days">{weekdaysLabel(shift.weekdays)}</span>
      {next && (
        <span className="time-clock__days">
          <CalendarClock size={16} aria-hidden /> Próxima jornada: {formatDate(next.work_date)} · puedes checar desde las {formatTime(next.opens)}
        </span>
      )}
    </div>
  );
}

/**
 * Lo que lleva la jornada abierta: desde qué hora y dónde entró, lo trabajado (corre cada minuto; en
 * descanso se detiene) y los descansos usados de los permitidos.
 */
function OpenSession({ session, offsetMs }: { session: WorkSession; offsetMs: number }) {
  const place = usePlaceLabel();
  const pause = openBreak(session);
  return (
    <dl className="time-clock__facts">
      <div>
        <dt>Entrada</dt>
        <dd>
          {formatTime(session.check_in_at)} <small>{place(session.check_in_mode, session.check_in_site)}</small>
        </dd>
      </div>
      <div>
        <dt>Trabajado</dt>
        <dd>
          {pause ? (
            formatMinutes(minutesBetween(session.check_in_at, pause.started_at) - session.break_minutes)
          ) : (
            <Elapsed key={session.check_in_at} since={session.check_in_at} offsetMs={offsetMs} minusMinutes={session.break_minutes} />
          )}
        </dd>
      </div>
      {pause && (
        <div>
          <dt>En descanso desde</dt>
          <dd>{formatTime(pause.started_at)}</dd>
        </div>
      )}
      {session.breaks_allowed > 0 && (
        <div>
          <dt>Descansos</dt>
          <dd>
            {session.breaks.length} de {session.breaks_allowed} <small>de {formatMinutes(session.break_minutes_allowed)} cada uno</small>
          </dd>
        </div>
      )}
    </dl>
  );
}

/** Lo que se aclara al confirmar cada registro (la salida cierra la jornada). */
const RECORD_NOTES: Partial<Record<AttendanceAction, string>> = {
  CHECK_OUT: 'Con tu salida se cierra tu jornada de hoy.',
};

/**
 * Botones grandes de lo que el servidor permite ahora (`today.actions`), al alcance del pulgar. Cada
 * registro se confirma ANTES de abrir la ubicación y la cámara ("¿Registrar tu entrada?"): un toque
 * por error no registra nada.
 */
function ClockActions({ today, shift }: { today: AttendanceToday; shift: ShiftRef }) {
  const { nameOf } = useCatalogs();
  const confirm = useConfirm();
  const navigate = useNavigate();
  if (!today.actions.length) return null;
  const primary = primaryAction(today);
  const record = async (action: AttendanceAction) => {
    const name = nameOf('attendance_actions', action);
    const Icon = ACTION_ICONS[action];
    const ok = await confirm({
      kind: 'create',
      icon: <Icon size={30} />,
      eyebrow: 'Mi asistencia',
      title: `¿Registrar tu ${name.toLowerCase()}?`,
      message: 'Se leerá tu ubicación y se abrirá la cámara para confirmar que eres tú. La hora la pone el servidor.',
      details: [{ label: 'Turno', value: `${shift.name} · ${shiftSchedule(shift)}` }],
      note: RECORD_NOTES[action],
      confirmLabel: recordLabel(name),
      confirmIcon: <Icon size={18} />,
    });
    if (ok) void navigate(paths.employee.recordAttendance(ATTENDANCE_SLUGS[action]));
  };
  return (
    <div className="time-clock__actions">
      {today.actions.map((action) => {
        const Icon = ACTION_ICONS[action];
        return (
          <Button key={action} variant={action === primary ? 'light' : 'ghost'} size="lg" block icon={<Icon size={22} aria-hidden />} onClick={() => void record(action)}>
            {recordLabel(nameOf('attendance_actions', action))}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Reloj checador del empleado: su turno, en qué va (estado del catálogo board_states), lo que dice el
 * servidor, su día libre (festivo o ausencia aprobada: sin botones), cuánto falta para lo siguiente,
 * cuándo puede tomar su descanso y los botones de lo que puede registrar ahora.
 */
export function TimeClockCard({ today, shift, offsetMs }: ClockProps) {
  const state = clockState(today);
  const countdown = clockCountdown(today);
  const breakNote = breakWindowText(today);
  const session = today.session;
  return (
    <section className="time-clock" aria-label="Reloj checador">
      <div className="time-clock__top">
        <ClockShift shift={shift} next={today.next_occurrence} />
        <span className="time-clock__badges">
          {state && <CatalogStatusBadge catalog="board_states" code={state} />}
          {session && <MinutesBadge kind="late" minutes={session.late_minutes} />}
        </span>
      </div>
      <p className="time-clock__message">{today.message}</p>
      {today.day_off && <DayOffCard dayOff={today.day_off} today={businessToday(new Date(today.now))} />}
      {countdown && <Countdown key={countdown.until} until={countdown.until} offsetMs={offsetMs} label={countdown.label} done={countdown.done} />}
      {breakNote && (
        <p className="time-clock__note">
          <Coffee size={16} aria-hidden /> {breakNote}
        </p>
      )}
      {session?.status === 'OPEN' && <OpenSession session={session} offsetMs={offsetMs} />}
      <ClockActions today={today} shift={shift} />
    </section>
  );
}
