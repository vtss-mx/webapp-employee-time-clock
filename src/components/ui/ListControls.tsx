import { Search } from 'lucide-react';
import type { ActiveFilter } from '../../hooks/useSearchList';
import { useT } from '../../i18n';
import { Select, type SelectOption } from './Select';

/** Búsqueda del listado; los que no buscan en el backend (validadores, festivos, días laborables) la omiten. */
type SearchProps =
  | { search: string; onSearch: (value: string) => void; placeholder: string; label: string }
  | { search?: undefined; onSearch?: undefined; placeholder?: undefined; label?: undefined };

type ListToolbarProps = SearchProps & {
  /** Filtro por estado (los listados sin filtro lo omiten). */
  filter?: ActiveFilter;
  onFilter?: (value: ActiveFilter) => void;
  /** Texto de las opciones del filtro (p. ej. "Activos" / "Activas", "Eliminadas"). */
  labels?: Partial<Record<Exclude<ActiveFilter, 'all'>, string>>;
  /** Agrega «Eliminados»: la papelera del listado (lo eliminado se restaura durante 1 año). */
  trash?: boolean;
  /** false: el listado no tiene activos e inactivos (departamentos, festivos): el filtro es «Todos» / «Eliminados». */
  statuses?: boolean;
};

/** Búsqueda + filtro por estado (y, si se pide, «Eliminados»), comunes a los listados. */
export function ListToolbar({ search, onSearch, placeholder, label, filter, onFilter, labels, trash = false, statuses = true }: ListToolbarProps) {
  const t = useT();
  const options: SelectOption<ActiveFilter>[] = [{ value: 'all', label: t(statuses ? 'ui.listToolbar.all' : 'ui.listToolbar.allRecords') }];
  if (statuses) {
    options.push({ value: 'active', label: labels?.active ?? t('ui.listToolbar.active') }, { value: 'inactive', label: labels?.inactive ?? t('ui.listToolbar.inactive') });
  }
  if (trash) options.push({ value: 'deleted', label: labels?.deleted ?? t('ui.listToolbar.deleted') });
  return (
    <div className={`toolbar ${onSearch ? '' : 'toolbar--filter'}`.trim()}>
      {onSearch && (
        <div className="search">
          <Search size={18} />
          <input type="search" className="input" placeholder={placeholder} value={search} onChange={(e) => onSearch(e.target.value)} aria-label={label} />
        </div>
      )}
      {onFilter && <Select<ActiveFilter> value={filter ?? 'all'} onChange={onFilter} aria-label={t('ui.listToolbar.filter')} options={options} />}
    </div>
  );
}
