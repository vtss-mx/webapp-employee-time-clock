import { Check } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';
import type { AttendanceAction, AttendanceActionResult, WorkSession } from '../../../types';
import { formatMinutes, formatTime } from '../../../utils/format';
import { haptic } from '../../../utils/haptics';
import { Button } from '../../ui/Button';
import { ResultPopup } from '../../ui/ResultPopup';
import { StatusMark } from '../../ui/StatusMark';
import { MinutesBadge } from '../MinutesBadge';
import { scheduleRange } from '../sessionFacts';
import { usePlaceLabel } from '../SessionTimeline';

type PlaceLabel = ReturnType<typeof usePlaceLabel>;

interface Recorded {
  /** Hora del registro (la del servidor). */
  at: string | null | undefined;
  /** Modalidad y sitio (entrada y salida). */
  where?: string;
  /** Retardo, salida anticipada o descanso de más (sin minutos no se dibuja). */
  badge?: ReactNode;
  details: Array<[label: string, value: string]>;
}

const lastBreak = (session: WorkSession) => session.breaks[session.breaks.length - 1];

/** Lo que importa de cada registro, a partir de la jornada que devolvió el servidor. */
const RECORDED: Record<AttendanceAction, (session: WorkSession, place: PlaceLabel) => Recorded> = {
  CHECK_IN: (session, place) => ({
    at: session.check_in_at,
    where: place(session.check_in_mode, session.check_in_site),
    badge: <MinutesBadge kind="late" minutes={session.late_minutes} />,
    details: [
      ['Horario', scheduleRange(session.scheduled_start, session.scheduled_end)],
      ['Salida a más tardar', formatTime(session.check_out_deadline)],
    ],
  }),
  BREAK_START: (session) => ({
    at: lastBreak(session).started_at,
    details: [
      ['Descanso', `${session.breaks.length} de ${session.breaks_allowed}`],
      ['Puede durar hasta', formatMinutes(session.break_minutes_allowed)],
    ],
  }),
  BREAK_END: (session) => ({
    at: lastBreak(session).ended_at,
    badge: <MinutesBadge kind="exceeded" minutes={lastBreak(session).exceeded_minutes} />,
    details: [['Duró', formatMinutes(lastBreak(session).minutes)]],
  }),
  CHECK_OUT: (session, place) => ({
    at: session.check_out_at,
    where: place(session.check_out_mode, session.check_out_site),
    badge: <MinutesBadge kind="early" minutes={session.early_leave_minutes} />,
    details: [
      ['Tiempo trabajado', formatMinutes(session.worked_minutes)],
      ['Tiempo en descanso', formatMinutes(session.break_minutes)],
    ],
  }),
};

/**
 * Registro hecho, en un popup: "Entrada registrada · a las 07:55 · En sitio · Planta Norte", con el
 * retardo (o la salida anticipada, o el descanso de más) y el detalle de esa acción. "Listo" (o
 * cerrarlo) vuelve a Mi asistencia.
 */
export function AttendanceResultCard({ result, onDone }: { result: AttendanceActionResult; onDone: () => void }) {
  const place = usePlaceLabel();
  const info: Recorded = result.session ? RECORDED[result.action](result.session, place) : { at: result.verification.verified_at, details: [] };
  // Confirmación táctil al aparecer el resultado (en teléfonos compatibles).
  useEffect(() => haptic('success'), []);
  const titleId = useId();
  return (
    <ResultPopup kind="success" labelledBy={titleId} onDismiss={onDone}>
      <div className="result-card result-card--popup attendance-result">
      <StatusMark kind="success" once />
      <header className="attendance-result__head">
        <h1 id={titleId}>{result.message}</h1>
        <p className="attendance-result__when">
          a las <strong>{formatTime(info.at)}</strong>
          {info.where && ` · ${info.where}`} {info.badge}
        </p>
      </header>
      {info.details.length > 0 && (
        <dl className="result-card__details stagger">
          {info.details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="result-card__actions">
        <Button variant="primary" size="lg" block icon={<Check size={20} />} onClick={onDone}>
          Listo
        </Button>
      </div>
      </div>
    </ResultPopup>
  );
}
