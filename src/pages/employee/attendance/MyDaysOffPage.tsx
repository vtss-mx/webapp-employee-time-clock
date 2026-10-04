import { CalendarX, PartyPopper, Plus, TreePalm } from 'lucide-react';
import { AbsenceItem } from '../../../components/attendance/employee/AbsenceItem';
import { AttendanceList } from '../../../components/attendance/employee/AttendanceItem';
import { HolidayList } from '../../../components/attendance/employee/HolidayList';
import { absenceFacts } from '../../../components/calendar/calendarRules';
import { ButtonLink } from '../../../components/ui/Button';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useAction } from '../../../hooks/useAction';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { usePagedList } from '../../../hooks/usePagedList';
import { paths } from '../../../routes/paths';
import { calendarService } from '../../../services/calendarService';
import type { Absence } from '../../../types';

/** Festivos por página: es un vistazo de lo que viene (la lista completa se pagina igual). */
const HOLIDAYS_PAGE = 5;

/**
 * Mis días libres (/employee/attendance/days-off): mis vacaciones y permisos (los que pedí y los que
 * registró mi empresa, con su estado y la respuesta de la empresa; uno pendiente se puede cancelar) y
 * los próximos días festivos de mi empresa. Ambas listas se paginan en el servidor. "Solicitar
 * vacaciones o permiso" abre su formulario.
 */
export function MyDaysOffPage() {
  const absences = usePagedList((page, signal) => calendarService.myAbsences(page, signal), { errorTitle: 'No se pudieron cargar tus vacaciones y permisos' });
  const holidays = usePagedList((page, signal) => calendarService.myHolidays(page, signal), { errorTitle: 'No se pudieron cargar los días festivos', pageSize: HOLIDAYS_PAGE });
  const { busy, run } = useAction<number>();
  const { nameOf } = useCatalogs();

  const cancel = (absence: Absence) => {
    const kind = nameOf('day_off_types', absence.type);
    void run(() => calendarService.cancelMyAbsence(absence.id), {
      busy: absence.id,
      confirm: {
        kind: 'delete',
        icon: <CalendarX size={30} />,
        eyebrow: 'Tu solicitud',
        title: `¿Cancelar tu solicitud de ${kind.toLowerCase()}?`,
        message: 'Se retirará y tu empresa ya no la revisará. Si la necesitas, puedes pedirla de nuevo.',
        // Es suya: no hace falta decir de quién es.
        details: absenceFacts({ ...absence, employee: undefined }, kind),
        confirmLabel: 'Cancelar solicitud',
        confirmIcon: <CalendarX size={18} />,
        cancelLabel: 'Conservarla',
      },
      errorTitle: 'No se pudo cancelar la solicitud',
      onSuccess: absences.retry,
    });
  };

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Mis días libres"
          subtitle="Tus vacaciones y permisos, y los próximos días festivos de tu empresa."
          backTo={paths.employee.attendance}
          backLabel="Mi asistencia"
          actions={
            <ButtonLink to={paths.employee.newAbsenceRequest} variant="primary" size="lg" icon={<Plus size={20} />}>
              Solicitar vacaciones o permiso
            </ButtonLink>
          }
        />
        <PanelSection title="Mis vacaciones y permisos" icon={<TreePalm size={20} />}>
          <PagedItems
            list={absences}
            skeletonRows={3}
            empty={{
              icon: <TreePalm />,
              title: 'Aún no tienes vacaciones ni permisos',
              description: 'Cuando pidas días libres (o tu empresa te los registre), aquí verás sus fechas y si se aprobaron.',
            }}
            pager={{ noun: { one: 'ausencia', other: 'ausencias' } }}
          >
            {(items) => (
              <AttendanceList loading={absences.loading}>
                {items.map((absence) => (
                  <AbsenceItem key={absence.id} absence={absence} busy={busy === absence.id} onCancel={() => cancel(absence)} />
                ))}
              </AttendanceList>
            )}
          </PagedItems>
        </PanelSection>
        <PanelSection title="Próximos días festivos" icon={<PartyPopper size={20} />}>
          <PagedItems
            list={holidays}
            skeletonRows={2}
            empty={{
              icon: <PartyPopper />,
              compact: true,
              title: 'Sin días festivos próximos',
              description: 'Los días festivos que registre tu empresa aparecerán aquí: esos días no se trabaja.',
            }}
            pager={{ noun: { one: 'día festivo', other: 'días festivos' }, variant: 'compact', sizes: [HOLIDAYS_PAGE, 10, 20] }}
          >
            {(items) => <HolidayList holidays={items} loading={holidays.loading} />}
          </PagedItems>
        </PanelSection>
      </Panel>
    </div>
  );
}
