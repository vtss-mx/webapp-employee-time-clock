import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { longDate, monthBounds, monthTitle } from '../../../components/calendar/calendarRules';
import { anniversary, calendarServer, christmas, first, last, monthIndex, third, today, vacation, year } from '../../../components/calendar/testData';
import { page } from '../../../components/employees/testData';
import { apiFail, apiOk, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { formatDate } from '../../../utils/format';
import { CalendarPage } from './CalendarPage';

afterEach(() => {
  window.history.replaceState(null, '');
});

/** Dónde está la pantalla (ruta y `?tab=`). */
function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderAt(route: string) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/company/calendar" element={<CalendarPage />} />
        <Route path="/company/calendar/holidays/new" element={<p>Nuevo festivo</p>} />
      </Routes>
      <Where />
    </>,
    { route },
  );
}

const cell = (date: string) => document.querySelector<HTMLButtonElement>(`[data-date="${date}"]`) as HTMLButtonElement;
const listUrl = (forYear: number) => `/api/calendar/holidays?page=1&size=10&year=${forYear}`;
const monthUrl = (forYear: number, month: number) => {
  const { start, end } = monthBounds(forYear, month);
  return `/api/calendar/absences?status=APPROVED&start=${start}&end=${end}&page=1&size=50`;
};
const count = (calls: MockCall[], url: string) => calls.filter((call) => call.url === url).length;
const detail = () => document.querySelector('.cal-day') as HTMLElement;

