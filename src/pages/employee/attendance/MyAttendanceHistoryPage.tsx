import { CalendarDays, History } from 'lucide-react';
import { AttendanceItem, AttendanceList } from '../../../components/attendance/employee/AttendanceItem';
import { SessionSummary } from '../../../components/attendance/SessionSummary';
import { CatalogStatusBadge } from '../../../components/StatusBadge';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { usePagedList } from '../../../hooks/usePagedList';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { attendanceService } from '../../../services/attendanceService';
import { formatDate } from '../../../utils/format';

/** Título del popup si el historial no carga (se arma al dibujarse: sigue al idioma activo). */
const loadError = () => t('myAttendance.history.loadError');

/**
 * Mi historial (/employee/attendance/history): mis jornadas, de la más reciente a la más antigua y
 * paginadas en el servidor. Cada una con su día, turno, estado y el resumen de lo programado contra lo
 * real (entrada, salida, retardo, salida anticipada, descansos y tiempo trabajado).
 */
export function MyAttendanceHistoryPage() {
  const t = useT();
  const list = usePagedList((page, signal) => attendanceService.history(page, signal), { errorTitle: loadError });
  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('myAttendance.history.title')}
          subtitle={t('myAttendance.history.subtitle')}
          backTo={paths.employee.attendance}
          backLabel={t('myAttendance.home.eyebrow')}
        />
        <PanelSection>
          <PagedItems
            list={list}
            skeletonRows={4}
            empty={{
              icon: <History />,
              title: t('myAttendance.history.empty.title'),
              description: t('myAttendance.history.empty.description'),
            }}
            pager={{ noun: { one: t('myAttendance.history.noun.one'), other: t('myAttendance.history.noun.other') } }}
          >
            {(sessions) => (
              <AttendanceList loading={list.loading}>
                {sessions.map((session) => (
                  <AttendanceItem
                    key={session.id}
                    icon={<CalendarDays size={20} />}
                    title={formatDate(session.work_date)}
                    detail={t('myAttendance.history.shift', { name: session.shift_name })}
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
