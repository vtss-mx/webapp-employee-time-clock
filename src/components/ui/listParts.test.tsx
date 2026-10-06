import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';
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
      <PagedItems list={idleList()} empty={{ icon: <span />, title: 'Sin registros', description: 'Aquí verás los registros.' }}>
        {(items) => <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>}
      </PagedItems>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('EmptyState: siempre ícono, título y descripción, en ese orden, y la acción al final; compacto y de buena noticia', () => {
    const { container, rerender } = render(<EmptyState icon={<svg data-testid="icon" />} title="Sin empresas" description="Registra la primera empresa para empezar." action={<button>Registrar la primera</button>} />);
    const box = screen.getByRole('status');
    expect(box).toHaveClass('empty-state', 'empty-state--neutral');
    expect(box).not.toHaveClass('empty-state--compact');
    expect([...box.children].map((child) => child.className)).toEqual(['empty-state__icon', 'empty-state__title', 'empty-state__text', 'empty-state__action']);
    expect(box).toHaveTextContent('Sin empresasRegistra la primera empresa para empezar.Registrar la primera');
    rerender(<EmptyState compact tone="success" icon={<svg />} title="Todo al día" description="No hay casos de fraude por revisar." />);
    expect(screen.getByRole('status')).toHaveClass('empty-state--success', 'empty-state--compact');
    expect(container.querySelector('.empty-state__action')).toBeNull();
    expect(container.querySelector('.empty-state__text')).toHaveTextContent('No hay casos de fraude por revisar.');
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
