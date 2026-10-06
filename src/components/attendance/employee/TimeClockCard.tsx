import { CalendarClock, Coffee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { useConfirm } from '../../../hooks/useConfirm';
import { t, useT } from '../../../i18n';
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
import type { SiteCodeIntent } from './SiteCodeStep';
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
  const t = useT();
  return (
    <div className="time-clock__shift">
      <span className="time-clock__eyebrow">{shift.name}</span>
      <strong className="time-clock__hours">{shiftSchedule(shift)}</strong>
      <span className="time-clock__days">{weekdaysLabel(shift.weekdays)}</span>
      {next && (
        <span className="time-clock__days">
          <CalendarClock size={16} aria-hidden /> {t('myAttendance.clock.nextWorkday', { date: formatDate(next.work_date), time: formatTime(next.opens) })}
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
  const t = useT();
  const place = usePlaceLabel();
  const pause = openBreak(session);
  return (
    <dl className="time-clock__facts">
      <div>
        <dt>{t('myAttendance.clock.checkIn')}</dt>
        <dd>
          {formatTime(session.check_in_at)} <small>{place(session.check_in_mode, session.check_in_site)}</small>
        </dd>
      </div>
      <div>
        <dt>{t('myAttendance.clock.worked')}</dt>
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
          <dt>{t('myAttendance.clock.onBreakSince')}</dt>
          <dd>{formatTime(pause.started_at)}</dd>
        </div>
      )}
      {session.breaks_allowed > 0 && (
        <div>
          <dt>{t('myAttendance.clock.breaks')}</dt>
          <dd>
            {t('myAttendance.clock.breaksUsed', { used: session.breaks.length, allowed: session.breaks_allowed })}{' '}
            <small>{t('myAttendance.clock.breakLength', { duration: formatMinutes(session.break_minutes_allowed) })}</small>
          </dd>
        </div>
      )}
    </dl>
  );
}

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
    const Icon = ACTION_ICONS[action];
    // Se arma al dibujarse: la confirmación abierta sigue al idioma activo.
    const ok = await confirm(() => {
      const name = nameOf('attendance_actions', action);
      return {
        kind: 'create',
        icon: <Icon size={30} />,
        eyebrow: t('myAttendance.home.eyebrow'),
        title: t('myAttendance.record.confirm.title', { action: name.toLowerCase() }),
        message: t('myAttendance.record.confirm.message'),
        details: [{ label: t('myAttendance.labels.shift'), value: `${shift.name} · ${shiftSchedule(shift)}` }],
        // Lo que se aclara: la salida cierra la jornada.
        note: action === 'CHECK_OUT' ? t('myAttendance.record.confirm.checkOutNote') : undefined,
        confirmLabel: recordLabel(name),
        confirmIcon: <Icon size={18} />,
      };
    });
    // El registro sabe si el sitio pide su código y si hoy se puede checar remoto (antifraude 2b; `SiteCodeStep`).
    const intent: SiteCodeIntent = { siteCode: today.site_code, remoteAllowed: today.remote_allowed };
    if (ok) void navigate(paths.employee.recordAttendance(ATTENDANCE_SLUGS[action]), { state: intent });
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
  const t = useT();
  const state = clockState(today);
  const countdown = clockCountdown(today);
  const breakNote = breakWindowText(today);
  const session = today.session;
  return (
    <section className="time-clock" aria-label={t('myAttendance.clock.label')}>
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
