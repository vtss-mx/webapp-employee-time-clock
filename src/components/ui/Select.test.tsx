import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { filterOptions, listKeyAction, Select, type SelectOption } from './Select';

type Fruit = 'apple' | 'banana' | 'cherry' | 'date';
const OPTIONS: SelectOption<Fruit>[] = [
  { value: 'apple', label: 'Manzana', description: 'Roja' },
  { value: 'banana', label: 'Plátano', disabled: true },
  { value: 'cherry', label: 'Cereza', icon: <span>🍒</span> },
  { value: 'date', label: 'Dátil' },
];

function Harness({ initial = 'apple' as Fruit }) {
  const [value, setValue] = useState<Fruit>(initial);
  return (
    <>
      <Select<Fruit> value={value} options={OPTIONS} onChange={setValue} aria-label="Fruta" />
      <output>{value}</output>
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: /Fruta/ });
const output = () => document.querySelector('output')?.textContent;

describe('Select: lista propia (sin el menú nativo)', () => {
  it('muestra el valor elegido y abre una lista con aclaraciones, íconos y la opción elegida marcada', async () => {
    render(<Harness />);
    expect(trigger()).toHaveAccessibleName('Fruta Manzana');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger());
    const list = screen.getByRole('listbox', { name: 'Fruta' });
    expect(list.closest('.floating')?.parentElement).toBe(document.body); // capa flotante: ningún panel la recorta
    expect(within(list).getByRole('option', { name: /Manzana/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(list).getByText('Roja')).toBeInTheDocument();
    expect(within(list).getByRole('option', { name: /Plátano/ })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(within(list).getByRole('option', { name: /Plátano/ })); // deshabilitada: no se elige
    expect(output()).toBe('apple');
    await userEvent.click(within(list).getByRole('option', { name: /Cereza/ }));
    expect(output()).toBe('cherry');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger()).toHaveFocus();
    expect(document.querySelector('.select__icon')).toHaveTextContent('🍒'); // el ícono de la elegida
  });

  it('teclado: flechas (salta las deshabilitadas), Inicio/Fin, letra, Enter y Escape', async () => {
    render(<Harness />);
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}'); // abre en la elegida
    const list = screen.getByRole('listbox');
    expect(list).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}'); // salta "Plátano"
    expect(list).toHaveAttribute('aria-activedescendant', expect.stringMatching(/opt-2$/));
    await userEvent.keyboard('{End}{Enter}');
    expect(output()).toBe('date');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Home}m{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(output()).toBe('date'); // Escape no cambia el valor
    await userEvent.keyboard(' ');
    await userEvent.keyboard('c ');
    expect(output()).toBe('cherry'); // la letra salta a "Cereza"
  });

  it('tocar fuera cierra la lista; deshabilitado no se abre', async () => {
    const { rerender } = render(
      <>
        <Select value="apple" options={OPTIONS} onChange={() => undefined} aria-label="Fruta" />
        <button type="button">fuera</button>
      </>,
    );
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'fuera' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    rerender(<Select value="apple" options={OPTIONS} onChange={() => undefined} aria-label="Fruta" disabled />);
    await userEvent.click(trigger());
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('Select con búsqueda (listas largas)', () => {
  const COUNTRIES: SelectOption[] = [
    { value: 'MX', label: 'México' },
    { value: 'US', label: 'Estados Unidos' },
    { value: 'ES', label: 'España' },
    { value: 'PE', label: 'Perú' },
  ];
  function Countries() {
    const [value, setValue] = useState('MX');
    return (
      <>
        <Select value={value} options={COUNTRIES} onChange={setValue} aria-label="País" searchable={{ placeholder: 'Buscar país', empty: 'Ningún país coincide' }} />
        <output>{value}</output>
      </>
    );
  }

  it('filtra sin distinguir acentos; flechas y Enter eligen; sin coincidencias lo dice', async () => {
    render(<Countries />);
    await userEvent.click(screen.getByRole('button', { name: /País/ }));
    const search = screen.getByRole('combobox', { name: 'Buscar país' });
    expect(search).toHaveFocus();
    await userEvent.type(search, 'espa');
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual(['España']);
    await userEvent.clear(search);
    await userEvent.type(search, 'es');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(output()).toBe('ES'); // "Estados Unidos" y "España": la segunda
    await userEvent.click(screen.getByRole('button', { name: /País/ }));
    expect(screen.getByRole('combobox')).toHaveValue(''); // cada apertura empieza sin búsqueda
    await userEvent.type(screen.getByRole('combobox'), 'zz');
    expect(screen.getByText('Ningún país coincide')).toBeInTheDocument();
    await userEvent.keyboard('{Enter}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(output()).toBe('ES');
  });

  it('reglas puras: búsqueda por texto, aclaración o código; con buscador las letras no saltan', () => {
    expect(filterOptions(COUNTRIES, ' PERU ').map((o) => o.value)).toEqual(['PE']);
    expect(filterOptions(COUNTRIES, 'us').map((o) => o.value)).toEqual(['US']);
    expect(filterOptions(COUNTRIES, '')).toBe(COUNTRIES);
    expect(listKeyAction('m', COUNTRIES, 0, { typeahead: false })).toBeNull();
    expect(listKeyAction(' ', COUNTRIES, 0, { typeahead: false })).toBeNull();
    expect(listKeyAction('Home', COUNTRIES, 2, { typeahead: false })).toBeNull();
    expect(listKeyAction('ArrowDown', COUNTRIES, 0, { typeahead: false })).toEqual({ kind: 'move', index: 1 });
  });
});

describe('Select: casos límite', () => {
  const activeOption = () => screen.getByRole('listbox').getAttribute('aria-activedescendant');

  it('flecha arriba sube; una letra sin opción no mueve; Tab cierra sin devolver el foco al control', async () => {
    render(
      <>
        <Harness initial="date" />
        <button type="button">siguiente</button>
      </>,
    );
    trigger().focus();
    await userEvent.keyboard('{ArrowUp}'); // abre en la elegida ("Dátil")
    expect(activeOption()).toMatch(/opt-3$/);
    await userEvent.keyboard('{ArrowUp}');
    expect(activeOption()).toMatch(/opt-2$/);
    await userEvent.keyboard('z');
    expect(activeOption()).toMatch(/opt-2$/);
    const tabbed = fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Tab' });
    expect(tabbed).toBe(true); // el navegador mueve el foco al siguiente control
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger()).not.toHaveFocus();
    expect(output()).toBe('date');
  });

  it('otras teclas en el control no abren la lista; un clic con la lista abierta la cierra', async () => {
    render(<Harness />);
    trigger().focus();
    await userEvent.keyboard('a');
    expect(screen.queryByRole('listbox')).toBeNull();
    await userEvent.click(trigger());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(trigger());
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('elegir la opción que ya estaba elegida no avisa un cambio', async () => {
    const onChange = vi.fn();
    render(<Select<Fruit> value="apple" options={OPTIONS} onChange={onChange} aria-label="Fruta" />);
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('option', { name: /Manzana/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('valor fuera de las opciones o deshabilitado: texto de ayuda y al abrir se activa la primera disponible', async () => {
    const { rerender } = render(<Select<Fruit> value={'kiwi' as Fruit} options={OPTIONS} onChange={() => undefined} aria-label="Fruta" placeholder="Elige una fruta" />);
    expect(trigger()).toHaveAccessibleName('Fruta Elige una fruta');
    expect(document.querySelector('.select__value')).toHaveClass('select__value--placeholder');
    rerender(<Select<Fruit> value={'kiwi' as Fruit} options={OPTIONS} onChange={() => undefined} aria-label="Fruta" />);
    expect(trigger()).toHaveAccessibleName('Fruta Selecciona una opción');
    rerender(<Select<Fruit> value="banana" options={OPTIONS} onChange={() => undefined} aria-label="Fruta" />);
    await userEvent.click(trigger());
    expect(activeOption()).toMatch(/opt-0$/); // "Plátano" está deshabilitada
  });

  it('sin aria-label ni etiqueta visible no apunta a una etiqueta inexistente', () => {
    render(<Select<Fruit> value="apple" options={OPTIONS} onChange={() => undefined} />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-labelledby');
  });

  it('deshabilitado: tampoco se abre con el teclado', () => {
    render(<Select<Fruit> value="apple" options={OPTIONS} onChange={() => undefined} aria-label="Fruta" disabled />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('contenido propio por opción y buscador con sus textos por omisión', async () => {
    render(
      <Select<Fruit>
        value="cherry"
        options={OPTIONS}
        onChange={() => undefined}
        aria-label="Fruta"
        searchable
        renderOption={(option, state) => <b>{`${option.label}${state.selected ? ' (elegida)' : ''}`}</b>}
      />,
    );
    await userEvent.click(trigger());
    expect(screen.getByRole('option', { name: 'Cereza (elegida)' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('combobox', { name: 'Buscar…' }), 'kiwi');
    expect(screen.getByRole('status')).toHaveTextContent('Sin resultados');
  });
});

