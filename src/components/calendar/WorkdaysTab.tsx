import { BriefcaseBusiness, CalendarCheck, Trash2 } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useSearchList } from '../../hooks/useSearchList';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { calendarService } from '../../services/calendarService';
import type { Workday } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { formatDate } from '../../utils/format';
import { DeletedNote, deleteNote, listEmpty, RestoreButton } from '../trash/TrashParts';
import { useRestore, type RestoreQuestion } from '../trash/useRestore';
import { Button, ButtonLink } from '../ui/Button';
import { ListToolbar } from '../ui/ListControls';
import { PagedItems } from '../ui/PagedItems';
import { isStale, longDate } from './calendarRules';
import { EmployeeCard } from './EmployeeCard';

/** Un día laborable especial en una confirmación: de quién y qué día. */
const workdayFacts = ({ employee, work_date }: Workday) => [
  { label: t('common.fields.employee'), value: `${employee.full_name} · ${employee.employee_number}` },
  { label: t('calendar.fields.day'), value: longDate(work_date) },
];

/** Eliminar un día laborable especial: de quién y qué día; va a «Eliminados» (se arma al dibujarse: sigue al idioma activo). */
function removeConfirm(workday: Workday): ConfirmInput {
  return {
    kind: 'delete',
    title: t('calendar.workdays.removeConfirm.title', { name: workday.employee.full_name }),
    message: t('calendar.workdays.removeConfirm.message'),
    details: workdayFacts(workday),
    note: deleteNote(),
  };
}

/** Restaurar un día laborable: ese día vuelve a ser laborable para la persona. */
const restoreQuestion = (workday: Workday): RestoreQuestion => ({ title: t('calendar.workdays.restoreTitle', { name: workday.employee.full_name }), details: workdayFacts(workday) });

const loadError = () => t('calendar.workdays.loadError');
const removeError = () => t('calendar.workdays.removeConfirm.error');
const removed = (workday: Workday) => () =>
  [t('calendar.workdays.removeConfirm.done'), t('calendar.workdays.removeConfirm.doneText', { date: formatDate(workday.work_date), name: workday.employee.full_name })] as const;

/**
 * Pestaña "Días laborables": excepciones por persona ("trabaja este día aunque sea festivo o esté
 * dentro de su ausencia"), con quién, qué día y por qué. Eliminar una regresa el día a libre; en
 * «Eliminados» se ve cuándo y quién la eliminó y se puede restaurar.
 */
export function WorkdaysTab() {
  const t = useT();
  const list = useSearchList((query, signal) => calendarService.workdays({ page: query.page, size: query.size, deleted: query.deleted }, signal), { errorTitle: loadError });
  const { busy, run } = useAction<number>();
  const { restoring, restore } = useRestore();

  const remove = (workday: Workday) =>
    run(() => calendarService.removeWorkday(workday.id), {
      busy: workday.id,
      confirm: () => removeConfirm(workday),
      errorTitle: removeError,
      success: removed(workday),
      onSuccess: list.retry,
      onError: (error) => isStale(error) && list.retry(),
    });
  const restoreWorkday = (workday: Workday) => void restore(workday.id, () => calendarService.restoreWorkday(workday.id), () => restoreQuestion(workday), list.retry);

  const create = (
    <ButtonLink to={paths.company.newWorkday} variant="primary" icon={<CalendarCheck size={18} />}>
      {t('calendar.workdays.create')}
    </ButtonLink>
  );

  return (
    <div className="cal-tab">
      <div className="cal-toolbar">
        <p className="cal-toolbar__intro">{t('calendar.workdays.intro')}</p>
        <div className="cal-toolbar__actions">{create}</div>
      </div>
      <ListToolbar filter={list.filter} onFilter={list.setFilter} trash statuses={false} />
      <PagedItems
        list={list}
        skeletonRows={3}
        pager={{ noun: { one: t('calendar.workdays.noun.one'), other: t('calendar.workdays.noun.other') } }}
        empty={listEmpty(list, { empty: { icon: <BriefcaseBusiness />, title: t('calendar.workdays.empty.title'), description: t('calendar.workdays.empty.description'), action: create, compact: true } })}
      >
        {(items) => (
          <ul className={`people-list stagger ${list.loading ? 'is-loading' : ''}`}>
            {items.map((workday) => (
              <EmployeeCard
                key={workday.id}
                employee={workday.employee}
                badges={list.trash ? null : <span className="badge badge--plain badge--success">{t('calendar.workdays.works')}</span>}
                actions={
                  list.trash ? (
                    <RestoreButton name={workday.employee.full_name} busy={restoring === workday.id} disabled={restoring !== null} onRestore={() => restoreWorkday(workday)} />
                  ) : (
                    <Button size="sm" variant="danger-outline" icon={<Trash2 size={16} />} loading={busy === workday.id} disabled={busy !== null} aria-label={t('calendar.workdays.removeLabel', { name: workday.employee.full_name })} onClick={() => void remove(workday)}>
                      {t('common.actions.delete')}
                    </Button>
                  )
                }
              >
                <small>{longDate(workday.work_date)}</small>
                {workday.note && <small className="shift-item__quote">“{workday.note}”</small>}
                {list.trash && <DeletedNote record={workday} />}
              </EmployeeCard>
            ))}
          </ul>
        )}
      </PagedItems>
    </div>
  );
}
