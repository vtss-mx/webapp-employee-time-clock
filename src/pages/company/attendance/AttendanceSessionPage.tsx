import { ClipboardList, ListChecks, PencilLine } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';
import { EventTimeline } from '../../../components/attendance/EventTimeline';
import { SessionSummary } from '../../../components/attendance/SessionSummary';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { ButtonLink } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useResource } from '../../../hooks/useResource';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import { formatDate } from '../../../utils/format';

/**
 * A dónde regresa el detalle: al historial si se abrió desde él; si no, al tablero del día de la
 * jornada (`?date=`), para seguir viendo ese mismo día.
 */
function useBackLink(workDate: string | undefined) {
  const fromHistory = (useLocation().state as { from?: string } | null)?.from === 'history';
  if (fromHistory) return { backTo: paths.company.attendanceHistory, backLabel: 'Historial de asistencia' };
  return { backTo: workDate ? `${paths.company.attendance}?date=${workDate}` : paths.company.attendance, backLabel: 'Asistencia del día' };
}

/**
 * Una jornada con su evidencia (COMPANY): quién, qué día y en qué turno; el resumen de lo programado
 * contra lo real (retardo, salida anticipada, descansos y tiempo trabajado) y la bitácora de sus
 * registros con la evidencia de cada uno (modalidad, sitio y distancia, precisión, confianza del
 * rostro, quién lo operó y el enlace al mapa). "Corregir" abre sus horas y descansos para que la
 * empresa los corrija con un motivo (lo anterior queda en la bitácora).
 */
export function AttendanceSessionPage() {
  const sessionId = Number(useParams().id);
  const { data: session, error, retry } = useResource((signal) => attendanceService.session(sessionId, signal), sessionId, 'No se pudo cargar la jornada');
  const back = useBackLink(session?.work_date);

  if (!session) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title="Jornada" {...back} />
          <PanelSection>
            <RetryState onRetry={retry} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={8} />
    );
  }

  const { employee, events } = session;
  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={employee.full_name}
          subtitle={`${employee.employee_number} · ${formatDate(session.work_date)} · ${session.shift_name}`}
          {...back}
          actions={
            <>
              <CatalogStatusBadge catalog="work_session_statuses" code={session.status} />
              <ButtonLink to={paths.company.correctAttendanceSession(session.id)} variant="secondary" icon={<PencilLine size={18} />}>
                Corregir
              </ButtonLink>
            </>
          }
        />
        <PanelSection title="Resumen" icon={<ClipboardList size={20} />}>
          <SessionSummary session={session} />
        </PanelSection>
        <PanelSection title="Registros y evidencia" icon={<ListChecks size={20} />} aside={<span className="muted small">{events.length === 1 ? '1 registro' : `${events.length} registros`}</span>}>
          {events.length ? (
            <EventTimeline events={events} workDate={session.work_date} />
          ) : (
            <EmptyState compact icon={<ListChecks />} title="Sin registros" description="Esta jornada no tiene registros en su bitácora." />
          )}
        </PanelSection>
      </Panel>
    </div>
  );
}
