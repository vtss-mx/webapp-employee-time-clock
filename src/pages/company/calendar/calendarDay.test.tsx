import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { anniversary, calendarServer, first, last, vacation, workday, year } from '../../../components/calendar/testData';
import { ana, page } from '../../../components/employees/testData';
import { apiFail, apiOk, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { formatDate } from '../../../utils/format';
import { CalendarPage } from './CalendarPage';

/** El detalle del día elegido en el calendario: quitar el festivo, la lista de quién descansa y sus fallas. */
const renderAt = (route: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/company/calendar" element={<CalendarPage />} />
    </Routes>,
    { route },
  );
const detail = () => document.querySelector('.cal-day') as HTMLElement;
const monthHolidays = (calls: MockCall[]) => calls.filter((call) => call.url === `/api/calendar/holidays?year=${year}&page=1&size=50`).length;

describe('Calendario: detalle del día', () => {
  it('quita el festivo del día: pregunta antes (cancelar no envía nada), elimina y vuelve a pedir el mes', async () => {
    const { calls } = calendarServer();
    renderAt(`/company/calendar?date=${first}`);
    const remove = await within(detail()).findByRole('button', { name: 'Quitar festivo' });
    expect(monthHolidays(calls)).toBe(1);

    await userEvent.click(remove);
    const question = await screen.findByRole('alertdialog', { name: '¿Eliminar el festivo Aniversario?' });
    expect(within(question).getByRole('region', { name: 'Detalles' })).toHaveTextContent('OrigenDe la empresa');
    await userEvent.click(within(question).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((call) => call.init.method === 'DELETE')).toBe(false);
    expect(remove).toBeEnabled();

    await userEvent.click(remove);
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Eliminar el festivo Aniversario?' })).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('dialog', { name: 'Día festivo eliminado' })).toHaveTextContent(`Aniversario (${formatDate(anniversary.holiday_date)}) vuelve a ser un día laborable.`);
    expect(calls.find((call) => call.init.method === 'DELETE')?.url).toBe('/api/calendar/holidays/2');
    await waitFor(() => expect(monthHolidays(calls)).toBe(2));
  });

  it('muestra las primeras 5 personas que descansan y "Ver todos (N)" / "Ver menos"', async () => {
    const people = Array.from({ length: 6 }, (_, index) => ({ ...vacation, id: 30 + index, employee: { ...ana, id: 30 + index, full_name: `Persona ${index + 1}` } }));
    calendarServer((call) => {
      if (call.url.includes('status=APPROVED')) return apiOk(page(people));
      // Un día laborable sin nota: se ve el número del empleado.
      return call.url.startsWith('/api/calendar/workdays') ? apiOk(page([{ ...workday, note: null }])) : null;
    });
    renderAt(`/company/calendar?date=${first}`);
    const list = await within(detail()).findByRole('list', { name: 'Descansan este día' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(detail().querySelector('.cal-day__count')).toHaveTextContent('6');
    const more = within(detail()).getByRole('button', { name: 'Ver todos (6)' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(within(list).getByText('Persona 6')).toBeInTheDocument();
    await userEvent.click(within(detail()).getByRole('button', { name: 'Ver menos' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    // Otro día empieza con la lista corta de nuevo.
    await userEvent.click(document.querySelector(`[data-date="${last}"]`) as HTMLElement);
    expect(within(detail()).queryByRole('button', { name: /^Ver todos/ })).toBeNull();
    expect(within(detail()).getByRole('list', { name: 'Trabajan este día' })).toHaveTextContent('Ana RuizEMP-7Trabaja');
  });

  it('si no cargan los días laborables del mes, lo dice; el resto del calendario sigue', async () => {
    calendarServer((call) => (call.url.startsWith('/api/calendar/workdays') ? apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada') : null));
    renderAt('/company/calendar');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los días laborables del mes' })).toHaveTextContent('Falla inesperada');
    expect(await screen.findByRole('button', { name: 'Eliminar el festivo Navidad' })).toBeInTheDocument();
  });
});
