import type { Key, KeyboardEvent, ReactNode } from 'react';
import type { EmptyStateProps } from './EmptyState';
import { PagedItems, type ListState } from './PagedItems';
import type { PaginatorOptions } from './Paginator';

interface ListResultsBase<T> {
  list: ListState<T>;
  columns: string[];
  /** Celdas `<td>` de la fila (con `data-label` para la vista de tarjetas en móvil). */
  renderCells: (item: T) => ReactNode;
  /** Abre el detalle de la fila. Sin él, la tabla es de solo lectura (filas sin clic ni foco). */
  onOpen?: (item: T) => void;
  /** Sin resultados: ícono, título, descripción y (sin filtros) la acción para crear el primero. */
  empty: EmptyStateProps;
  /** Personalización del paginador (nombre de los elementos, textos, partes visibles...). */
  pager?: PaginatorOptions;
}

/**
 * Clave de cada fila: su `id` por omisión; los registros sin `id` (p. ej. `company_id`, una ruta de la
 * API) o con ids que se repiten entre tipos (cargos y pagos del estado de cuenta) dan la suya.
 */
type RowKeyProps<T> = T extends { id: number } ? { rowKey?: (item: T) => Key } : { rowKey: (item: T) => Key };

type ListResultsProps<T> = ListResultsBase<T> & RowKeyProps<T>;

/** Resultados de un listado en tabla (filas navegables por teclado) con sus estados y paginación. */
export function ListResults<T extends object>(props: ListResultsProps<T>) {
  const { list, columns, renderCells, onOpen, empty, pager } = props;
  // Sin `rowKey`, el tipo garantiza que la fila tiene `id`.
  const keyOf = (props.rowKey as ((item: T) => Key) | undefined) ?? ((item: T) => (item as unknown as { id: number }).id);
  return (
    <PagedItems list={list} empty={empty} pager={pager}>
      {(items) => (
        <div className={`table-wrap ${list.loading ? 'is-loading' : ''}`}>
          <table className={`table ${onOpen ? '' : 'table--readonly'}`}>
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
                  key={keyOf(item)}
                  style={{ animationDelay: `${i * 25}ms` }}
                  {...(onOpen && { onClick: () => onOpen(item), tabIndex: 0, onKeyDown: (e: KeyboardEvent) => e.key === 'Enter' && onOpen(item) })}
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
