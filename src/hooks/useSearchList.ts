import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useErrorPopup } from './useFeedback';

export type ActiveFilter = 'all' | 'active' | 'inactive';

export interface ListQuery {
  search?: string;
  active?: boolean;
  page: number;
  size: number;
}

interface Page<T> {
  items: T[];
  total: number;
}

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Listado paginado con búsqueda (con pausa entre teclas), filtro activo/inactivo, cancelación de
 * la petición anterior y "Reintentar". Lo comparten los listados de empleados y de empresas.
 */
export function useSearchList<P extends Page<unknown>>(
  fetchPage: (query: ListQuery, signal: AbortSignal) => Promise<P>,
  { pageSize, errorTitle }: { pageSize: number; errorTitle: string },
) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilterState] = useState<ActiveFilter>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<P | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const retry = () => setReload((n) => n + 1);
  useErrorPopup(error, { title: errorTitle, retry });
  const fetchRef = useRef(fetchPage);
  useLayoutEffect(() => {
    fetchRef.current = fetchPage;
  });

  // Solo un cambio real del texto vuelve a la página 1 (cambiar de página no espera a la búsqueda).
  useEffect(() => {
    const next = search.trim();
    if (next === debouncedSearch) return;
    const timer = window.setTimeout(() => {
      setDebouncedSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const query: ListQuery = {
      search: debouncedSearch || undefined,
      active: filter === 'all' ? undefined : filter === 'active',
      page,
      size: pageSize,
    };
    fetchRef.current(query, controller.signal)
      .then(setData)
      .catch((e: unknown) => !controller.signal.aborted && setError(e))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [debouncedSearch, filter, page, pageSize, reload]);

  const setFilter = (next: ActiveFilter) => {
    setFilterState(next);
    setPage(1);
  };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const filtered = Boolean(debouncedSearch) || filter !== 'all';

  return { search, setSearch, filter, setFilter, page, setPage, totalPages, data, loading, error, retry, filtered };
}
