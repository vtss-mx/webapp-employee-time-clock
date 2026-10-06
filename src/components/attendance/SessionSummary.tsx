import type { ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import type { WorkSession } from '../../types';
import { formatDateTime, formatMinutes } from '../../utils/format';
import { CatalogStatusBadge } from '../StatusBadge';
import { MinutesBadge } from './MinutesBadge';
import { ReviewFact } from './ReviewParts';
import { clockOn, exceededMinutes, scheduleRange } from './sessionFacts';
import { usePlaceLabel } from './SessionTimeline';

function Fact({ label, children, note, className }: { label: string; children: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>
        <span className="att-fact">{children}</span>
        {note && <span className="att-fact__note">{note}</span>}
      </dd>
    </div>
  );
}

/** La salida: su hora (con la salida anticipada), sin salida, o hasta cuándo se puede checar. */
function CheckOutFact({ session }: { session: WorkSession }) {
  const t = useT();
  const place = usePlaceLabel();
  const label = t('attendance.fields.checkOut');
  if (session.check_out_at) {
    return (
      <Fact label={label} note={place(session.check_out_mode, session.check_out_site)}>
        {clockOn(session.check_out_at, session.work_date)} <MinutesBadge kind="early" minutes={session.early_leave_minutes} />
      </Fact>
    );
  }
  const deadline = clockOn(session.check_out_deadline, session.work_date);
  return session.status === 'MISSED_CHECKOUT' ? (
    <Fact label={label} note={t('attendance.summary.deadlinePassed', { time: deadline })}>
      <CatalogStatusBadge catalog="work_session_statuses" code="MISSED_CHECKOUT" />
    </Fact>
  ) : (
    <Fact label={label} note={t('attendance.summary.deadline', { time: deadline })}>
      {t('attendance.pending')}
    </Fact>
  );
}

/** La registró o la corrigió la empresa: su motivo y cuándo (solo lectura, también para el empleado). */
function CompanyFact({ session }: { session: WorkSession }) {
  const { nameOf } = useCatalogs();
  if (!session.edited_at) return null;
  return (
    <Fact label={nameOf('work_modes', 'COMPANY')} note={formatDateTime(session.edited_at)} className="att-summary__company">
      {session.edit_reason ?? '—'}
    </Fact>
  );
}

/**
 * Resumen de una jornada: lo programado contra lo real. Horario, entrada (retardo, modalidad y sitio),
 * salida (anticipada, pendiente o sin salida), descansos usados de los permitidos, minutos en descanso
 * contra los permitidos (con los de más) y el tiempo trabajado. Si la registró o la corrigió la
 * empresa, al final va su motivo y cuándo; si el motor de riesgo la dejó "en revisión", su estado, sus motivos (solo
 * la empresa) y la nota de la decisión. Todo lo calculó el backend.
 *
 *   <SessionSummary session={session} />
 */
export function SessionSummary({ session }: { session: WorkSession }) {
  const t = useT();
  const place = usePlaceLabel();
  return (
    <dl className="details att-summary">
      <Fact label={t('attendance.fields.schedule')} note={session.shift_name}>
        {scheduleRange(session.scheduled_start, session.scheduled_end)}
      </Fact>
      <Fact label={t('attendance.fields.checkIn')} note={place(session.check_in_mode, session.check_in_site)}>
        {clockOn(session.check_in_at, session.work_date)} <MinutesBadge kind="late" minutes={session.late_minutes} />
      </Fact>
      <CheckOutFact session={session} />
      <Fact
        label={t('attendance.fields.breaks')}
        note={session.breaks_allowed ? t('attendance.summary.breakEach', { duration: formatMinutes(session.break_minutes_allowed) }) : t('attendance.breaks.none')}
      >
        {t('attendance.summary.breaksUsed', { used: session.breaks.length, allowed: session.breaks_allowed })}
      </Fact>
      <Fact label={t('attendance.fields.breakTime')}>
        {formatMinutes(session.break_minutes)} <MinutesBadge kind="exceeded" minutes={exceededMinutes(session)} />
      </Fact>
      <Fact label={t('attendance.fields.workedTime')} note={session.worked_minutes == null && t('attendance.summary.workedPending')}>
        {formatMinutes(session.worked_minutes)}
      </Fact>
      <CompanyFact session={session} />
      <ReviewFact session={session} />
    </dl>
  );
}
