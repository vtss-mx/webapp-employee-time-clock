import { CalendarPlus, CalendarRange, CalendarX2, History, ListChecks, MapPinned, Repeat, TreePalm } from 'lucide-react';
import { useEffect } from 'react';
import { CheckPlaces } from '../../../components/attendance/employee/CheckPlaces';
import { DayOffCard } from '../../../components/attendance/employee/DayOffCard';
import { serverNow, serverOffset } from '../../../components/attendance/employee/serverTime';
import { TimeClockCard } from '../../../components/attendance/employee/TimeClockCard';
import { refreshAt } from '../../../components/attendance/employee/todayView';
import { SessionTimeline } from '../../../components/attendance/SessionTimeline';
import { ButtonLink } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Panel, PanelFooter, PanelHero, PanelSection } from '../../../components/ui/Panel';
import { RetryState } from '../../../components/ui/RetryState';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useAuth } from '../../../hooks/useAuth';
import { useResource } from '../../../hooks/useResource';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import type { AttendanceToday } from '../../../types';
import { businessToday, formatDate } from '../../../utils/format';

/** Margen tras la hora en que cambia lo permitido, para preguntar cuando el servidor ya la pasó. */
const REFRESH_MARGIN_MS = 1500;

/**
 * Vuelve a pedir "hoy" en el momento en que cambia lo que el servidor permite (se abre la ventana para
 * checar, empieza el turno, vence la salida): un solo temporizador que no redibuja nada mientras espera.
 */
function useRefreshAt(at: string | null, offsetMs: number, refresh: () => void) {
  useEffect(() => {
    if (!at) return undefined;
    const timer = window.setTimeout(refresh, Math.max(0, Date.parse(at) - serverNow(offsetMs)) + REFRESH_MARGIN_MS);
    return () => window.clearTimeout(timer);
  }, [at, offsetMs, refresh]);
}

/**
 * Lo principal de "hoy": el reloj checador con su turno; sin turno pero de vacaciones (o en un
 * festivo), su día libre; sin turno, cómo pedir uno.
 */
function TodayCard({ today, offsetMs }: { today: AttendanceToday; offsetMs: number }) {
  if (today.shift) return <TimeClockCard today={today} shift={today.shift} offsetMs={offsetMs} />;
  if (today.day_off) return <DayOffCard dayOff={today.day_off} today={businessToday(new Date(today.now))} message={today.message} />;
  return (
    <EmptyState
      icon={<CalendarX2 />}
      title="Aún no tienes un turno asignado"
      description="Cuando tu empresa te asigne uno, aquí registrarás tu entrada, tus descansos y tu salida con tu rostro y tu ubicación."
      action={
        <ButtonLink to={paths.employee.newShiftRequest} variant="primary" size="lg" icon={<CalendarPlus size={20} />}>
          Solicitar un turno
        </ButtonLink>
      }
    />
  );
}

/**
 * Inicio del empleado (/employee/attendance): su reloj checador. Qué puede registrar lo decide el
 * servidor (`today.actions`); cada registro abre su pantalla (rostro + ubicación) y, al volver, esta
 * pantalla se monta de nuevo y pide "hoy" otra vez. Al pie: su historial, cambios de turno y sus días
 * libres (vacaciones, permisos y festivos).
 */
export function MyAttendancePage() {
  const { user } = useAuth();
  // La diferencia con la hora del servidor se calcula UNA vez, al recibir la respuesta.
  const { data, error, retry } = useResource(
    (signal) => attendanceService.today(signal).then((today) => ({ today, offsetMs: serverOffset(today.now) })),
    'today',
    'No se pudo cargar tu asistencia',
  );
  useRefreshAt(data && refreshAt(data.today), data?.offsetMs ?? 0, retry);
  const firstName = user?.employee?.first_name;

  if (!data) {
    return error ? (
      <div className="page">
        <Panel>
          <PanelHero eyebrow="Mi asistencia" title="Tu reloj checador" />
          <PanelSection>
            <RetryState onRetry={retry} />
          </PanelSection>
        </Panel>
      </div>
    ) : (
      <SkeletonCard lines={6} />
    );
  }

  const { today, offsetMs } = data;
  const shift = today.shift;
  return (
    <div className="page page-transition my-attendance">
      <Panel>
        <PanelHero eyebrow="Mi asistencia" title={firstName ? `Hola, ${firstName}` : 'Hola'}>
          <p className="muted">{formatDate(today.now)}</p>
        </PanelHero>
        <PanelSection>
          <TodayCard today={today} offsetMs={offsetMs} />
        </PanelSection>
        {today.session && (
          <PanelSection title="Tu jornada" icon={<CalendarRange size={20} />}>
            <SessionTimeline session={today.session} />
          </PanelSection>
        )}
        {shift && (
          <PanelSection title={today.occurrence || today.session ? 'Dónde puedes checar hoy' : 'Dónde checarás tu próxima jornada'} icon={<MapPinned size={20} />}>
            <CheckPlaces today={today} />
          </PanelSection>
        )}
        <PanelFooter align="between">
          <ButtonLink to={paths.employee.attendanceHistory} variant="secondary" size="lg" icon={<History size={20} />}>
            Historial
          </ButtonLink>
          <ButtonLink to={paths.employee.shiftRequests} variant="secondary" size="lg" icon={shift ? <Repeat size={20} /> : <ListChecks size={20} />}>
            {shift ? 'Cambio de turno' : 'Mis solicitudes'}
          </ButtonLink>
          <ButtonLink to={paths.employee.daysOff} variant="secondary" size="lg" icon={<TreePalm size={20} />}>
            Mis días libres
          </ButtonLink>
        </PanelFooter>
      </Panel>
    </div>
  );
}
