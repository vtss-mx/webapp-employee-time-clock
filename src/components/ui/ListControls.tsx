import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { ActiveFilter } from '../../hooks/useSearchList';
import { Button } from './Button';
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
      <Select value={filter} onChange={(e) => onFilter(e.target.value as ActiveFilter)} aria-label="Filtrar por estado">
        <option value="all">Todos los estados</option>
        <option value="active">{labels?.active ?? 'Activos'}</option>
        <option value="inactive">{labels?.inactive ?? 'Inactivos'}</option>
      </Select>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  loading?: boolean;
  onPage: (page: number) => void;
}

/** Paginación de los listados (solo si hay más de una página). */
export function Pagination({ page, totalPages, loading = false, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <Button size="sm" icon={<ChevronLeft size={16} />} disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <span>
        Página {page} de {totalPages}
      </span>
      <Button size="sm" iconRight={<ChevronRight size={16} />} disabled={page >= totalPages || loading} onClick={() => onPage(page + 1)}>
        Siguiente
      </Button>
    </div>
  );
}
