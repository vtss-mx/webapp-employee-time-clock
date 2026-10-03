import { Search } from 'lucide-react';
import type { ActiveFilter } from '../../hooks/useSearchList';
import { Select } from './Select';

interface ListToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  label: string;
  filter: ActiveFilter;
  onFilter: (value: ActiveFilter) => void;
  /** Texto de las opciones del filtro (p. ej. "Activos" / "Activas"). */
  labels?: { active: string; inactive: string };
}

/** Búsqueda + filtro por estado, comunes a los listados. */
export function ListToolbar({ search, onSearch, placeholder, label, filter, onFilter, labels }: ListToolbarProps) {
  return (
    <div className="toolbar">
      <div className="search">
        <Search size={18} />
        <input type="search" className="input" placeholder={placeholder} value={search} onChange={(e) => onSearch(e.target.value)} aria-label={label} />
      </div>
      <Select<ActiveFilter>
        value={filter}
        onChange={onFilter}
        aria-label="Filtrar por estado"
        options={[
          { value: 'all', label: 'Todos los estados' },
          { value: 'active', label: labels?.active ?? 'Activos' },
          { value: 'inactive', label: labels?.inactive ?? 'Inactivos' },
        ]}
      />
    </div>
  );
}
