import { BriefcaseBusiness, CalendarCheck, Trash2 } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { usePagedList } from '../../hooks/usePagedList';
import { paths } from '../../routes/paths';
import { calendarService } from '../../services/calendarService';
import type { Workday } from '../../types';
import { formatDate } from '../../utils/format';
import { Button, ButtonLink } from '../ui/Button';
import { PagedItems } from '../ui/PagedItems';
import { isStale, longDate } from './calendarRules';
import { EmployeeCard } from './EmployeeCard';

/**
 * Pestaña "Días laborables": excepciones por persona ("trabaja este día aunque sea festivo o esté
 * dentro de su ausencia"), con quién, qué día y por qué. Eliminar una regresa el día a libre.
 */
export function WorkdaysTab() {
  const list = usePagedList((page, signal) => calendarService.workdays(page, signal), { errorTitle: 'No se pudieron cargar los días laborables' });
  const { busy, run } = useAction<number>();

  const remove = (workday: Workday) =>
    run(() => calendarService.removeWorkday(workday.id), {
      busy: workday.id,
      confirm: {
        kind: 'delete',
        title: `¿Eliminar el día laborable de ${workday.employee.full_name}?`,
        message: 'Ese día vuelve a ser libre para la persona: ya no tendrá que checar.',
        details: [
          { label: 'Empleado', value: `${workday.employee.full_name} · ${workday.employee.employee_number}` },
          { label: 'Día', value: longDate(workday.work_date) },
        ],
      },
      errorTitle: 'No se pudo eliminar el día laborable',
      success: ['Día laborable eliminado', `El ${formatDate(workday.work_date)} vuelve a ser un día libre para ${workday.employee.full_name}.`],
      onSuccess: list.retry,
      onError: (error) => isStale(error) && list.retry(),
    });

  const create = (
    <ButtonLink to={paths.company.newWorkday} variant="primary" icon={<CalendarCheck size={18} />}>
      Agregar día laborable
    </ButtonLink>
  );

  return (
    <div className="cal-tab">
      <div className="cal-bar">
        <p className="muted cal-bar__intro">Una persona trabaja un día que para ella sería libre: un festivo o un día dentro de sus vacaciones o permiso.</p>
        <div className="cal-bar__actions">{create}</div>
      </div>
      <PagedItems
        list={list}
        skeletonRows={3}
        pager={{ noun: { one: 'día laborable', other: 'días laborables' } }}
        empty={{
          icon: <BriefcaseBusiness />,
          title: 'Sin días laborables especiales',
          description: 'Si alguien debe trabajar un festivo o un día de su ausencia, agrégalo aquí: ese día sí checa.',
          action: create,
          compact: true,
        }}
      >
        {(items) => (
          <ul className={`people-list stagger ${list.loading ? 'is-loading' : ''}`}>
            {items.map((workday) => (
              <EmployeeCard
                key={workday.id}
                employee={workday.employee}
                badges={<span className="badge badge--plain badge--success">Trabaja</span>}
                actions={
                  <Button size="sm" variant="danger-outline" icon={<Trash2 size={16} />} loading={busy === workday.id} disabled={busy !== null} aria-label={`Eliminar el día laborable de ${workday.employee.full_name}`} onClick={() => void remove(workday)}>
                    Eliminar
                  </Button>
                }
              >
                <small>{longDate(workday.work_date)}</small>
                {workday.note && <small className="shift-item__quote">“{workday.note}”</small>}
              </EmployeeCard>
            ))}
          </ul>
        )}
      </PagedItems>
    </div>
  );
}
