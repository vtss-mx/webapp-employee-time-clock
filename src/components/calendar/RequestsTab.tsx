import { Check, Inbox, X } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { notifyAbsenceRequestsChanged } from '../../hooks/usePendingAbsenceRequests';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { calendarService } from '../../services/calendarService';
import type { Absence } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { Button, ButtonLink } from '../ui/Button';
import { PagedItems } from '../ui/PagedItems';
import { AbsenceItem } from './AbsenceItem';
import { absenceFacts, isStale, rangeText } from './calendarRules';
import { inSentence } from '../../utils/text';

/** Aprobar una solicitud: qué se aprueba y qué pasa (se arma al dibujarse: sigue al idioma activo). */
function approveConfirm(absence: Absence, typeName: string): ConfirmInput {
  return {
    tone: 'success',
    icon: <Check size={30} />,
    eyebrow: t('calendar.requests.approveConfirm.eyebrow'),
    title: t('calendar.requests.approveConfirm.title', { kind: inSentence(typeName), name: absence.employee.full_name }),
    message: t('calendar.requests.approveConfirm.message'),
    details: absenceFacts(absence, typeName),
    confirmLabel: t('common.actions.approve'),
    confirmIcon: <Check size={18} />,
  };
}

const loadError = () => t('calendar.requests.loadError');
const approveError = () => t('calendar.requests.approveConfirm.error');
const approved = (absence: Absence) => () =>
  [t('calendar.requests.approveConfirm.done'), t('calendar.requests.approveConfirm.doneText', { name: absence.employee.full_name, range: rangeText(absence.starts_on, absence.ends_on) })] as const;

/**
 * Pestaña "Solicitudes": las vacaciones y permisos que pidieron los empleados y esperan respuesta,
 * con "Aprobar" (sus días quedan libres) y "Rechazar" (con una nota que el empleado verá). Informa
 * cuántas hay (`onTotal`) para el contador de la pestaña.
 */
export function RequestsTab({ onTotal }: { onTotal: (pending: number) => void }) {
  const t = useT();
  const list = usePagedList(
    async (page, signal) => {
      const result = await calendarService.absences({ ...page, status: 'PENDING' }, signal);
      onTotal(result.total);
      return result;
    },
    { errorTitle: loadError },
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
      confirm: () => approveConfirm(absence, nameOf('day_off_types', absence.type)),
      errorTitle: approveError,
      success: approved(absence),
      onSuccess: refresh,
      onError: (error) => isStale(error) && refresh(),
    });

  return (
    <div className="cal-tab">
      <div className="cal-toolbar">
        <p className="cal-toolbar__intro">{t('calendar.requests.intro')}</p>
      </div>
      <PagedItems
        list={list}
        skeletonRows={3}
        pager={{ noun: { one: t('calendar.requests.noun.one'), other: t('calendar.requests.noun.other') } }}
        empty={{ icon: <Inbox />, tone: 'success', title: t('calendar.requests.empty.title'), description: t('calendar.requests.empty.description'), compact: true }}
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
                      <ButtonLink to={paths.company.rejectAbsence(absence.id)} state={{ absence }} size="sm" variant="ghost" icon={<X size={16} />} aria-label={t('calendar.requests.rejectLabel', { name })}>
                        {t('common.actions.reject')}
                      </ButtonLink>
                      <Button size="sm" variant="success" icon={<Check size={16} />} loading={busy === absence.id} disabled={busy !== null} aria-label={t('calendar.requests.approveLabel', { name })} onClick={() => void approve(absence)}>
                        {t('common.actions.approve')}
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