describe('Calendario: pestañas', () => {
  it('abre en festivos, cambia de pestaña con la URL y muestra cuántas solicitudes faltan por decidir', async () => {
    calendarServer();
    renderAt('/company/calendar');
    expect(screen.getByRole('heading', { name: 'Calendario' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Solicitudes, 1 por decidir' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Días festivos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Días festivos' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Ausencias' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/company/calendar?tab=absences');
    expect(await screen.findByRole('link', { name: 'Registrar ausencia' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByTestId('where')).toHaveTextContent('/company/calendar?tab=requests');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByTestId('where')).toHaveTextContent('/company/calendar?tab=workdays');
    expect(await screen.findByRole('link', { name: 'Agregar día laborable' })).toBeInTheDocument();
    await userEvent.keyboard('{Home}');
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/company\/calendar$/);
  });

  it('una pestaña desconocida abre los festivos; si no se puede contar, lo explica sin contador', async () => {
    calendarServer((call) => (call.url.endsWith('/summary') ? apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada') : null));
    renderAt('/company/calendar?tab=otra');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron contar las solicitudes pendientes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Solicitudes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Días festivos' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Calendario: días festivos', () => {
  it('el mes con sus marcas, el detalle del día elegido y la lista del año', async () => {
    const { calls } = calendarServer();
    renderAt('/company/calendar');
    expect(screen.getByRole('grid', { name: monthTitle(year, monthIndex) })).toBeInTheDocument();
    expect(cell(today)).toHaveAttribute('aria-current', 'date');
    await waitFor(() => expect(cell(first)).toHaveAccessibleName(`${longDate(first)}${first === today ? '. hoy' : ''}. Festivo: Aniversario. 1 persona descansa`));
    expect(cell(third).getAttribute('aria-label')).toMatch(/1 persona descansa$/);
    expect(calls.map((call) => call.url)).toEqual(expect.arrayContaining([listUrl(year), `/api/calendar/holidays?year=${year}&page=1&size=50`, monthUrl(year, monthIndex)]));

    // Lista del año: oficial o de la empresa, con su fecha completa.
    const item = (await screen.findByRole('button', { name: 'Eliminar el festivo Navidad' })).closest('li') as HTMLElement;
    expect(item).toHaveTextContent('25');
    expect(item).toHaveTextContent(longDate(christmas.holiday_date));
    expect(within(item).getByText('Oficial')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Eliminar el festivo Aniversario' }).closest('li') as HTMLElement).getByText('De la empresa')).toBeInTheDocument();

    // El día del festivo: quién descansa y que es de la empresa.
    await userEvent.click(cell(first));
    expect(within(detail()).getByRole('heading')).toHaveTextContent(longDate(first));
    expect(within(detail()).getByText('Aniversario')).toBeInTheDocument();
    expect(within(detail()).getByText('De la empresa')).toBeInTheDocument();
    expect(within(detail()).getByRole('list', { name: 'Descansan este día' })).toHaveTextContent(`Ana RuizVacaciones · ${formatDate(first)} al ${formatDate(third)}`);
    expect(within(detail()).queryByRole('link')).toBeNull();

    // El último día del mes (nunca pasado): ni festivo ni ausencias, y se puede hacer festivo.
    await userEvent.click(cell(last));
    expect(within(detail()).getByText('No es día festivo.')).toBeInTheDocument();
    expect(within(detail()).getByText('Nadie tiene vacaciones, permiso ni incapacidad este día.')).toBeInTheDocument();
    await userEvent.click(within(detail()).getByRole('link', { name: 'Hacer festivo este día' }));
    expect(screen.getByTestId('where')).toHaveTextContent(`/company/calendar/holidays/new?date=${last}`);
  });

  it('cambia de año y de mes (con los límites del backend) y pide solo lo de ese periodo', async () => {
    const { calls } = calendarServer();
    renderAt('/company/calendar');
    await screen.findByRole('button', { name: 'Eliminar el festivo Navidad' });
    await userEvent.click(screen.getByRole('button', { name: 'Año siguiente' }));
    expect(screen.getByRole('grid', { name: monthTitle(year + 1, monthIndex) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Agregar festivos oficiales de ${year + 1}` })).toBeInTheDocument();
    await waitFor(() => expect(count(calls, listUrl(year + 1))).toBe(1));
    expect(count(calls, monthUrl(year + 1, monthIndex))).toBe(1);
    // En otro mes se elige su primer día.
    expect(within(detail()).getByRole('heading')).toHaveTextContent(longDate(monthBounds(year + 1, monthIndex).start));

    await userEvent.click(screen.getByRole('button', { name: 'Año anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    const next = new Date(year, monthIndex + 1, 1);
    expect(screen.getByRole('grid', { name: monthTitle(next.getFullYear(), next.getMonth()) })).toBeInTheDocument();
    await waitFor(() => expect(count(calls, monthUrl(next.getFullYear(), next.getMonth()))).toBe(1));
    // De vuelta en el mes de hoy, se elige hoy.
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(within(detail()).getByRole('heading')).toHaveTextContent(longDate(today));
    expect(within(detail()).getByText('Hoy')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Agregar día festivo' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/company/calendar/holidays/new');
  });

  it('respeta los años que acepta el backend (2000 – 2100)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      calendarServer();
      vi.setSystemTime(new Date('2100-06-15T18:00:00Z'));
      const { unmount } = renderAt('/company/calendar');
      expect(screen.getByRole('button', { name: 'Año siguiente' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Año anterior' })).toBeEnabled();
      unmount();
      vi.setSystemTime(new Date('2000-06-15T18:00:00Z'));
      renderAt('/company/calendar');
      expect(screen.getByRole('button', { name: 'Año anterior' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Año siguiente' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sin festivos lo explica; si hay más ausencias de las que cuenta, lo dice; un festivo oficial', async () => {
    const official = { ...christmas, id: 3, holiday_date: today, name: 'Día oficial' };
    calendarServer((call) => {
      if (call.url.startsWith('/api/calendar/holidays?page')) return apiOk(page([]));
      if (call.url.startsWith('/api/calendar/holidays')) return apiOk(page([official]));
      if (call.url.includes('status=APPROVED')) return apiOk(page([vacation, { ...vacation, id: 13 }], 60));
      return null;
    });
    renderAt('/company/calendar');
    expect(await screen.findByText(`Aún no hay festivos en ${year}`)).toBeInTheDocument();
    expect(await within(detail()).findByText('Día oficial')).toBeInTheDocument();
    expect(within(detail()).getByText('Oficial')).toBeInTheDocument();
    expect(within(detail()).getByText('Hoy')).toBeInTheDocument();
    expect(within(detail()).getByText(/cuenta las primeras 50 de 60 ausencias del mes/)).toBeInTheDocument();
    expect(cell(first).getAttribute('aria-label')).toMatch(/2 personas descansan$/);
  });

  it('agrega los festivos oficiales del año: pregunta antes; nombra los agregados o dice que ya estaban', async () => {
    let posts = 0;
    const newYear = { ...christmas, id: 4, holiday_date: `${year}-01-01`, name: 'Año Nuevo' };
    const { calls } = calendarServer((call) => {
      if (!call.url.startsWith('/api/calendar/holidays/official')) return null;
      posts += 1;
      if (posts === 1) return apiOk({ year, added: [christmas], existing: 7 });
      if (posts === 2) return apiOk({ year, added: [christmas, newYear], existing: 0 });
      if (posts === 3) return apiOk({ year, added: [], existing: 8 });
      return apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada');
    });
    renderAt('/company/calendar');
    await screen.findByRole('button', { name: 'Eliminar el festivo Navidad' });
    const add = screen.getByRole('button', { name: `Agregar festivos oficiales de ${year}` });
    const question = `¿Agregar los festivos oficiales de ${year}?`;
    /** Pide agregarlos y confirma la pregunta. */
    const addOfficial = async () => {
      await userEvent.click(add);
      await userEvent.click(within(await screen.findByRole('dialog', { name: question })).getByRole('button', { name: 'Agregar festivos' }));
    };

    // Antes de enviar dice qué hará; cancelar no envía nada, no deja el botón ocupado ni avisa nada.
    await userEvent.click(add);
    const confirm = await screen.findByRole('dialog', { name: question });
    expect(confirm).toHaveTextContent(`Se agregan los días de descanso obligatorio de ${year} (Ley Federal del Trabajo, art. 74) que aún no estén en tu calendario.`);
    expect(within(confirm).getByRole('region', { name: 'Detalles' })).toHaveTextContent(
      'Los que ya están en tu calendario se respetan.Al terminar verás cada fecha que se agregó; cualquiera se puede eliminar después.',
    );
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posts).toBe(0);
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false);
    expect(add).toBeEnabled();
    expect(add).not.toHaveAttribute('aria-busy');
    expect(count(calls, listUrl(year))).toBe(1);

    await addOfficial();
    const one = await screen.findByRole('dialog', { name: 'Se agregó 1 festivo oficial' });
    expect(one).toHaveTextContent(`${formatDate(christmas.holiday_date)} · Navidad`);
    expect(one).toHaveTextContent('7 ya estaban en tu calendario y se respetaron.');
    expect(calls.find((call) => call.init.method === 'POST')?.url).toBe(`/api/calendar/holidays/official?year=${year}`);
    await waitFor(() => expect(count(calls, listUrl(year))).toBe(2));
    await userEvent.click(within(one).getByRole('button', { name: 'Entendido' }));

    await addOfficial();
    const two = await screen.findByRole('dialog', { name: 'Se agregaron 2 festivos oficiales' });
    expect(two).toHaveTextContent('Año Nuevo');
    expect(two).not.toHaveTextContent('ya estaban');
    await userEvent.click(within(two).getByRole('button', { name: 'Entendido' }));

    await addOfficial();
    const none = await screen.findByRole('dialog', { name: 'Ya estaban todos' });
    expect(none).toHaveTextContent(`Los 8 festivos oficiales de ${year} ya estaban en tu calendario: no se agregó nada.`);
    await userEvent.click(within(none).getByRole('button', { name: 'Entendido' }));

    await addOfficial();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron agregar los festivos oficiales' })).toHaveTextContent('Falla inesperada');
    expect(posts).toBe(4);
  });

  it('elimina un festivo y recarga; si ya no existía también recarga; otra falla solo se explica', async () => {
    let deletes = 0;
    const { calls } = calendarServer((call) => {
      if (call.init.method !== 'DELETE') return null;
      deletes += 1;
      if (deletes === 1) return apiOk(null);
      return deletes === 2 ? apiFail(404, 'HOLIDAY_NOT_FOUND', 'Día festivo no encontrado') : apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada');
    });
    renderAt('/company/calendar');
    const remove = await screen.findByRole('button', { name: 'Eliminar el festivo Aniversario' });
    /** Pide eliminar el Aniversario y confirma la pregunta. */
    const removeAnniversary = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Eliminar el festivo Aniversario' }));
      await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Eliminar el festivo Aniversario?' })).getByRole('button', { name: 'Eliminar' }));
    };

    // Un festivo oficial: la pregunta dice su fecha y su origen; cancelar no envía nada ni lo quita.
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar el festivo Navidad' }));
    const official = await screen.findByRole('alertdialog', { name: '¿Eliminar el festivo Navidad?' });
    expect(official).toHaveTextContent('Ese día vuelve a ser laborable: quien tenga turno tendrá que checar.');
    expect(within(official).getByRole('region', { name: 'Detalles' })).toHaveTextContent(`Fecha${longDate(christmas.holiday_date)}OrigenOficial (Ley Federal del Trabajo)`);
    expect(within(official).getByRole('button', { name: 'Cancelar' })).toHaveFocus(); // lo seguro primero
    await userEvent.click(within(official).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deletes).toBe(0);
    expect(count(calls, listUrl(year))).toBe(1);
    expect(screen.getByRole('button', { name: 'Eliminar el festivo Navidad' })).toBeEnabled();
    expect(remove).toBeEnabled();

    // Uno de la empresa.
    await userEvent.click(remove);
    const question = await screen.findByRole('alertdialog', { name: '¿Eliminar el festivo Aniversario?' });
    expect(within(question).getByRole('region', { name: 'Detalles' })).toHaveTextContent(`Fecha${longDate(anniversary.holiday_date)}OrigenDe la empresa`);
    await userEvent.click(within(question).getByRole('button', { name: 'Eliminar' }));
    const done = await screen.findByRole('dialog', { name: 'Día festivo eliminado' });
    expect(done).toHaveTextContent(`Aniversario (${formatDate(anniversary.holiday_date)}) vuelve a ser un día laborable.`);
    expect(calls.find((call) => call.init.method === 'DELETE')?.url).toBe('/api/calendar/holidays/2');
    await waitFor(() => expect(count(calls, listUrl(year))).toBe(2));
    await userEvent.click(within(done).getByRole('button', { name: 'Entendido' }));

    await removeAnniversary();
    const gone = await screen.findByRole('alertdialog', { name: 'No se pudo eliminar el día festivo' });
    expect(gone).toHaveTextContent('Día festivo no encontrado');
    await waitFor(() => expect(count(calls, listUrl(year))).toBe(3));
    await userEvent.click(within(gone).getByRole('button', { name: 'Entendido' }));

    await removeAnniversary();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar el día festivo' })).toHaveTextContent('Falla inesperada');
    expect(count(calls, listUrl(year))).toBe(3);
  });
});
