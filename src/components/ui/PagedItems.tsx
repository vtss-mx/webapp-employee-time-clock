import type { ReactNode } from 'react';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { ListPaginator, type PagerState, type PaginatorOptions } from './Paginator';
import { RetryState } from './RetryState';
import { SkeletonRows } from './Skeleton';

/** Lo que un listado necesita de `usePagedList` / `useSearchList`. */
export interface ListState<T> extends PagerState {
  data: { items: T[] } | null;
  /** Error de la última carga: si aún no hay datos, se ofrece "Reintentar". */
  error: unknown;
  retry: () => void;
}

interface PagedItemsProps<T> {
  list: ListState<T>;
  /** Sin registros: ícono, título, descripción y (si aplica) la acción para crear el primero. */
  empty: EmptyStateProps;
  /** Personalización del paginador (nombre de los elementos, textos, partes visibles...). */
  pager?: PaginatorOptions;
  /** Filas del esqueleto mientras llega la primera página. */
  skeletonRows?: number;
  /** Cómo se dibujan los elementos de la página (lista, tabla, tarjetas...). */
  children: (items: T[]) => ReactNode;
}

/**
 * Cuerpo ÚNICO de todo listado paginado: esqueleto al cargar, "Reintentar" si falló, estado vacío
 * (sin paginador) cuando no hay registros, o los elementos con su paginador. Así todas las listas
 * se comportan igual y ninguna repite estos estados.
 */
export function PagedItems<T>({ list, empty, pager, skeletonRows, children }: PagedItemsProps<T>) {
  const items = list.data?.items;
  if (!items) {
    if (list.error) return <RetryState onRetry={list.retry} />;
    return list.loading ? <SkeletonRows rows={skeletonRows} /> : null;
  }
  if (items.length === 0) return <EmptyState {...empty} />;
  return (
    <>
      {children(items)}
      <ListPaginator list={list} {...pager} />
    </>
  );
}
