import { PartyPopper, Plus, TreePalm } from 'lucide-react';
import { AbsenceItem } from '../../../components/attendance/employee/AbsenceItem';
import { AttendanceList, cancelRequestConfirm } from '../../../components/attendance/employee/AttendanceItem';
import { HolidayList } from '../../../components/attendance/employee/HolidayList';
import { absenceFacts } from '../../../components/calendar/calendarRules';
import { ButtonLink } from '../../../components/ui/Button';
import { PagedItems } from '../../../components/ui/PagedItems';
import { Panel, PanelHeader, PanelSection } from '../../../components/ui/Panel';
import { useAction } from '../../../hooks/useAction';
import { useCatalogs } from '../../../hooks/useCatalogs';
import { usePagedList } from '../../../hooks/usePagedList';
import { t, useT } from '../../../i18n';
import { paths } from '../../../routes/paths';
import { calendarService } from '../../../services/calendarService';
import type { Absence } from '../../../types';
import type { ConfirmInput } from '../../../types/confirm';

/** Festivos por página: es un vistazo de lo que viene (la lista completa se pagina igual). */
const HOLIDAYS_PAGE = 5;

// Títulos de los popups (se arman al dibujarse: siguen al idioma activo).
const absencesError = () => t('myAttendance.daysOff.absencesError');
const holidaysError = () => t('myAttendance.daysOff.holidaysError');
const cancelError = () => t('myAttendance.cancelRequest.error');

/** Cancelar unas vacaciones o un permiso pendientes: el tipo (nombre del catálogo), sus fechas y su nota. */
function absenceCancelConfirm(absence: Absence, typeName: string): ConfirmInput {
  return cancelRequestConfirm({
    title: t('myAttendance.daysOff.cancel.title', { type: typeName.toLowerCase() }),
    message: t('myAttendance.daysOff.cancel.message'),
    // Es suya: no hace falta decir de quién es.
    details: absenceFacts({ ...absence, employee: undefined }, typeName),
  });
}

/**
 * Mis días libres (/employee/attendance/days-off): mis vacaciones y permisos (los que pedí y los que
 * registró mi empresa, con su estado y la respuesta de la empresa; uno pendiente se puede cancelar) y
 * los próximos días festivos de mi empresa. Ambas listas se paginan en el servidor. "Solicitar
 * vacaciones o permiso" abre su formulario.
 */
export function MyDaysOffPage() {
  const t = useT();
  const absences = usePagedList((page, signal) => calendarService.myAbsences(page, signal), { errorTitle: absencesError });
  const holidays = usePagedList((page, signal) => calendarService.myHolidays(page, signal), { errorTitle: holidaysError, pageSize: HOLIDAYS_PAGE });
  const { busy, run } = useAction<number>();
  const { nameOf } = useCatalogs();

  const cancel = (absence: Absence) =>
    void run(() => calendarService.cancelMyAbsence(absence.id), {
      busy: absence.id,
      confirm: () => absenceCancelConfirm(absence, nameOf('day_off_types', absence.type)),
      errorTitle: cancelError,
      onSuccess: absences.retry,
    });

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title={t('myAttendance.home.daysOff')}
          subtitle={t('myAttendance.daysOff.subtitle')}
          backTo={paths.employee.attendance}
          backLabel={t('myAttendance.home.eyebrow')}
          actions={
            <ButtonLink to={paths.employee.newAbsenceRequest} variant="primary" size="lg" icon={<Plus size={20} />}>
              {t('myAttendance.daysOff.request')}
            </ButtonLink>
          }
        />
        <PanelSection title={t('myAttendance.daysOff.absences')} icon={<TreePalm size={20} />}>
          <PagedItems
            list={absences}
            skeletonRows={3}
            empty={{
              icon: <TreePalm />,
              title: t('myAttendance.daysOff.absencesEmpty.title'),
              description: t('myAttendance.daysOff.absencesEmpty.description'),
            }}
            pager={{ noun: { one: t('myAttendance.daysOff.absencesNoun.one'), other: t('myAttendance.daysOff.absencesNoun.other') } }}
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
        <PanelSection title={t('myAttendance.daysOff.holidays')} icon={<PartyPopper size={20} />}>
          <PagedItems
            list={holidays}
            skeletonRows={2}
            empty={{
              icon: <PartyPopper />,
              compact: true,
              title: t('myAttendance.daysOff.holidaysEmpty.title'),
              description: t('myAttendance.daysOff.holidaysEmpty.description'),
            }}
            pager={{ noun: { one: t('myAttendance.daysOff.holidaysNoun.one'), other: t('myAttendance.daysOff.holidaysNoun.other') }, variant: 'compact', sizes: [HOLIDAYS_PAGE, 10, 20] }}
          >
            {(items) => <HolidayList holidays={items} loading={holidays.loading} />}
          </PagedItems>
        </PanelSection>
      </Panel>
    </div>
  );
}
