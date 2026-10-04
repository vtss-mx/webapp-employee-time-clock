import { Check, Inbox, X } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { notifyAbsenceRequestsChanged } from '../../hooks/usePendingAbsenceRequests';
import { paths } from '../../routes/paths';
import { calendarService } from '../../services/calendarService';
import type { Absence } from '../../types';
import { Button, ButtonLink } from '../ui/Button';
import { PagedItems } from '../ui/PagedItems';
import { AbsenceItem } from './AbsenceItem';
import { absenceFacts, isStale, rangeText } from './calendarRules';

/**
 * Pestaña "Solicitudes": las vacaciones y permisos que pidieron los empleados y esperan respuesta,
 * con "Aprobar" (sus días quedan libres) y "Rechazar" (con una nota que el empleado verá). Informa
 * cuántas hay (`onTotal`) para el contador de la pestaña.
 */
export function RequestsTab({ onTotal }: { onTotal: (pending: number) => void }) {
  const list = usePagedList(
    async (page, signal) => {
      const result = await calendarService.absences({ ...page, status: 'PENDING' }, signal);
      onTotal(result.total);
      return result;
    },
    { errorTitle: 'No se pudieron cargar las solicitudes' },
  );
  const { busy, run } = useAction<number>();
  const { nameOf } = useCatalogs();

  const refresh = () => {
    list.retry();
    notifyAbsenceRequestsChanged();
  };
  const approve = (absence: Absence) =>
    run(() => calendarService.approveAbsence(absence.id), {
      busy: absence.id,
      confirm: {
        tone: 'success',
        icon: <Check size={30} />,
        eyebrow: 'Aprobar solicitud',
        title: `¿Aprobar ${nameOf('day_off_types', absence.type).toLowerCase()} de ${absence.employee.full_name}?`,
        message: 'Esos días no tendrá que checar.',
        details: absenceFacts(absence, nameOf('day_off_types', absence.type)),
        confirmLabel: 'Aprobar',
        confirmIcon: <Check size={18} />,
      },
      errorTitle: 'No se pudo aprobar la solicitud',
      success: ['Solicitud aprobada', `${absence.employee.full_name} no tiene que checar: ${rangeText(absence.starts_on, absence.ends_on)}.`],
      onSuccess: refresh,
      onError: (error) => isStale(error) && refresh(),
    });

  return (
    <div className="cal-tab">
      <p className="muted cal-bar__intro">Tus empleados piden vacaciones o permisos desde «Mi asistencia». Al aprobarlos, esos días no tienen que checar.</p>
      <PagedItems
        list={list}
        skeletonRows={3}
        pager={{ noun: { one: 'solicitud', other: 'solicitudes' } }}
        empty={{
          icon: <Inbox />,
          tone: 'success',
          title: 'Nada pendiente',
          description: 'Cuando un empleado pida vacaciones o un permiso, su solicitud aparecerá aquí para que la apruebes o la rechaces.',
          compact: true,
        }}
      >
        {(items) => (
          <ul className={`people-list stagger ${list.loading ? 'is-loading' : ''}`}>
            {items.map((absence) => {
              const name = absence.employee.full_name;
              return (
                <AbsenceItem
                  key={absence.id}
                  absence={absence}
                  actions={
                    <>
                      <ButtonLink to={paths.company.rejectAbsence(absence.id)} state={{ absence }} size="sm" variant="ghost" icon={<X size={16} />} aria-label={`Rechazar la solicitud de ${name}`}>
                        Rechazar
                      </ButtonLink>
                      <Button size="sm" variant="success" icon={<Check size={16} />} loading={busy === absence.id} disabled={busy !== null} aria-label={`Aprobar la solicitud de ${name}`} onClick={() => void approve(absence)}>
                        Aprobar
                      </Button>
                    </>
                  }
                />
              );
            })}
          </ul>
        )}
      </PagedItems>
    </div>
  );
}
