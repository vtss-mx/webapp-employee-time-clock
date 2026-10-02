import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PhoneField } from './PhoneField';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PhoneField label="Teléfono" value={value} onChange={setValue} hint="Con lada" required />
      <output>{value}</output>
      <button type="button" onClick={() => setValue('+34612345678')}>
        cargar
      </button>
    </>
  );
}

const output = () => document.querySelector('output')?.textContent;
const countryButton = () => screen.getByRole('button', { name: /^Lada:/ });

describe('PhoneField: teléfono con lada internacional', () => {
  it('México por omisión: formatea mientras se escribe y entrega E.164', async () => {
    render(<Harness />);
    expect(countryButton()).toHaveTextContent('+52');
    await userEvent.type(screen.getByLabelText('Teléfono'), '6621234567');
    expect(screen.getByLabelText('Teléfono')).toHaveValue('662 123 4567');
    expect(output()).toBe('+526621234567');
    await userEvent.clear(screen.getByLabelText('Teléfono'));
    expect(output()).toBe('');
  });

  it('elige el país con búsqueda y teclado; conserva el número', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Teléfono'), '612345678');
    await userEvent.click(countryButton());
    const search = screen.getByRole('combobox', { name: 'Buscar país o lada' });
    expect(search).toHaveFocus();
    expect(screen.getByRole('option', { name: /México/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.type(search, 'espana'); // sin acento también encuentra "España"
    await userEvent.keyboard('{Enter}');
    expect(countryButton()).toHaveTextContent('+34');
    expect(output()).toBe('+34612345678');
    expect(screen.getByLabelText('Teléfono')).toHaveFocus();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('busca por lada, navega con flechas, avisa sin resultados y cierra con Escape o clic fuera', async () => {
    render(<Harness />);
    await userEvent.click(countryButton());
    const search = screen.getByRole('combobox');
    await userEvent.type(search, '+49');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Alemania')]);
    await userEvent.clear(search);
    await userEvent.type(search, 'zzzz');
    expect(screen.getByText('Sin resultados para “zzzz”')).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{PageDown}');
    expect(search.getAttribute('aria-activedescendant')).toMatch(/-9$/);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(countryButton()).toHaveFocus();

    await userEvent.click(countryButton());
    await userEvent.click(screen.getByRole('option', { name: /Canadá/ }));
    expect(countryButton()).toHaveTextContent('+1');
    await userEvent.click(countryButton());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('pegar un número con lada cambia el país; un valor cargado muestra su país', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText('Teléfono'));
    await userEvent.paste('+1 (415) 555-2671');
    expect(output()).toBe('+14155552671');
    expect(countryButton()).toHaveAccessibleName(/Estados Unidos \(\+1\)/);

    await userEvent.click(screen.getByRole('button', { name: 'cargar' }));
    expect(countryButton()).toHaveAccessibleName(/España \(\+34\)/);
    expect(screen.getByLabelText('Teléfono')).toHaveValue('612 34 56 78');
  });

  it('muestra el error del campo y la ayuda', () => {
    render(<PhoneField label="Teléfono" value="" onChange={() => undefined} error="El teléfono es obligatorio" disabled />);
    expect(screen.getByLabelText('Teléfono')).toHaveAccessibleDescription('El teléfono es obligatorio');
    expect(countryButton()).toBeDisabled();
  });
});
