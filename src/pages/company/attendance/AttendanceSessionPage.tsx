import { ClipboardList, ListChecks, PencilLine } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';
import { EventTimeline } from '../../../components/attendance/EventTimeline';
import { ReviewActions, ReviewBadge } from '../../../components/attendance/ReviewParts';
import { SessionSummary } from '../../../components/attendance/SessionSummary';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { DeletedMark } from '../../../components/ui/DeletedMark';
import { ButtonLink } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useResource } from '../../../hooks/useResource';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import { formatDate } from '../../../utils/format';

/**
 * A dónde regresa el detalle: al historial si se abrió desde él; si no, al tablero del día de la
 * jornada (`?date=`), para seguir viendo ese mismo día.
 */
function useBackLink(workDate: string | undefined) {
  const t = useT();
  const fromHistory = (useLocation().state as { from?: string } | null)?.from === 'history';
  if (fromHistory) return { backTo: paths.company.attendanceHistory, backLabel: t('attendance.nav.history') };
  return { backTo: workDate ? `${paths.company.attendance}?date=${workDate}` : paths.company.attendance, backLabel: t('attendance.nav.dayBoard') };
}

/** Título del popup si la jornada no carga (se arma al dibujarse: sigue al idioma activo). */
const sessionLoadError = () => t('attendance.detail.loadError');

/**
 * Una jornada con su evidencia (COMPANY): quién, qué día y en qué turno; el resumen de lo programado
 * contra lo real (retardo, salida anticipada, descansos y tiempo trabajado) y la bitácora de sus
 * registros con la evidencia de cada uno (modalidad, sitio y distancia, precisión, confianza del
 * rostro, quién lo operó y el enlace al mapa). "Corregir" abre sus horas y descansos para que la
 * empresa los corrija con un motivo (lo anterior queda en la bitácora). Si el motor de riesgo la dejó "en revisión",
 * la empresa la confirma o la rechaza (con una nota que verá el empleado).
 */
export function AttendanceSessionPage() {
  const t = useT();
  const sessionId = Number(useParams().id);
  const { data: session, setData, error, retry } = useResource((signal) => attendanceService.session(sessionId, signal), sessionId, sessionLoadError);
  const back = useBackLink(session?.work_date);

  if (!session) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHeader title={t('attendance.nav.session')} {...back} />
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
              <DeletedMark deleted={employee.deleted} />
              <CatalogStatusBadge catalog="work_session_statuses" code={session.status} />
              <ReviewBadge session={session} />
              <ButtonLink to={paths.company.correctAttendanceSession(session.id)} variant="secondary" icon={<PencilLine size={18} />}>
                {t('attendance.board.correct')}
              </ButtonLink>
            </>
          }
        />
        <PanelSection title={t('attendance.detail.summary')} icon={<ClipboardList size={20} />}>
          <ReviewActions session={session} onChange={setData} />
          <SessionSummary session={session} />
        </PanelSection>
        <PanelSection title={t('attendance.detail.events')} icon={<ListChecks size={20} />} aside={<span className="muted small">{t('attendance.detail.eventCount', { count: events.length })}</span>}>
          {events.length ? (
            <EventTimeline events={events} workDate={session.work_date} />
          ) : (
            <EmptyState compact icon={<ListChecks />} title={t('attendance.detail.noEvents.title')} description={t('attendance.detail.noEvents.description')} />
          )}
        </PanelSection>
      </Panel>
    </div>
  );
}
