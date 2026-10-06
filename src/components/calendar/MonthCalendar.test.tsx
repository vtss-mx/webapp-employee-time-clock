import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { businessToday } from '../../utils/format';
import { MonthCalendar, type CalendarMarker } from './MonthCalendar';

const markers: Record<string, CalendarMarker[]> = {
  '2026-10-12': [
    { key: 'holiday', label: 'Festivo: Día de la Raza', tone: 'danger', content: 'Día de la Raza' },
    { key: 'absences', label: '2 personas descansan', tone: 'info', icon: Users, content: '2 descansan', count: 2 },
  ],
  '2026-10-20': [{ key: 'dot', label: 'Algo pasa' }],
};

/** El calendario controlado por una pantalla (el mes vive afuera, como en la pestaña de festivos). */
function Harness(props: Partial<Parameters<typeof MonthCalendar>[0]> & { start?: [number, number] }) {
  const { start = [2026, 9], ...rest } = props;
  const [view, setView] = useState(start);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <MonthCalendar
      year={view[0]}
      month={view[1]}
      onMonthChange={(year, month) => setView([year, month])}
      selected={selected}
      onSelect={setSelected}
      today="2026-10-04"
      markers={markers}
      {...rest}
    />
  );
}

const day = (name: RegExp) => screen.getByRole('button', { name });
const cell = (date: string) => document.querySelector<HTMLButtonElement>(`[data-date="${date}"]`) as HTMLButtonElement;
const focusedDate = () => (document.activeElement as HTMLElement).dataset.date;

