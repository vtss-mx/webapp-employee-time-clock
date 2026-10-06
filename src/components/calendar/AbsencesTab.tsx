import { CalendarOff, CalendarPlus, SearchX, X } from 'lucide-react';
import { useState } from 'react';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { usePagedList } from '../../hooks/usePagedList';
import { notifyAbsenceRequestsChanged } from '../../hooks/usePendingAbsenceRequests';
import { t, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { calendarService } from '../../services/calendarService';
import type { Absence, ShiftRequestStatus } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
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
const invalid = (value: string) => (value && !parseIso(value) ? t('calendar.validation.invalidDateShort') : undefined);

/** Las que siguen vigentes se pueden retirar: sus días vuelven a ser laborables. */
const cancellable = (absence: Absence) => absence.status === 'PENDING' || absence.status === 'APPROVED';

/** Cancelar una ausencia vigente: qué se retira y qué pasa con sus días (se arma al dibujarse: sigue al idioma activo). */
function cancelConfirm(absence: Absence, typeName: string): ConfirmInput {
  return {
    kind: 'delete',
    icon: <CalendarOff size={30} />,
    eyebrow: t('calendar.absences.cancelConfirm.eyebrow'),
    title: t('calendar.absences.cancelConfirm.title', { name: absence.employee.full_name }),
    message: t('calendar.absences.cancelConfirm.message'),
    details: absenceFacts(absence, typeName),
    confirmLabel: t('calendar.absences.cancelConfirm.confirm'),
    confirmIcon: <X size={18} />,
    cancelLabel: t('calendar.absences.cancelConfirm.keep'),
  };
}

const loadError = () => t('calendar.absences.loadError');
const cancelError = () => t('calendar.absences.cancelConfirm.error');
const cancelled = (absence: Absence) => () => [t('calendar.absences.cancelConfirm.done'), t('calendar.absences.cancelConfirm.doneText', { name: absence.employee.full_name })] as const;

/** Tipo, estado y fechas (las que tocan el rango). */
function AbsenceFilters({ filters, onChange }: { filters: Filters; onChange: (filters: Filters) => void }) {
  const t = useT();
  const { active } = useCatalogs();
  return (
    <div className="cal-filters">
      <SelectField
        label={t('calendar.fields.type')}
        value={filters.type}
        options={[{ value: ALL, label: t('calendar.absences.allTypes') }, ...active('day_off_types').map((item) => ({ value: item.code, label: item.name }))]}
        onChange={(type) => onChange({ ...filters, type })}
      />
      <SelectField<Filters['status']>
        label={t('common.fields.status')}
        value={filters.status}
        options={[{ value: ALL, label: t('calendar.absences.allStatuses') }, ...active('shift_request_statuses').map((item) => ({ value: item.code, label: item.name }))]}
        onChange={(status) => onChange({ ...filters, status })}
      />
      <DateField label={t('calendar.fields.from')} name="start" value={filters.start} error={invalid(filters.start)} onChange={(start) => onChange({ ...filters, start })} />
      <DateField label={t('calendar.fields.to')} name="end" value={filters.end} min={applied(filters.start)} error={invalid(filters.end)} onChange={(end) => onChange({ ...filters, end })} />
    </div>
  );
}

/**
 * Pestaña "Ausencias": vacaciones, permisos, incapacidades y otros días libres (las que registró la
 * empresa y las que pidieron los empleados), la más reciente primero, con filtros por tipo, estado y
 * fechas. Una vigente se puede cancelar (sus días vuelven a ser laborables).
 */
export function AbsencesTab({ onChanged }: { onChanged: () => void }) {
  const t = useT();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const query = {
    type: filters.type === ALL ? undefined : filters.type,
    status: filters.status === ALL ? undefined : filters.status,
    start: applied(filters.start),
    end: applied(filters.end),
  };
  const filtered = Object.values(query).some(Boolean);
  const list = usePagedList((page, signal) => calendarService.absences({ ...page, ...query }, signal), {
    errorTitle: loadError,
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
      confirm: () => cancelConfirm(absence, nameOf('day_off_types', absence.type)),
      errorTitle: cancelError,
      success: cancelled(absence),
      onSuccess: refresh,
      onError: (error) => isStale(error) && refresh(),
    });

  const create = (
    <ButtonLink to={paths.company.newAbsence} variant="primary" icon={<CalendarPlus size={18} />}>
      {t('calendar.absences.create')}
    </ButtonLink>
  );

  return (
    <div className="cal-tab">
      <div className="cal-toolbar">
        <p className="cal-toolbar__intro">{t('calendar.absences.intro')}</p>
        <div className="cal-toolbar__actions">{create}</div>
      </div>
      <AbsenceFilters filters={filters} onChange={setFilters} />
      {filtered && (
        <Button size="sm" variant="ghost" icon={<X size={16} />} className="cal-filters__clear" onClick={() => setFilters(NO_FILTERS)}>
          {t('calendar.absences.clearFilters')}
        </Button>
      )}
      <PagedItems
        list={list}
        skeletonRows={4}
        pager={{ noun: { one: t('calendar.absences.noun.one'), other: t('calendar.absences.noun.other') } }}
        empty={
          filtered
            ? { icon: <SearchX />, title: t('calendar.absences.emptyFiltered.title'), description: t('calendar.absences.emptyFiltered.description'), compact: true }
            : { icon: <CalendarOff />, title: t('calendar.absences.empty.title'), description: t('calendar.absences.empty.description'), action: create, compact: true }
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
                    <Button size="sm" variant="ghost" icon={<X size={16} />} loading={busy === absence.id} disabled={busy !== null} aria-label={t('calendar.absences.cancelLabel', { name: absence.employee.full_name })} onClick={() => void cancel(absence)}>
                      {t('common.actions.cancel')}
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
