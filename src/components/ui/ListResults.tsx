import type { ReactNode } from 'react';
import type { EmptyStateProps } from './EmptyState';
import { PagedItems, type ListState } from './PagedItems';
import type { PaginatorOptions } from './Paginator';

interface ListResultsProps<T extends { id: number }> {
  list: ListState<T>;
  columns: string[];
  /** Celdas `<td>` de la fila (con `data-label` para la vista de tarjetas en móvil). */
  renderCells: (item: T) => ReactNode;
  onOpen: (item: T) => void;
  /** Sin resultados: ícono, título, descripción y (sin filtros) la acción para crear el primero. */
  empty: EmptyStateProps;
  /** Personalización del paginador (nombre de los elementos, textos, partes visibles...). */
  pager?: PaginatorOptions;
}

/** Resultados de un listado en tabla (filas navegables por teclado) con sus estados y paginación. */
export function ListResults<T extends { id: number }>({ list, columns, renderCells, onOpen, empty, pager }: ListResultsProps<T>) {
  return (
    <PagedItems list={list} empty={empty} pager={pager}>
      {(items) => (
        <div className={`table-wrap ${list.loading ? 'is-loading' : ''}`}>
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
      )}
    </PagedItems>
  );
}
