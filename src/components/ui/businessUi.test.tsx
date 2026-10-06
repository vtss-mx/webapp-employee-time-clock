import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CountUp } from '../CountUp';
import { BarList } from './BarList';
import { ColumnChart } from './ColumnChart';
import { FilePicker } from './FilePicker';
import { KpiCard } from './KpiCard';
import { digitsOf, NumberField, parseNumber, steppedValue } from './NumberField';

const pdf = new File(['%PDF-1.7'], 'spei.pdf', { type: 'application/pdf' });

function Picker({ disabled = false, error }: { disabled?: boolean; error?: string }) {
  const [file, setFile] = useState<File | null>(null);
  return <FilePicker label="Comprobante" value={file} onChange={setFile} accept="application/pdf" hint="PDF de hasta 5 MB" error={error} disabled={disabled} labels={{ choose: 'Elegir comprobante' }} />;
}

/** Suelta archivos sobre la zona (jsdom no crea DataTransfer: se arma el evento a mano). */
function drop(target: Element, files: File[]) {
  const event = createEvent.drop(target);
  Object.defineProperty(event, 'dataTransfer', { value: { files: { item: (i: number) => files[i] ?? null } } });
  fireEvent(target, event);
}

describe('FilePicker (selector de archivo propio)', () => {
  it('el input nativo queda oculto; elegir muestra nombre y tamaño; "Quitar" lo descarta', async () => {
    const { container } = render(<Picker />);
    const input = screen.getByLabelText('Comprobante');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveClass('file-picker__input');
    expect(input).toHaveAccessibleDescription('PDF de hasta 5 MB');
    expect(screen.getByText('Elegir comprobante')).toBeInTheDocument();
    expect(screen.getByText('o arrástralo aquí')).toBeInTheDocument();

    await userEvent.upload(input, pdf);
    expect(screen.getByText('spei.pdf')).toBeInTheDocument();
    expect(screen.getByText('< 0.01 MB')).toBeInTheDocument(); // todo tamaño en MB
    expect(container.querySelector('.file-picker')).toHaveClass('has-file');
    expect((input as HTMLInputElement).value).toBe(''); // elegir el mismo archivo otra vez también avisa

    // "Cambiar" abre el selector del sistema (el mismo input oculto).
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(click).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Quitar archivo' }));
    expect(screen.queryByText('spei.pdf')).toBeNull();
    // Cancelar el selector del sistema no elige nada.
    fireEvent.change(input, { target: { files: { item: () => null } } });
    expect(screen.getByText('Elegir comprobante')).toBeInTheDocument();
  });

  it('arrastrar marca la zona y soltar elige el archivo; deshabilitado no acepta nada', () => {
    const { container, rerender } = render(<Picker error="Archivo inválido" />);
    const box = container.querySelector('.file-picker__box') as HTMLElement;
    expect(screen.getByText('Archivo inválido')).toBeInTheDocument();
    fireEvent.dragOver(box);
    expect(container.querySelector('.file-picker')).toHaveClass('is-dragging');
    fireEvent.dragLeave(box);
    expect(container.querySelector('.file-picker')).not.toHaveClass('is-dragging');
    drop(box, []); // nada que elegir
    expect(screen.queryByText('spei.pdf')).toBeNull();
    drop(box, [pdf]);
    expect(screen.getByText('spei.pdf')).toBeInTheDocument();

    rerender(<Picker disabled />);
    const fresh = container.querySelector('.file-picker__box') as HTMLElement;
    fireEvent.dragOver(fresh);
    expect(container.querySelector('.file-picker')).not.toHaveClass('is-dragging');
  });

  it('deshabilitado: soltar un archivo no lo elige', () => {
    const onChange = vi.fn();
    const { container } = render(<FilePicker label="Comprobante" value={null} onChange={onChange} disabled />);
    drop(container.querySelector('.file-picker__box') as HTMLElement, [pdf]);
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('.file-picker')).toHaveClass('is-disabled');
  });
});

