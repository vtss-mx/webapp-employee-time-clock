import { useEffect, useState } from 'react';
import type { Page, PageQuery } from '../types';
import { usePagedList } from './usePagedList';

export type ActiveFilter = 'all' | 'active' | 'inactive';

export interface ListQuery extends PageQuery {
  search?: string;
  active?: boolean;
}

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Listado paginado con búsqueda (con pausa entre teclas) y filtro activo/inactivo, sobre
 * `usePagedList` (página, tamaño, cancelación y "Reintentar"). Lo comparten los listados de
 * empleados y de empresas. Un cambio real de búsqueda o de filtro vuelve a la página 1.
 */
export function useSearchList<T>(
  fetchPage: (query: ListQuery, signal: AbortSignal) => Promise<Page<T>>,
  { errorTitle, pageSize, filterKey = '' }: { errorTitle: string; pageSize?: number; /** Otros filtros de la pantalla (p. ej. estado y gravedad): al cambiar, vuelve a la página 1. */ filterKey?: string },
) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<ActiveFilter>('all');

  useEffect(() => {
    const next = search.trim();
    if (next === debouncedSearch) return;
    const timer = window.setTimeout(() => setDebouncedSearch(next), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, debouncedSearch]);

  const list = usePagedList<T>(
    (page, signal) => fetchPage({ ...page, search: debouncedSearch || undefined, active: filter === 'all' ? undefined : filter === 'active' }, signal),
    { errorTitle, pageSize, filterKey: `${filter}|${debouncedSearch}|${filterKey}` },
  );
  const filtered = Boolean(debouncedSearch) || filter !== 'all';

  return { ...list, search, setSearch, filter, setFilter, filtered };
}
