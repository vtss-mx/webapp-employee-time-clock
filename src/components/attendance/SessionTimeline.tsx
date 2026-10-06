import { CircleSlash, Hourglass } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { WorkBreak, WorkSession } from '../../types';
import { formatMinutes, formatTime } from '../../utils/format';
import { CatalogStatusBadge } from '../StatusBadge';
import { CompanyEditNote } from './CompanyRecord';
import { MinutesBadge } from './MinutesBadge';
import { ACTION_ICONS, clockOn } from './sessionFacts';
import { AttendanceTimeline, TimelineStep } from './Timeline';

/** Modalidad y sitio de un registro: "En sitio · Planta Norte", "Remoto". */
export function usePlaceLabel() {
  const { nameOf } = useCatalogs();
  return (mode: string | null, site: string | null) => [nameOf('work_modes', mode), site].filter(Boolean).join(' · ');
}

function BreakStep({ item, index, session }: { item: WorkBreak; index: number; session: WorkSession }) {
  const t = useT();
  const start = clockOn(item.started_at, session.work_date);
  const title = t('attendance.breaks.item', { number: index + 1 });
  const allowed = formatMinutes(session.break_minutes_allowed);
  if (!item.ended_at) {
    return (
      <TimelineStep icon={ACTION_ICONS.BREAK_START} tone="current" title={title} time={t('attendance.timeline.since', { time: start })} badges={<CatalogStatusBadge catalog="board_states" code="ON_BREAK" />}>
        {t('attendance.timeline.breakLimit', { duration: allowed })}
      </TimelineStep>
    );
  }
  return (
    <TimelineStep icon={ACTION_ICONS.BREAK_START} tone="break" title={title} time={`${start} – ${clockOn(item.ended_at, session.work_date)}`} badges={<MinutesBadge kind="exceeded" minutes={item.exceeded_minutes} />}>
      {t('attendance.timeline.breakUsed', { used: formatMinutes(item.minutes), allowed })}
    </TimelineStep>
  );
}

/** La salida: registrada (con lo trabajado), pendiente (hasta qué hora) o vencida sin registrar. */
function CheckOutStep({ session }: { session: WorkSession }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const place = usePlaceLabel();
  const title = nameOf('attendance_actions', 'CHECK_OUT');
  const scheduled = formatTime(session.scheduled_end);
  const deadline = clockOn(session.check_out_deadline, session.work_date);
  if (session.check_out_at) {
    return (
      <TimelineStep icon={ACTION_ICONS.CHECK_OUT} tone="out" title={title} time={clockOn(session.check_out_at, session.work_date)} badges={<MinutesBadge kind="early" minutes={session.early_leave_minutes} />}>
        <span>{t('attendance.timeline.scheduled', { time: scheduled, place: place(session.check_out_mode, session.check_out_site) })}</span>
        <span className="att-step__total">{t('attendance.timeline.worked', { duration: formatMinutes(session.worked_minutes) })}</span>
      </TimelineStep>
    );
  }
  if (session.status === 'MISSED_CHECKOUT') {
    return (
      <TimelineStep icon={CircleSlash} tone="missed" title={title} time="—" badges={<CatalogStatusBadge catalog="work_session_statuses" code="MISSED_CHECKOUT" />}>
        {t('attendance.timeline.missed', { time: scheduled, deadline })}
      </TimelineStep>
    );
  }
  return (
    <TimelineStep icon={Hourglass} tone="pending" title={title} time={t('attendance.pending')}>
      {t('attendance.timeline.pending', { time: scheduled, deadline })}
    </TimelineStep>
  );
}

/**
 * La jornada como línea de tiempo, a partir de la jornada misma (sin la bitácora): la entrada (con su
 * retardo, modalidad y sitio), cada descanso (de qué hora a qué hora, cuánto duró y los minutos de
 * más; el que sigue en curso se resalta) y la salida (con la salida anticipada y el tiempo trabajado,
 * o pendiente / sin salida). Si la registró o la corrigió la empresa, arriba va su insignia con el
 * motivo (`CompanyEditNote`). Sirve igual a la empresa y al empleado ("Mi asistencia").
 *
 *   <SessionTimeline session={session} />
 */
export function SessionTimeline({ session }: { session: WorkSession }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const place = usePlaceLabel();
  return (
    <>
      <CompanyEditNote session={session} />
      <AttendanceTimeline label={t('attendance.timeline.label', { shift: session.shift_name })}>
        <TimelineStep
          icon={ACTION_ICONS.CHECK_IN}
          tone="in"
          title={nameOf('attendance_actions', 'CHECK_IN')}
          time={clockOn(session.check_in_at, session.work_date)}
          badges={<MinutesBadge kind="late" minutes={session.late_minutes} />}
        >
          {t('attendance.timeline.scheduled', { time: formatTime(session.scheduled_start), place: place(session.check_in_mode, session.check_in_site) })}
        </TimelineStep>
        {session.breaks.map((item, index) => (
          <BreakStep key={item.started_at} item={item} index={index} session={session} />
        ))}
        <CheckOutStep session={session} />
      </AttendanceTimeline>
    </>
  );
}
