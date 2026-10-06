import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { anniversary, calendarServer, christmas, first, last, vacation, workday } from '../../../components/calendar/testData';
import { ana, page } from '../../../components/employees/testData';
import { setLocale } from '../../../i18n/core';
import { pick } from '../../../test/companyPages';
import { apiOk, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { CalendarPage } from './CalendarPage';

const WHEN = { deleted_at: '2026-10-05T16:00:00Z', deleted_by: 'ana@empresa.com' };
const gone = { ...ana, deleted: true };

const renderAt = (tab: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/company/calendar" element={<CalendarPage />} />
    </Routes>,
    { route: `/company/calendar?tab=${tab}` },
  );

/** «Eliminados» de festivos y días laborables, su restauración y el resto del calendario (con o sin bajas). */
const trashServer = ({ deletedPeople = false } = {}) =>
  calendarServer((call: MockCall) => {
    if (call.url.endsWith('/restore')) return apiOk(call.url.includes('/holidays/') ? christmas : workday, { message: 'Restaurado.' });
    if (call.url.includes('deleted=true')) return apiOk(page(call.url.startsWith('/api/calendar/holidays') ? [{ ...christmas, ...WHEN }] : [{ ...workday, ...WHEN }]));
    if (!deletedPeople) return null;
    if (call.url.startsWith('/api/calendar/workdays')) return apiOk(page([{ ...workday, employee: gone }]));
    if (call.url.startsWith('/api/calendar/absences?')) return apiOk(page([{ ...vacation, employee: gone }]));
    return null;
  });

describe('Calendario: «Eliminados»', () => {
  it('festivos del año: eliminar avisa que va a «Eliminados»; el filtro los muestra y «Restaurar» los regresa', async () => {
    const { calls } = trashServer();
    renderAt('holidays');
    const year = await screen.findByRole('region', { name: /Festivos de/ });
    await within(year).findByText('Navidad');
    await userEvent.click(within(year).getByRole('button', { name: 'Eliminar el festivo Navidad' }));
    const remove = await screen.findByRole('alertdialog', { name: '¿Eliminar el festivo Navidad?' });
    expect(remove.querySelector('.confirm-note')).toHaveTextContent('Pasará a «Eliminados»: podrás restaurarlo durante 1 año.');
    await userEvent.click(within(remove).getByRole('button', { name: 'Cancelar' }));

    await pick(/Filtrar por estado/, /^Eliminados$/);
    await waitFor(() => expect(calls.some((call) => call.url.startsWith('/api/calendar/holidays?page=1&size=10&year=') && call.url.endsWith('deleted=true'))).toBe(true));
    const row = (await within(year).findByRole('cell', { name: /Se eliminó el/ })).closest('tr') as HTMLElement;
    expect(within(year).queryByText(anniversary.name)).toBeNull();
    await userEvent.click(within(row).getByRole('button', { name: 'Restaurar Navidad' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar el festivo Navidad?' });
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('OrigenOficial');
    const before = calls.length;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: 'Restaurado.' })).toBeInTheDocument();
    expect(calls[before]).toMatchObject({ url: '/api/calendar/holidays/1/restore', init: { method: 'POST' } });
    // Se vuelven a pedir el mes y la lista del año.
    await waitFor(() => expect(calls.slice(before + 1).some((call) => call.url.includes('deleted=true'))).toBe(true));
  });

  it('días laborables: eliminar avisa que va a «Eliminados»; el filtro, la tarjeta y «Restaurar»', async () => {
    const { calls } = trashServer();
    renderAt('workdays');
    await screen.findByText(/Cubre la guardia/);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar el día laborable de Ana Ruiz' }));
    const remove = await screen.findByRole('alertdialog', { name: '¿Eliminar el día laborable de Ana Ruiz?' });
    expect(remove.querySelector('.confirm-note')).toHaveTextContent('Pasará a «Eliminados»');
    await userEvent.click(within(remove).getByRole('button', { name: 'Cancelar' }));

    await pick(/Filtrar por estado/, /^Eliminados$/);
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/calendar/workdays?page=1&size=10&deleted=true'));
    expect(await screen.findByText(/Se eliminó el .* por ana@empresa\.com/)).toBeInTheDocument();
    expect(screen.queryByText('Trabaja')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar Ana Ruiz' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar el día laborable de Ana Ruiz?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: 'Restaurado.' })).toBeInTheDocument();
    expect(calls.some((call) => call.url === '/api/calendar/workdays/20/restore')).toBe(true);
  });

  it('sin días laborables eliminados: «Nada eliminado»', async () => {
    calendarServer((call) => (call.url.includes('deleted=true') ? apiOk(page([])) : null));
    renderAt('workdays');
    await screen.findByText(/Cubre la guardia/);
    await pick(/Filtrar por estado/, /^Eliminados$/);
    expect(await screen.findByText('Nada eliminado')).toBeInTheDocument();
  });

  it('un empleado eliminado lleva su marca en ausencias, días laborables y el detalle del día', async () => {
    trashServer({ deletedPeople: true });
    const { unmount } = renderAt('absences');
    const absence = (await screen.findByText('Viaje familiar', { exact: false })).closest('li') as HTMLElement;
    expect(within(absence).getByText('Eliminado')).toHaveClass('deleted-mark');
    unmount();

    renderAt('holidays');
    await userEvent.click(await waitFor(() => document.querySelector(`[data-date="${first}"]`) as HTMLButtonElement));
    const day = document.querySelector('.cal-day') as HTMLElement;
    await waitFor(() => expect(within(day).getAllByText('Eliminado')).toHaveLength(1));
    await userEvent.click(document.querySelector(`[data-date="${last}"]`) as HTMLButtonElement);
    await waitFor(() => expect(within(document.querySelector('.cal-day') as HTMLElement).getByText('Cubre la guardia')).toBeInTheDocument());
    expect(within(document.querySelector('.cal-day') as HTMLElement).getByText('Eliminado')).toBeInTheDocument();
  });

  it('en inglés: la opción del filtro y la fila', async () => {
    await setLocale('en-US');
    trashServer();
    renderAt('workdays');
    await screen.findByText(/Cubre la guardia/);
    await pick(/Filter by status/, /^Deleted$/);
    expect(await screen.findByText(/Deleted .* by ana@empresa\.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Ana Ruiz' })).toBeInTheDocument();
  });
});
