import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { businessToday } from '../../utils/format';
import { MonthCalendar, type CalendarMarker } from './MonthCalendar';

const markers: Record<string, CalendarMarker[]> = {
  '2026-10-12': [
    { key: 'holiday', label: 'Festivo: Día de la Raza', tone: 'danger', content: 'Día de la Raza' },
    { key: 'absences', label: '2 personas descansan', tone: 'info', content: 2 },
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
const focusedDate = () => (document.activeElement as HTMLElement).dataset.date;

describe('MonthCalendar', () => {
  it('dibuja el mes de lunes a domingo, hoy resaltado y las marcas con su nombre accesible', () => {
    render(<Harness />);
    const grid = screen.getByRole('grid', { name: 'Octubre de 2026' });
    expect(within(grid).getAllByRole('columnheader')).toHaveLength(7);
    // El 1 de octubre de 2026 es jueves: tres celdas vacías antes.
    expect(grid.querySelectorAll('tbody tr:first-child td.is-outside')).toHaveLength(3);
    const today = day(/^Domingo, 4 de octubre de 2026\. hoy$/);
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveClass('is-today');
    // Sin día elegido, el foco de tabulador está en hoy.
    expect(today).toHaveAttribute('tabindex', '0');
    const holiday = day(/12 de octubre de 2026\. Festivo: Día de la Raza\. 2 personas descansan/);
    expect(holiday).toHaveClass('has-markers');
    expect(holiday).toHaveTextContent('12Día de la Raza2');
    expect(holiday.querySelector('.month-cal__marker--danger')).toHaveAttribute('title', 'Festivo: Día de la Raza');
    // Sin tono, la marca es primaria; sin contenido, un punto.
    expect(day(/20 de octubre de 2026\. Algo pasa/).querySelector('.month-cal__marker--primary')).toBeEmptyDOMElement();
  });

  it('elegir un día lo marca y cambiar de mes con los botones no mueve el foco', async () => {
    render(<Harness />);
    await userEvent.click(day(/^Martes, 6 de octubre/));
    expect(day(/^Martes, 6 de octubre/)).toHaveClass('is-selected');
    expect(day(/^Martes, 6 de octubre/).closest('td')).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByRole('grid', { name: 'Noviembre de 2026' })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mes siguiente' }));
    // Ni el elegido ni hoy están en noviembre: el foco de tabulador va al primero del mes.
    expect(day(/^Domingo, 1 de noviembre/)).toHaveAttribute('tabindex', '0');
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('grid', { name: 'Septiembre de 2026' })).toBeInTheDocument();
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

  it('respeta los años permitidos (botones y teclado) y acepta textos y marcas propias', async () => {
    const onMonthChange = vi.fn();
    render(
      <MonthCalendar
        year={2000}
        month={0}
        onMonthChange={onMonthChange}
        years={{ from: 2000, to: 2000 }}
        today="2000-01-03"
        labels={{ previous: 'Antes', next: 'Después', today: 'el día de hoy' }}
        markers={{ '2000-01-05': [{ key: 'x', label: 'Marca', content: 'texto' }] }}
        renderMarker={(marker, date) => `${marker.key}@${date}`}
      />,
    );
    expect(screen.getByRole('button', { name: 'Antes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Después' })).toBeEnabled();
    expect(day(/, 3 de enero de 2000\. el día de hoy/)).toBeInTheDocument();
    expect(day(/, 5 de enero de 2000\. Marca/)).toHaveTextContent('x@2000-01-05');
    // Sin `onSelect` las celdas no dicen si están elegidas.
    expect(day(/, 5 de enero de 2000/).closest('td')).not.toHaveAttribute('aria-selected');
    day(/, 3 de enero de 2000/).focus();
    await userEvent.keyboard('{PageUp}');
    expect(onMonthChange).not.toHaveBeenCalled();
    expect(focusedDate()).toBe('2000-01-03');
    await userEvent.click(screen.getByRole('button', { name: 'Después' }));
    expect(onMonthChange).toHaveBeenCalledWith(2000, 1);
  });

  it('en diciembre del último año no avanza; sin `today` usa el de la zona del negocio', () => {
    const { unmount } = render(<MonthCalendar year={2100} month={11} onMonthChange={vi.fn()} years={{ from: 2000, to: 2100 }} today="2026-10-04" />);
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeEnabled();
    unmount();
    const [year, month] = businessToday().split('-').map(Number);
    render(<MonthCalendar year={year} month={month - 1} onMonthChange={vi.fn()} className="extra" />);
    expect(document.querySelector('.month-cal.extra')).not.toBeNull();
    expect(document.querySelector(`[data-date="${businessToday()}"]`)).toHaveAttribute('aria-current', 'date');
  });
});
