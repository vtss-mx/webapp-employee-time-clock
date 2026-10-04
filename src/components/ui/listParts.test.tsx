import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ListToolbar } from './ListControls';
import { PagedItems, type ListState } from './PagedItems';
import { Switch } from './Switch';

const idleList = (changes: Partial<ListState<string>> = {}): ListState<string> => ({
  data: null,
  error: null,
  retry: vi.fn(),
  page: 1,
  size: 10,
  total: 0,
  loading: false,
  setPage: vi.fn(),
  setSize: vi.fn(),
  ...changes,
});

describe('partes de los listados', () => {
  it('PagedItems: sin datos, sin error y sin cargar (petición cancelada) no dibuja nada', () => {
    const { container } = render(
      <PagedItems list={idleList()} empty={{ icon: <span />, title: 'Sin registros' }}>
        {(items) => <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>}
      </PagedItems>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('ListToolbar: sin filtro elegido muestra "Todos los estados" y avisa el que se elija', async () => {
    const onFilter = vi.fn();
    render(<ListToolbar search="" onSearch={() => undefined} placeholder="Buscar" label="Buscar empleados" onFilter={onFilter} />);
    const filter = screen.getByRole('button', { name: /Filtrar por estado/ });
    expect(filter).toHaveTextContent('Todos los estados');
    await userEvent.click(filter);
    await userEvent.click(screen.getByRole('option', { name: 'Inactivos' }));
    expect(onFilter).toHaveBeenCalledWith('inactive');
  });

  it('Switch con etiqueta compuesta: el nombre accesible sale de la fila (<label>)', async () => {
    const onChange = vi.fn();
    render(
      <Switch
        checked={false}
        onChange={onChange}
        label={
          <>
            Reconocimiento <em>evolutivo</em>
          </>
        }
      />,
    );
    const toggle = screen.getByRole('switch', { name: /Reconocimiento evolutivo/ });
    expect(toggle).not.toHaveAttribute('aria-label');
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
