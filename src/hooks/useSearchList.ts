import { useEffect, useState } from 'react';
import type { Page, PageQuery } from '../types';
import { usePagedList } from './usePagedList';
import type { LazyText } from '../i18n/lazy';

/** Estado del filtro de un listado; `deleted` es su papelera («Eliminados»: se restaura durante 1 año). */
export type ActiveFilter = 'all' | 'active' | 'inactive' | 'deleted';

export interface ListQuery extends PageQuery {
  search?: string;
  active?: boolean;
  /** Solo lo de «Eliminados» (nunca junto con `active`). */
  deleted?: boolean;
}

/** El filtro como lo pide la API: activos o inactivos (`active`) o «Eliminados» (`deleted`); "todos" no envía nada. */
const filterQuery = (filter: ActiveFilter): Pick<ListQuery, 'active' | 'deleted'> =>
  filter === 'all' ? {} : filter === 'deleted' ? { deleted: true } : { active: filter === 'active' };

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Listado paginado con búsqueda (con pausa entre teclas) y filtro activo/inactivo/«Eliminados», sobre
 * `usePagedList` (página, tamaño, cancelación y "Reintentar"). Lo comparten los listados de
 * empleados, empresas, turnos, sitios... (los que no buscan solo usan el filtro). Un cambio real de
 * búsqueda o de filtro vuelve a la página 1.
 */
export function useSearchList<T, X extends object = object>(
  fetchPage: (query: ListQuery, signal: AbortSignal) => Promise<Page<T> & X>,
  { errorTitle, pageSize, filterKey = '' }: { errorTitle: LazyText; pageSize?: number; /** Otros filtros de la pantalla (p. ej. estado y gravedad): al cambiar, vuelve a la página 1. */ filterKey?: string },
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

  const list = usePagedList<T, X>(
    (page, signal) => fetchPage({ ...page, search: debouncedSearch || undefined, ...filterQuery(filter) }, signal),
    { errorTitle, pageSize, filterKey: `${filter}|${debouncedSearch}|${filterKey}` },
  );
  const filtered = Boolean(debouncedSearch) || filter !== 'all';

  // `appliedSearch`: la búsqueda con que se pidió la lista visible (sin la pausa entre teclas); `trash`: se ve «Eliminados».
  return { ...list, search, setSearch, appliedSearch: debouncedSearch, filter, setFilter, filtered, trash: filter === 'deleted' };
}

export type SearchList<T> = ReturnType<typeof useSearchList<T>>;
