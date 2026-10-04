import { CalendarDays, History } from 'lucide-react';
import { AttendanceItem, AttendanceList } from '../../../components/attendance/employee/AttendanceItem';
import { SessionSummary } from '../../../components/attendance/SessionSummary';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { usePagedList } from '../../../hooks/usePagedList';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import { formatDate } from '../../../utils/format';

/**
 * Mi historial (/employee/attendance/history): mis jornadas, de la más reciente a la más antigua y
 * paginadas en el servidor. Cada una con su día, turno, estado y el resumen de lo programado contra lo
 * real (entrada, salida, retardo, salida anticipada, descansos y tiempo trabajado).
 */
export function MyAttendanceHistoryPage() {
  const list = usePagedList((page, signal) => attendanceService.history(page, signal), { errorTitle: 'No se pudo cargar tu historial' });
  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Mi historial"
          subtitle="Tus jornadas: a qué hora entraste y saliste, tus descansos y lo que trabajaste."
          backTo={paths.employee.attendance}
          backLabel="Mi asistencia"
        />
        <PanelSection>
          <PagedItems
            list={list}
            skeletonRows={4}
            empty={{
              icon: <History />,
              title: 'Aún no tienes jornadas',
              description: 'Cada turno que registres (entrada, descansos y salida) aparecerá aquí con su resumen.',
            }}
            pager={{ noun: { one: 'jornada', other: 'jornadas' } }}
          >
            {(sessions) => (
              <AttendanceList loading={list.loading}>
                {sessions.map((session) => (
                  <AttendanceItem
                    key={session.id}
                    icon={<CalendarDays size={20} />}
                    title={formatDate(session.work_date)}
                    detail={`Turno ${session.shift_name}`}
                    badges={<CatalogStatusBadge catalog="work_session_statuses" code={session.status} />}
                  >
                    <SessionSummary session={session} />
                  </AttendanceItem>
                ))}
              </AttendanceList>
            )}
          </PagedItems>
        </PanelSection>
      </Panel>
    </div>
  );
}
