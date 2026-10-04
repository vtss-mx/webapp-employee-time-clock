import { CalendarOff, CalendarPlus, SearchX, X } from 'lucide-react';
import { useState } from 'react';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { notifyAbsenceRequestsChanged } from '../../hooks/usePendingAbsenceRequests';
import { paths } from '../../routes/paths';
import { calendarService } from '../../services/calendarService';
import type { Absence, ShiftRequestStatus } from '../../types';
import { SelectField } from '../shifts/formFields';
import { Button, ButtonLink } from '../ui/Button';
import { DateField, parseIso } from '../ui/DateField';
import { PagedItems } from '../ui/PagedItems';
import { AbsenceItem } from './AbsenceItem';
import { absenceFacts, isStale } from './calendarRules';

const ALL = 'ALL';

interface Filters {
  type: string;
  status: ShiftRequestStatus | typeof ALL;
  start: string;
  end: string;
}

const NO_FILTERS: Filters = { type: ALL, status: ALL, start: '', end: '' };

/** Una fecha escrita a medias no filtra; una que no existe (31/02) se marca y tampoco filtra. */
const applied = (value: string) => (parseIso(value) ? value : undefined);
const invalid = (value: string) => (value && !parseIso(value) ? 'Escribe una fecha válida' : undefined);

/** Las que siguen vigentes se pueden retirar: sus días vuelven a ser laborables. */
const cancellable = (absence: Absence) => absence.status === 'PENDING' || absence.status === 'APPROVED';

/** Tipo, estado y fechas (las que tocan el rango). */
function AbsenceFilters({ filters, onChange }: { filters: Filters; onChange: (filters: Filters) => void }) {
  const { active } = useCatalogs();
  return (
    <div className="cal-filters">
      <SelectField
        label="Tipo"
        value={filters.type}
        options={[{ value: ALL, label: 'Todos los tipos' }, ...active('day_off_types').map((item) => ({ value: item.code, label: item.name }))]}
        onChange={(type) => onChange({ ...filters, type })}
      />
      <SelectField<Filters['status']>
        label="Estado"
        value={filters.status}
        options={[{ value: ALL, label: 'Todos los estados' }, ...active('shift_request_statuses').map((item) => ({ value: item.code, label: item.name }))]}
        onChange={(status) => onChange({ ...filters, status })}
      />
      <DateField label="Desde" name="start" value={filters.start} error={invalid(filters.start)} onChange={(start) => onChange({ ...filters, start })} />
      <DateField label="Hasta" name="end" value={filters.end} min={applied(filters.start)} error={invalid(filters.end)} onChange={(end) => onChange({ ...filters, end })} />
    </div>
  );
}

/**
 * Pestaña "Ausencias": vacaciones, permisos, incapacidades y otros días libres (las que registró la
 * empresa y las que pidieron los empleados), la más reciente primero, con filtros por tipo, estado y
 * fechas. Una vigente se puede cancelar (sus días vuelven a ser laborables).
 */
export function AbsencesTab({ onChanged }: { onChanged: () => void }) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const query = {
    type: filters.type === ALL ? undefined : filters.type,
    status: filters.status === ALL ? undefined : filters.status,
    start: applied(filters.start),
    end: applied(filters.end),
  };
  const filtered = Object.values(query).some(Boolean);
  const list = usePagedList((page, signal) => calendarService.absences({ ...page, ...query }, signal), {
    errorTitle: 'No se pudieron cargar las ausencias',
    filterKey: Object.values(query).join('|'),
  });
  const { busy, run } = useAction<number>();
  const { nameOf } = useCatalogs();

  const refresh = () => {
    list.retry();
    onChanged();
    notifyAbsenceRequestsChanged();
  };
  const cancel = (absence: Absence) =>
    run(() => calendarService.cancelAbsence(absence.id), {
      busy: absence.id,
      confirm: {
        kind: 'delete',
        icon: <CalendarOff size={30} />,
        eyebrow: 'Cancelar ausencia',
        title: `¿Cancelar la ausencia de ${absence.employee.full_name}?`,
        message: 'Sus días vuelven a ser laborables: tendrá que checar en ellos.',
        details: absenceFacts(absence, nameOf('day_off_types', absence.type)),
        confirmLabel: 'Cancelar ausencia',
        confirmIcon: <X size={18} />,
        cancelLabel: 'Conservarla',
      },
      errorTitle: 'No se pudo cancelar la ausencia',
      success: ['Ausencia cancelada', `Los días de ${absence.employee.full_name} vuelven a ser laborables.`],
      onSuccess: refresh,
      onError: (error) => isStale(error) && refresh(),
    });

  const create = (
    <ButtonLink to={paths.company.newAbsence} variant="primary" icon={<CalendarPlus size={18} />}>
      Registrar ausencia
    </ButtonLink>
  );

  return (
    <div className="cal-tab">
      <div className="cal-bar">
        <p className="muted cal-bar__intro">Vacaciones, permisos e incapacidades de uno o varios empleados: esos días no tienen que checar.</p>
        <div className="cal-bar__actions">{create}</div>
      </div>
      <AbsenceFilters filters={filters} onChange={setFilters} />
      {filtered && (
        <Button size="sm" variant="ghost" icon={<X size={16} />} className="cal-filters__clear" onClick={() => setFilters(NO_FILTERS)}>
          Quitar filtros
        </Button>
      )}
      <PagedItems
        list={list}
        skeletonRows={4}
        pager={{ noun: { one: 'ausencia', other: 'ausencias' } }}
        empty={
          filtered
            ? { icon: <SearchX />, title: 'Ninguna ausencia coincide con los filtros', description: 'Prueba con otro tipo, estado o rango de fechas.', compact: true }
            : { icon: <CalendarOff />, title: 'Aún no hay ausencias', description: 'Registra las vacaciones o permisos de tu personal; las que pidan los empleados también aparecerán aquí.', action: create, compact: true }
        }
      >
        {(items) => (
          <ul className={`people-list stagger ${list.loading ? 'is-loading' : ''}`}>
            {items.map((absence) => (
              <AbsenceItem
                key={absence.id}
                absence={absence}
                actions={
                  cancellable(absence) && (
                    <Button size="sm" variant="ghost" icon={<X size={16} />} loading={busy === absence.id} disabled={busy !== null} aria-label={`Cancelar la ausencia de ${absence.employee.full_name}`} onClick={() => void cancel(absence)}>
                      Cancelar
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        )}
      </PagedItems>
    </div>
  );
}