describe('MonthCalendar', () => {
  it('6 semanas de lunes a domingo con los días vecinos atenuados, fines de semana, hoy y las marcas', () => {
    render(<Harness />);
    const grid = screen.getByRole('grid', { name: 'Octubre de 2026' });
    const headers = within(grid).getAllByRole('columnheader');
    expect(headers).toHaveLength(7);
    expect(headers[5]).toHaveClass('is-weekend');
    expect(headers[4]).not.toHaveClass('is-weekend');
    // Siempre 42 días: el 1 de octubre de 2026 es jueves (tres de septiembre antes) y termina el 8 de noviembre.
    expect(grid.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(grid.querySelectorAll('tbody td')).toHaveLength(42);
    expect(grid.querySelectorAll('tbody tr:first-child td.is-outside')).toHaveLength(3);
    expect(cell('2026-09-28').closest('td')).toHaveClass('is-outside');
    expect(cell('2026-11-08').closest('td')).toHaveClass('is-outside', 'is-weekend');
    expect(cell('2026-09-28')).toHaveAccessibleName('Lunes, 28 de septiembre de 2026');
    expect(cell('2026-09-28')).toHaveAttribute('tabindex', '-1');
    const today = day(/^Domingo, 4 de octubre de 2026\. hoy$/);
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveClass('is-today');
    // Sin día elegido, el foco de tabulador está en hoy.
    expect(today).toHaveAttribute('tabindex', '0');
    const holiday = day(/12 de octubre de 2026\. Festivo: Día de la Raza\. 2 personas descansan/);
    expect(holiday).toHaveClass('has-markers');
    expect(holiday).toHaveTextContent('12Día de la Raza2 descansan2');
    expect(holiday.querySelector('.month-cal__marker--danger')).toHaveAttribute('title', 'Festivo: Día de la Raza');
    // El conteo lleva su ícono y su cifra (la cuadrícula mediana muestra solo la cifra).
    const count = holiday.querySelector('.month-cal__marker--info') as HTMLElement;
    expect(count).toHaveClass('has-count');
    expect(count.querySelector('svg')).not.toBeNull();
    expect(count.querySelector('.month-cal__marker-count')).toHaveTextContent('2');
    expect(holiday.querySelector('.month-cal__marker--danger')).not.toHaveClass('has-count');
    // Sin tono, la marca es primaria; sin contenido, solo su color.
    expect(day(/20 de octubre de 2026\. Algo pasa/).querySelector('.month-cal__marker--primary')).toBeEmptyDOMElement();
    expect(cell('2026-10-05')).not.toHaveClass('has-markers');
  });

  it('las marcas que no caben se resumen en "+N" con sus nombres', () => {
    render(<Harness maxMarkers={1} />);
    const holiday = cell('2026-10-12');
    expect(holiday.querySelectorAll('.month-cal__marker')).toHaveLength(2);
    expect(holiday.querySelector('.month-cal__marker--more')).toHaveTextContent('+1');
    expect(holiday.querySelector('.month-cal__marker--more')).toHaveAttribute('title', '2 personas descansan');
    expect(cell('2026-10-20').querySelector('.month-cal__marker--more')).toBeNull();
  });

  it('elegir un día lo marca; un día de otro mes lleva a su mes y lo elige', async () => {
    render(<Harness />);
    await userEvent.click(day(/^Martes, 6 de octubre/));
    expect(day(/^Martes, 6 de octubre/)).toHaveClass('is-selected');
    expect(day(/^Martes, 6 de octubre/).closest('td')).toHaveAttribute('aria-selected', 'true');
    expect(cell('2026-10-07').closest('td')).toHaveAttribute('aria-selected', 'false');
    await userEvent.click(cell('2026-11-02'));
    expect(screen.getByRole('grid', { name: 'Noviembre de 2026' })).toBeInTheDocument();
    expect(cell('2026-11-02')).toHaveClass('is-selected');
    expect(cell('2026-11-02')).toHaveAttribute('tabindex', '0');
    await userEvent.click(cell('2026-10-26'));
    expect(screen.getByRole('grid', { name: 'Octubre de 2026' })).toBeInTheDocument();
    expect(cell('2026-10-26')).toHaveClass('is-selected');
  });

  it('teclado: flechas, Inicio/Fin y Re Pág/Av Pág; al salir del mes cambia de mes', async () => {
    render(<Harness />);
    day(/^Domingo, 4 de octubre/).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(focusedDate()).toBe('2026-10-05');
    await userEvent.keyboard('{ArrowDown}');
    expect(focusedDate()).toBe('2026-10-12');
    await userEvent.keyboard('{End}');
    expect(focusedDate()).toBe('2026-10-18');
    await userEvent.keyboard('{End}'); // ya es domingo: no se mueve
    expect(focusedDate()).toBe('2026-10-18');
    await userEvent.keyboard('{Home}');
    expect(focusedDate()).toBe('2026-10-12');
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}');
    expect(focusedDate()).toBe('2026-10-04');
    await userEvent.keyboard('{PageDown}');
    expect(screen.getByRole('grid', { name: 'Noviembre de 2026' })).toBeInTheDocument();
    expect(focusedDate()).toBe('2026-11-04');
    await userEvent.keyboard('{PageUp}{PageUp}');
    expect(focusedDate()).toBe('2026-09-04');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}{ArrowLeft}');
    expect(screen.getByRole('grid', { name: 'Agosto de 2026' })).toBeInTheDocument();
    expect(focusedDate()).toBe('2026-08-13');
    // Otra tecla no hace nada.
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'a' });
    expect(focusedDate()).toBe('2026-08-13');
    // Enter elige el día enfocado (es un botón).
    await userEvent.keyboard('{Enter}');
    expect(day(/^Jueves, 13 de agosto/)).toHaveClass('is-selected');
  });

  it('respeta los años permitidos (teclado y días vecinos) y acepta textos, nombre y marcas propias', async () => {
    const onMonthChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <MonthCalendar
        year={2000}
        month={0}
        onMonthChange={onMonthChange}
        onSelect={onSelect}
        years={{ from: 2000, to: 2000 }}
        today="2000-01-03"
        label="Mes de los festivos"
        labels={{ today: 'el día de hoy' }}
        markers={{ '2000-01-05': [{ key: 'x', label: 'Marca', content: 'texto' }] }}
        renderMarker={(marker, date) => `${marker.key}@${date}`}
      />,
    );
    expect(screen.getByRole('grid', { name: 'Mes de los festivos' })).toBeInTheDocument();
    expect(day(/, 3 de enero de 2000\. el día de hoy/)).toBeInTheDocument();
    expect(day(/, 5 de enero de 2000\. Marca/)).toHaveTextContent('x@2000-01-05');
    // El 27 de diciembre de 1999 se ve atenuado, pero está fuera de los años: no lleva a nada.
    await userEvent.click(cell('1999-12-27'));
    expect(onMonthChange).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    day(/, 3 de enero de 2000/).focus();
    await userEvent.keyboard('{PageUp}');
    expect(onMonthChange).not.toHaveBeenCalled();
    expect(focusedDate()).toBe('2000-01-03');
    await userEvent.click(cell('2000-02-01'));
    expect(onMonthChange).toHaveBeenCalledWith(2000, 1);
    expect(onSelect).toHaveBeenCalledWith('2000-02-01');
  });

  it('sin `onSelect` los días no dicen si están elegidos; sin `today` usa el de la zona del negocio', async () => {
    const onMonthChange = vi.fn();
    const { unmount } = render(<MonthCalendar year={2026} month={9} onMonthChange={onMonthChange} today="2026-10-04" />);
    expect(cell('2026-10-05').closest('td')).not.toHaveAttribute('aria-selected');
    await userEvent.click(cell('2026-10-05'));
    expect(onMonthChange).not.toHaveBeenCalled();
    await userEvent.click(cell('2026-11-01'));
    expect(onMonthChange).toHaveBeenCalledWith(2026, 10);
    unmount();
    // Ni hoy ni un día elegido en el mes: el foco de tabulador va a su primer día.
    const november = render(<MonthCalendar year={2026} month={10} onMonthChange={vi.fn()} today="2026-10-04" />);
    expect(cell('2026-11-01')).toHaveAttribute('tabindex', '0');
    november.unmount();
    const [year, month] = businessToday().split('-').map(Number);
    render(<MonthCalendar year={year} month={month - 1} onMonthChange={vi.fn()} className="extra" />);
    expect(document.querySelector('.month-cal.extra')).not.toBeNull();
    expect(cell(businessToday())).toHaveAttribute('aria-current', 'date');
  });
});
