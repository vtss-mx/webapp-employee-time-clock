import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DateField, displayToValue, isoToDisplay, maskDate, parseIso, toIso } from './DateField';

function Harness({ initial = '', min = '1920-01-01', max = '2010-06-15' }: { initial?: string; min?: string; max?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField label="Fecha de nacimiento" value={value} onChange={setValue} min={min} max={max} hint="Edad mínima" />
      <output>{value}</output>
      <button type="button" onClick={() => setValue('1999-12-31')}>externo</button>
    </>
  );
}

describe('utilidades de fecha', () => {
  it('convierte, enmascara y valida', () => {
    expect(toIso(new Date(2001, 0, 9))).toBe('2001-01-09');
    expect(parseIso('2001-02-30')).toBeNull();
    expect(parseIso('basura')).toBeNull();
    expect(isoToDisplay('2001-01-09')).toBe('09/01/2001');
    expect(isoToDisplay('')).toBe('');
    expect(maskDate('09a012001999')).toBe('09/01/2001');
    expect(maskDate('091')).toBe('09/1');
    expect(displayToValue('09/01/2001')).toBe('2001-01-09');
    expect(displayToValue('09/01')).toBe('');
    expect(displayToValue('31/02/2001')).toBe('31/02/2001'); // completa pero inexistente → inválida
  });
});

describe('DateField', () => {
  it('escribe con máscara en formato dd/mm/aaaa y entrega ISO', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Fecha de nacimiento');
    expect(input).toHaveAttribute('placeholder', 'dd/mm/aaaa');
    await userEvent.type(input, '15031990');
    expect(input).toHaveValue('15/03/1990');
    expect(document.querySelector('output')?.textContent).toBe('1990-03-15');
  });

  it('elige en el calendario respetando la fecha máxima', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }));
    expect(screen.getByRole('dialog', { name: 'Elegir fecha' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: '16 de Junio de 2010' })).toBeDisabled(); // después del máximo
    await userEvent.click(screen.getByRole('gridcell', { name: '10 de Junio de 2010' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('10/06/2010');
    expect(document.querySelector('output')?.textContent).toBe('2010-06-10');
  });

  it('abre en el mes indicado cuando aún no hay fecha', async () => {
    render(<DateField label="F" value="" onChange={() => undefined} openTo="1996-01-01" max="2010-06-15" />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }));
    expect(screen.getByRole('button', { name: 'Elegir mes, actual: Enero' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir año, actual: 1996' })).toBeInTheDocument();
  });

  it('elige año → mes → día con vistas propias (sin listas nativas del sistema)', async () => {
    render(<Harness initial="2000-01-15" />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }));
    expect(screen.getByRole('dialog').querySelector('select')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Elegir año, actual: 2000' }));
    const years = screen.getByRole('group', { name: 'Años' });
    expect(within(years).getByRole('button', { name: '2000' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(years).queryByRole('button', { name: '2011' })).toBeNull(); // después del máximo (2010)
    expect(screen.getByRole('button', { name: 'Años siguientes' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Años anteriores' }));
    await userEvent.click(screen.getByRole('button', { name: '1995' }));

    const months = screen.getByRole('group', { name: 'Meses de 1995' });
    await userEvent.click(within(months).getByRole('button', { name: 'Julio de 1995' }));
    expect(screen.getByRole('gridcell', { name: '1 de Julio de 1995' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('gridcell', { name: '1 de Agosto de 1995' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));

    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveAccessibleName('23 de Julio de 1995');
    await userEvent.click(screen.getByRole('gridcell', { name: '23 de Julio de 1995' }));
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('23/07/1995');
  });

  it('meses fuera del rango deshabilitados; Escape regresa a los días y luego cierra; clic fuera cierra', async () => {
    render(<Harness initial="2010-03-01" />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }));
    await userEvent.click(screen.getByRole('button', { name: 'Elegir mes, actual: Marzo' }));
    const months = screen.getByRole('group', { name: 'Meses de 2010' });
    expect(within(months).getByRole('button', { name: 'Junio de 2010' })).toBeEnabled();
    expect(within(months).getByRole('button', { name: 'Julio de 2010' })).toBeDisabled(); // máximo: 15/06/2010
    fireEvent.keyDown(months, { key: 'ArrowRight' }); // flechas entre opciones
    expect(screen.getByRole('button', { name: 'Año siguiente' })).toBeDisabled();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('grid')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('se sincroniza con cambios externos del valor', async () => {
    render(<Harness initial="2000-01-15" />);
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('15/01/2000');
    await userEvent.click(screen.getByRole('button', { name: 'externo' }));
    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('31/12/1999');
  });

  it('muestra el error en lugar de la ayuda', () => {
    render(<DateField label="Fecha" value="" onChange={() => undefined} error="La fecha es obligatoria" hint="Edad mínima" />);
    expect(screen.getByRole('alert')).toHaveTextContent('La fecha es obligatoria');
    expect(screen.queryByText('Edad mínima')).toBeNull();
    expect(screen.getByLabelText('Fecha')).toHaveAttribute('aria-invalid', 'true');
  });
});

