import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../../context/FeedbackContext';
import { usePagedList } from '../../hooks/usePagedList';
import type { Page, PageQuery } from '../../types';
import { config } from '../../utils/config';
import { Paginator, pageItems, type PaginatorOptions } from './Paginator';

describe('pageItems: números visibles con "…"', () => {
  it('todas las páginas si caben; si no, primera, última y vecinas de la actual con el mismo número de casillas', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap-end', 20]);
    expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap-end', 20]);
    expect(pageItems(10, 20)).toEqual([1, 'gap-start', 9, 10, 11, 'gap-end', 20]);
    expect(pageItems(20, 20)).toEqual([1, 'gap-start', 16, 17, 18, 19, 20]);
    expect(pageItems(10, 20, 2)).toEqual([1, 'gap-start', 8, 9, 10, 11, 12, 'gap-end', 20]);
    expect(pageItems(5, 10, 0)).toEqual([1, 'gap-start', 5, 'gap-end', 10]);
  });
});

function Harness({ total = 57, initialSize = 10, ...options }: { total?: number; initialSize?: number } & PaginatorOptions) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(initialSize);
  return (
    <Paginator
      {...options}
      page={page}
      size={size}
      total={total}
      onPage={setPage}
      onSize={(next) => {
        setSize(next);
        setPage(1);
      }}
    />
  );
}

const nav = () => screen.getByRole('navigation', { name: 'Paginación' });
const range = () => nav().querySelector('.pager__range');

describe('Paginator', () => {
  it('muestra el rango, cambia de página con números, flechas y extremos', async () => {
    render(<Harness noun={{ one: 'empleado', other: 'empleados' }} />);
    expect(range()).toHaveTextContent('Mostrando 1–10 de 57 empleados');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Primera página' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page');

    await userEvent.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(range()).toHaveTextContent('Mostrando 21–30 de 57 empleados');
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByRole('button', { name: 'Página 4' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Última página' }));
    expect(range()).toHaveTextContent('Mostrando 51–57 de 57 empleados');
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Página 6' })); // la actual: no hace nada
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Primera página' }));
    expect(range()).toHaveTextContent('Mostrando 1–10');
  });

  it('elementos por página con la lista propia: 10, 20, 30, 40 y 50 por omisión; volver a la página 1', async () => {
    render(<Harness />);
    expect(config.pageSizes).toEqual([10, 20, 30, 40, 50]);
    await userEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    const select = screen.getByRole('button', { name: 'Por página 10' });
    await userEvent.click(select);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option').map((o) => o.textContent)).toEqual(['10', '20', '30', '40', '50']);
    await userEvent.click(within(listbox).getByRole('option', { name: '50' }));
    expect(range()).toHaveTextContent('Mostrando 1–50 de 57 resultados');
    expect(screen.getByRole('button', { name: 'Por página 50' })).toBeInTheDocument();
  });

  it('se personaliza: textos, partes visibles, opciones y variante', () => {
    render(
      <Harness
        total={1}
        initialSize={15}
        sizes={[10, 25]}
        variant="compact"
        className="mi-paginador"
        show={{ edges: false, pages: false }}
        noun={{ one: 'intento', other: 'intentos' }}
        labels={{ navigation: 'Paginación', perPage: 'Mostrar', status: (page, total) => `${page}/${total}` }}
      />,
    );
    expect(nav()).toHaveClass('pager--compact', 'pager--no-pages', 'mi-paginador');
    expect(range()).toHaveTextContent('Mostrando 1 de 1 intento');
    expect(screen.queryByRole('button', { name: 'Primera página' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Página 1' })).toBeNull();
    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar 15' })).toBeInTheDocument(); // el tamaño actual siempre es opción
  });

  it('sin elementos no se dibuja; mientras carga los botones no responden', () => {
    const onPage = vi.fn();
    const { rerender, container } = render(<Paginator page={1} size={10} total={0} onPage={onPage} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Paginator page={2} size={10} total={40} onPage={onPage} loading />);
    expect(nav()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Página 3' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Por página/ })).toBeNull(); // sin onSize no se ofrece
  });
});

describe('Paginator: muchas páginas y un solo resultado', () => {
  it('con muchas páginas muestra "…" entre los extremos y las vecinas de la actual', () => {
    render(<Paginator page={10} size={10} total={200} onPage={() => undefined} />);
    expect(nav().querySelectorAll('.pager__gap')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Página 9' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Página 5' })).toBeNull();
  });

  it('un solo resultado sin sustantivo propio: "resultado" en singular', () => {
    render(<Paginator page={1} size={10} total={1} onPage={() => undefined} />);
    expect(range()).toHaveTextContent('Mostrando 1 de 1 resultado');
  });
});

describe('usePagedList', () => {
  const pageOf = (query: PageQuery, total: number): Page<number> => {
    const from = (query.page - 1) * query.size;
    const items = Array.from({ length: Math.max(0, Math.min(query.size, total - from)) }, (_, i) => from + i + 1);
    return { items, total, page: query.page, size: query.size };
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;

  it('10 por página por omisión; los filtros nuevos y el tamaño vuelven a la página 1 con una sola petición', async () => {
    const fetchPage = vi.fn((query: PageQuery) => Promise.resolve(pageOf(query, 35)));
    const { result, rerender } = renderHook(({ filter }) => usePagedList(fetchPage, { errorTitle: 'x', filterKey: filter }), { wrapper, initialProps: { filter: 'a' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 1, size: 10 }, expect.any(AbortSignal));
    expect(result.current.totalPages).toBe(4);

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.data?.items[0]).toBe(21));
    const calls = fetchPage.mock.calls.length;
    rerender({ filter: 'b' });
    await waitFor(() => expect(result.current.data?.page).toBe(1));
    expect(fetchPage.mock.calls.slice(calls).map(([query]) => query)).toEqual([{ page: 1, size: 10 }]);

    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    act(() => result.current.setSize(20));
    await waitFor(() => expect(result.current.data?.size).toBe(20));
    expect(result.current.page).toBe(1);
    act(() => result.current.updateItems((items) => items.map((n) => n * 100)));
    expect(result.current.data?.items[0]).toBe(100);
  });

  it('si la página queda vacía (se eliminó lo último) vuelve a la última que existe', async () => {
    let total = 21;
    const fetchPage = vi.fn((query: PageQuery) => Promise.resolve(pageOf(query, total)));
    const { result } = renderHook(() => usePagedList(fetchPage, { errorTitle: 'x' }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.data?.items).toEqual([21]));
    total = 20;
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.data?.items).toHaveLength(10));
  });
});
