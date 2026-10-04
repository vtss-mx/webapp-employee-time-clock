import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Page, PageQuery } from '../types';
import { config } from '../utils/config';
import { useErrorPopup } from './useFeedback';
import { useRetryOnReconnect } from './useRetryOnReconnect';

interface PagedListOptions {
  errorTitle: string;
  /**
   * Resumen de los filtros con que se pide la lista (estado, búsqueda, pestaña...). Al cambiar, se
   * vuelve a pedir desde la página 1. Debe incluir todo lo que `fetchPage` usa además de la página.
   */
  filterKey?: string;
  /** Elementos por página al abrir (por omisión el de la configuración: 10). */
  pageSize?: number;
}

/**
 * Listado paginado por el backend: página y elementos por página, carga con cancelación de la
 * petición anterior, "Reintentar" (también solo, al recuperar la conexión) y vuelta a la página 1
 * al cambiar los filtros o el tamaño.
 * Base de todos los listados (con búsqueda: `useSearchList`; sin ella: validadores, validaciones,
 * bitácoras) para que se comporten igual y se dibujen con el mismo `Paginator`.
 */
export function usePagedList<T>(fetchPage: (query: PageQuery, signal: AbortSignal) => Promise<Page<T>>, options: PagedListOptions) {
  const { errorTitle, filterKey = '' } = options;
  const [size, setSizeState] = useState(options.pageSize ?? config.pageSize);
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  // Filtros nuevos = página 1 en el mismo render (una sola petición, sin pedir antes la página anterior).
  if (paging.key !== filterKey) setPaging({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;

  const [data, setData] = useState<Page<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const retry = useCallback(() => setReload((n) => n + 1), []);
  useErrorPopup(error, { title: errorTitle, retry });
  useRetryOnReconnect(error, retry);

  const fetchRef = useRef(fetchPage);
  useLayoutEffect(() => {
    fetchRef.current = fetchPage;
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchRef.current({ page, size }, controller.signal)
      .then(setData)
      .catch((e: unknown) => !controller.signal.aborted && setError(e))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [filterKey, page, size, reload]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  // La página quedó fuera de rango (p. ej. se eliminó lo único que había en la última): a la última que existe.
  useEffect(() => {
    if (data && data.items.length === 0 && page > totalPages) setPaging({ key: filterKey, page: totalPages });
  }, [data, page, totalPages, filterKey]);

  const setPage = useCallback((next: number) => setPaging({ key: filterKey, page: next }), [filterKey]);
  const setSize = useCallback(
    (next: number) => {
      setSizeState(next);
      setPaging({ key: filterKey, page: 1 });
    },
    [filterKey],
  );
  /** Cambia los elementos ya cargados sin volver a pedirlos (p. ej. tras editar uno). */
  const updateItems = useCallback((change: (items: T[]) => T[]) => setData((current) => current && { ...current, items: change(current.items) }), []);

  return { page, setPage, size, setSize, total: data?.total ?? 0, totalPages, data, loading, error, retry, updateItems };
}

export type PagedList<T> = ReturnType<typeof usePagedList<T>>;
