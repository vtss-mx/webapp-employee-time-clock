import type { ReactNode } from 'react';
import { ListPaginator, type PagerState, type PaginatorOptions } from './Paginator';
import { RetryState } from './RetryState';
import { SkeletonRows } from './Skeleton';

/** Lo que el listado necesita de `usePagedList` / `useSearchList`. */
interface ListState<T> extends PagerState {
  data: { items: T[] } | null;
  /** Error de la última carga: si aún no hay datos, se ofrece "Reintentar". */
  error: unknown;
  retry: () => void;
}

interface ListResultsProps<T extends { id: number }> {
  list: ListState<T>;
  columns: string[];
  /** Celdas `<td>` de la fila (con `data-label` para la vista de tarjetas en móvil). */
  renderCells: (item: T) => ReactNode;
  onOpen: (item: T) => void;
  /** Sin resultados: ícono, título y (sin filtros) la acción para crear el primero. */
  empty: { icon: ReactNode; title: string; action?: ReactNode };
  /** Personalización del paginador (nombre de los elementos, textos, partes visibles...). */
  pager?: PaginatorOptions;
}

/** Resultados de un listado: carga, error, vacío o tabla (filas navegables por teclado) con paginación. */
export function ListResults<T extends { id: number }>({ list, columns, renderCells, onOpen, empty, pager }: ListResultsProps<T>) {
  const { loading, error } = list;
  const items = list.data?.items;
  if (!items) {
    if (error) return <RetryState onRetry={list.retry} />;
    return loading ? <SkeletonRows /> : null;
  }
  if (items.length === 0) {
    return (
      <div className="empty">
        <span className="icon-tile icon-tile--lg">{empty.icon}</span>
        <h2>{empty.title}</h2>
        {empty.action}
      </div>
    );
  }
  return (
    <>
      <div className={`table-wrap ${loading ? 'is-loading' : ''}`}>
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={item.id}
                style={{ animationDelay: `${i * 25}ms` }}
                onClick={() => onOpen(item)}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(item)}
              >
                {renderCells(item)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListPaginator list={list} {...pager} />
    </>
  );
}