describe('ColumnChart y BarList (gráficas propias)', () => {
  const days = [
    { day: '1 oct', a: 10, b: 4 },
    { day: '2 oct', a: 0, b: 2 },
    { day: '3 oct', a: 5, b: 0 },
  ];

  it('una serie: sin leyenda, columnas con su altura, resumen accesible y la tabla completa', () => {
    const { container } = render(<ColumnChart title="Peticiones por día" items={days} itemKey={(d) => d.day} itemLabel={(d) => d.day} series={[{ key: 'a', label: 'Peticiones', value: (d) => d.a }]} format={String} maxTicks={2} />);
    expect(container.querySelector('.chart-legend')).toBeNull();
    expect(screen.getByRole('img', { name: 'Peticiones por día. 3 días. Total Peticiones: 15. Máximo por día: 10.' })).toBeInTheDocument();
    const bars = [...container.querySelectorAll<HTMLElement>('.column-chart__bar')];
    expect(bars.map((bar) => bar.style.getPropertyValue('--value'))).toEqual(['1', '0', '0.5']);
    expect([...container.querySelectorAll('.column-chart__tick')].map((tick) => tick.className.includes('is-hidden'))).toEqual([false, true, false]);
    const table = screen.getByRole('table', { name: 'Peticiones por día' });
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['DíaPeticiones', '1 oct10', '2 oct0', '3 oct5']);
    expect(container.querySelector('.column-chart__tip')).toHaveTextContent('1 octPeticiones: 10');
  });

  it('dos series: leyenda y pares; todo en cero no divide entre cero; otra categoría', () => {
    const { container } = render(
      <ColumnChart
        title="Datos"
        items={[days[0]]}
        itemKey={(d) => d.day}
        itemLabel={(d) => d.day}
        series={[
          { key: 'a', label: 'Entrada', value: () => 0 },
          { key: 'b', label: 'Salida', value: () => 0 },
        ]}
        format={(v) => `${v} B`}
        category={{ header: 'Semana', one: 'semana', other: 'semanas' }}
        className="mine"
      />,
    );
    expect(container.querySelector('.column-chart')).toHaveClass('mine');
    expect(container.querySelector('.chart-legend')).toHaveTextContent('Entrada Salida');
    expect(screen.getByRole('img')).toHaveAccessibleName('Datos. 1 semana. Total Entrada: 0 B; Salida: 0 B. Máximo por semana: 0 B.');
    expect([...container.querySelectorAll<HTMLElement>('.column-chart__bar')].map((bar) => bar.style.getPropertyValue('--value'))).toEqual(['0', '0']);
    expect(screen.getByRole('columnheader', { name: 'Semana' })).toBeInTheDocument();
  });

  it('barras horizontales: valor escrito, contra el mayor o contra el total', () => {
    const items = [
      { key: 'a', label: 'Biometría', value: 30, detail: '10 registros', title: 'Plantillas' },
      { key: 'b', label: 'Asistencia', value: 10 },
      { key: 'c', label: 'Vacío', value: -2 },
    ];
    const { container, rerender } = render(<BarList label="Almacenamiento" items={items} format={(v) => `${v} MB`} className="extra" />);
    const list = screen.getByRole('list', { name: 'Almacenamiento' });
    expect(list).toHaveClass('extra');
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Biometría30 MB10 registros', 'Asistencia10 MB', 'Vacío-2 MB']);
    expect(screen.getByTitle('Plantillas')).toBeInTheDocument();
    const fills = () => [...container.querySelectorAll<HTMLElement>('.bar-list__fill')].map((fill) => fill.style.getPropertyValue('--value'));
    expect(fills()).toEqual(['1', String(10 / 30), '0']);
    rerender(<BarList label="Almacenamiento" items={items} format={String} scale="total" />);
    expect(fills()).toEqual(['0.75', '0.25', '0']);
    rerender(<BarList label="Almacenamiento" items={[{ key: 'z', label: 'Nada', value: 0 }]} format={String} />);
    expect(fills()).toEqual(['0']);
  });
});

describe('NumberField con decimales, KpiCard y CountUp con formato', () => {
  it('reglas de los decimales: punto, cuántos decimales y pasos sin errores de redondeo', () => {
    expect(digitsOf('$1,250.505', 1_000_000, 2)).toBe('1250.50');
    expect(digitsOf('12.3.4', undefined, 2)).toBe('12.34');
    expect(digitsOf('99999999.5', 1_000_000, 2)).toBe('9999999.5');
    expect(digitsOf('12', undefined, 2)).toBe('12');
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('.')).toBeNull();
    expect(parseNumber('12.5')).toBe(12.5);
    expect(steppedValue('0.1', 2, { min: 0, step: 0.1, decimals: 2 })).toBe('0.3');
    expect(steppedValue('.', 1, { min: 0, step: 1, decimals: 2 })).toBe('0');
  });

  it('el campo con decimales abre el teclado decimal y acepta un punto', async () => {
    function Money() {
      const [value, setValue] = useState('');
      return <NumberField label="Precio" value={value} onChange={setValue} decimals={2} max={1000} unit="MXN" />;
    }
    render(<Money />);
    const field = screen.getByRole('spinbutton', { name: 'Precio' });
    expect(field).toHaveAttribute('inputmode', 'decimal');
    await userEvent.type(field, '12.345');
    expect(field).toHaveValue('12.34');
    expect(field).toHaveAttribute('aria-valuenow', '12.34');
    await userEvent.clear(field);
    await userEvent.type(field, '.');
    expect(field).not.toHaveAttribute('aria-valuenow'); // a medias, aún no es un número
  });

  it('KpiCard con formato y una línea de contexto; CountUp termina exacto en el valor con decimales', async () => {
    const { container } = render(<KpiCard label="Por cobrar" icon={Wallet} value={1234.5} format={(v) => `$${v.toFixed(2)}`} hint="3 cargos abiertos" />);
    await waitFor(() => expect(container.querySelector('.kpi__value')).toHaveTextContent('$1234.50'));
    expect(container.querySelector('.kpi__hint')).toHaveTextContent('3 cargos abiertos');
    render(<CountUp value={7} duration={10} />);
    expect(await screen.findByText('7')).toBeInTheDocument();
  });
});
