import type { ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import type { WorkSession } from '../../types';
import { formatDateTime, formatMinutes } from '../../utils/format';
import { CatalogStatusBadge } from '../StatusBadge';
import { MinutesBadge } from './MinutesBadge';
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
  const place = usePlaceLabel();
  if (session.check_out_at) {
    return (
      <Fact label="Salida" note={place(session.check_out_mode, session.check_out_site)}>
        {clockOn(session.check_out_at, session.work_date)} <MinutesBadge kind="early" minutes={session.early_leave_minutes} />
      </Fact>
    );
  }
  const deadline = clockOn(session.check_out_deadline, session.work_date);
  return session.status === 'MISSED_CHECKOUT' ? (
    <Fact label="Salida" note={`El límite fue a las ${deadline}`}>
      <CatalogStatusBadge catalog="work_session_statuses" code="MISSED_CHECKOUT" />
    </Fact>
  ) : (
    <Fact label="Salida" note={`Se puede checar hasta las ${deadline}`}>
      Pendiente
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
 * empresa, al final va su motivo y cuándo. Todo lo calculó el backend.
 *
 *   <SessionSummary session={session} />
 */
export function SessionSummary({ session }: { session: WorkSession }) {
  const place = usePlaceLabel();
  return (
    <dl className="details att-summary">
      <Fact label="Horario" note={session.shift_name}>
        {scheduleRange(session.scheduled_start, session.scheduled_end)}
      </Fact>
      <Fact label="Entrada" note={place(session.check_in_mode, session.check_in_site)}>
        {clockOn(session.check_in_at, session.work_date)} <MinutesBadge kind="late" minutes={session.late_minutes} />
      </Fact>
      <CheckOutFact session={session} />
      <Fact label="Descansos" note={session.breaks_allowed ? `De ${formatMinutes(session.break_minutes_allowed)} cada uno` : 'Su turno no tiene descansos'}>
        {session.breaks.length} de {session.breaks_allowed}
      </Fact>
      <Fact label="Tiempo en descanso">
        {formatMinutes(session.break_minutes)} <MinutesBadge kind="exceeded" minutes={exceededMinutes(session)} />
      </Fact>
      <Fact label="Tiempo trabajado" note={session.worked_minutes == null && 'Se calcula al checar la salida'}>
        {formatMinutes(session.worked_minutes)}
      </Fact>
      <CompanyFact session={session} />
    </dl>
  );
}
