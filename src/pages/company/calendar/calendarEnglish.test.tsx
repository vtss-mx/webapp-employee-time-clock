import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { daysText, isWeekend, longDate, monthTitle, rangeError, rangeText, weekdayName } from '../../../components/calendar/calendarRules';
import { calendarServer, christmas, first, last, monthIndex, request, today, vacation, workday, year } from '../../../components/calendar/testData';
import { pickerServer } from '../../../components/employees/testData';
import { setLocale } from '../../../i18n/core';
import { apiFail, apiOk, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { formatDate } from '../../../utils/format';
import { AbsenceFormPage } from './AbsenceFormPage';
import { AbsenceRejectPage } from './AbsenceRejectPage';
import { CalendarPage } from './CalendarPage';
import { HolidayFormPage } from './HolidayFormPage';
import { WorkdayFormPage } from './WorkdayFormPage';

const renderCalendar = (route = '/company/calendar') =>
  renderWithProviders(
    <Routes>
      <Route path="/company/calendar" element={<CalendarPage />} />
    </Routes>,
    { route },
  );
const cell = (date: string) => document.querySelector<HTMLButtonElement>(`[data-date="${date}"]`) as HTMLButtonElement;
const detail = () => document.querySelector('.cal-day') as HTMLElement;
/** Una falla con su propio código (los popups de carga con el mismo código se muestran una sola vez). */
const fail = (code = 'LOAD_FAILED') => apiFail(422, code, 'It failed');
/** Cada consulta de la pestaña de festivos falla con su código. */
function failingHolidays(call: MockCall): Response | null {
  if (call.url.startsWith('/api/calendar/holidays?page')) return fail('LIST_FAILED');
  if (call.url.startsWith('/api/calendar/holidays?year')) return fail('MONTH_HOLIDAYS_FAILED');
  if (call.url.startsWith('/api/calendar/workdays')) return fail('MONTH_WORKDAYS_FAILED');
  return call.url.includes('status=APPROVED') ? fail('MONTH_ABSENCES_FAILED') : null;
}

/** Cierra uno a uno los popups de error en cola y devuelve sus títulos. */
async function errorTitles(expected: number): Promise<string[]> {
  const titles: string[] = [];
  for (let i = 0; i < expected; i += 1) {
    const popup = await screen.findByRole('alertdialog');
    titles.push(document.getElementById(popup.getAttribute('aria-labelledby') ?? '')?.textContent ?? '');
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: titles[i] })).toBeNull());
  }
  return titles;
}

describe('Calendario en inglés (en-US)', () => {
  it('la cuadrícula del mes: semana de lunes a domingo, nombres del idioma y marcas del día', async () => {
    await setLocale('en-US');
    calendarServer();
    renderCalendar();
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();
    expect(monthTitle(2026, 9)).toBe('October 2026');
    expect(longDate('2026-10-12')).toBe('Monday, October 12, 2026');
    const grid = screen.getByRole('grid', { name: monthTitle(year, monthIndex) });
    const headers = within(grid).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(headers[0]).toHaveAttribute('abbr', 'Monday');
    expect(cell(today).getAttribute('aria-label')).toContain('. today');
    await waitFor(() => expect(cell(first).getAttribute('aria-label')).toMatch(/\. Holiday: Aniversario\. 1 person off$/));
    await waitFor(() => expect(cell(last).getAttribute('aria-label')).toMatch(/\. 1 person working their day off$/));
    expect(cell(first).querySelector('.month-cal__marker--info')).toHaveTextContent('1 off');
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
    expect(document.querySelector('.cal-period__title')).toHaveAccessibleName(`${monthTitle(year, monthIndex).split(' ')[0]} ${year}`);
    expect(document.querySelector('.month-cal__legend')).toHaveTextContent('HolidayOffWorking');
    expect(screen.getByRole('tab', { name: 'Holidays' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Add holiday' })).toBeInTheDocument();

    // El detalle del día y la tabla del año.
    await userEvent.click(cell(first));
    expect(within(detail()).getByText('Holiday', { selector: '.badge' })).toBeInTheDocument();
    expect(within(detail()).getByText('Company')).toBeInTheDocument();
    expect(within(detail()).getByRole('list', { name: 'Off this day' })).toHaveTextContent(`Ana Ruiz${formatDate(first)} to ${formatDate(vacation.ends_on)}Vacaciones`);
    expect(within(detail()).getByRole('button', { name: 'Remove holiday' })).toBeInTheDocument();
    expect(within(detail()).getByRole('link', { name: 'Record absence' })).toBeInTheDocument();
    await userEvent.click(cell(last));
    expect(within(detail()).getByText(isWeekend(last) ? 'Weekend' : 'Workday')).toBeInTheDocument();
    expect(within(detail()).getByText('No absences this day')).toBeInTheDocument();
    expect(within(detail()).getByRole('list', { name: 'Working this day' })).toHaveTextContent('Ana RuizCubre la guardiaWorks');
    expect(within(detail()).getByRole('link', { name: 'Mark as holiday' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: `Holidays in ${year}` })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Date', 'Day', 'Name', 'Type', 'Actions']);
    const row = (await screen.findByRole('button', { name: 'Delete the Navidad holiday' })).closest('tr') as HTMLElement;
    expect(within(row).getByText('Official')).toBeInTheDocument();
    expect(row).toHaveTextContent(`${formatDate(christmas.holiday_date)}${weekdayName(christmas.holiday_date)}Navidad`);
  });

  it('festivos oficiales: la pregunta y el aviso siguen un cambio de idioma en caliente', async () => {
    await setLocale('en-US');
    calendarServer((call) => (call.url.startsWith('/api/calendar/holidays/official') ? apiOk({ year, added: [christmas], existing: 1 }) : null));
    renderCalendar();
    await screen.findByRole('button', { name: 'Delete the Navidad holiday' });
    await userEvent.click(screen.getByRole('button', { name: `Add official holidays for ${year}` }));
    const english = await screen.findByRole('dialog', { name: `Add the official holidays for ${year}?` });
    expect(english).toHaveTextContent('Holidays already in your calendar are kept.');

    await act(() => setLocale('es-MX'));
    const spanish = await screen.findByRole('dialog', { name: `¿Agregar los festivos oficiales de ${year}?` });
    await userEvent.click(within(spanish).getByRole('button', { name: 'Agregar festivos' }));
    const done = await screen.findByRole('dialog', { name: 'Se agregó 1 festivo oficial' });
    expect(done).toHaveTextContent('1 ya estaba en tu calendario y se respetó.');

    await act(() => setLocale('en-US'));
    const added = await screen.findByRole('dialog', { name: '1 official holiday added' });
    expect(added).toHaveTextContent(`Statutory rest days for ${year} (Federal Labor Law, art. 74):`);
    expect(added).toHaveTextContent(`${formatDate(christmas.holiday_date)} · Navidad`);
    expect(added).toHaveTextContent('1 was already in your calendar and was kept.');
  });

  it('si las listas no cargan, cada popup lo dice en inglés', async () => {
    await setLocale('en-US');
    calendarServer(failingHolidays);
    const { unmount } = renderCalendar();
    expect((await errorTitles(4)).sort()).toEqual(["Couldn't load the calendar holidays", "Couldn't load the holidays", "Couldn't load the month's absences", "Couldn't load the month's workdays"]);
    unmount();
    calendarServer((call) => (call.url.endsWith('/summary') ? null : fail()));
    for (const [tab, title] of [
      ['absences', "Couldn't load the absences"],
      ['requests', "Couldn't load the requests"],
      ['workdays', "Couldn't load the workdays"],
    ]) {
      const view = renderCalendar(`/company/calendar?tab=${tab}`);
      expect(await screen.findByRole('alertdialog', { name: title })).toBeInTheDocument();
      view.unmount();
    }
  });

  it('pestañas de ausencias, solicitudes y días laborables', async () => {
    await setLocale('en-US');
    calendarServer((call) => (call.init.method === 'POST' ? apiOk({ ...request, status: 'APPROVED' }) : null));
    const absences = renderCalendar('/company/calendar?tab=absences');
    expect(await screen.findByRole('button', { name: "Cancel Ana Ruiz's absence" })).toBeInTheDocument();
    expect(screen.getByText('Recorded by the company')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record absence' })).toBeInTheDocument();
    absences.unmount();

    const requests = renderCalendar('/company/calendar?tab=requests');
    expect(await screen.findByRole('button', { name: "Approve Ana Ruiz's request" })).toBeInTheDocument();
    expect(screen.getByText(/^Requested by the employee /)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Approve Ana Ruiz's request" }));
    const approve = await screen.findByRole('dialog', { name: 'Approve permiso for Ana Ruiz?' });
    expect(approve).toHaveTextContent(`${formatDate(request.starts_on)} · 1 day`);
    await userEvent.click(within(approve).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('dialog', { name: 'Request approved' })).toHaveTextContent(`Ana Ruiz doesn't have to check in: ${formatDate(request.starts_on)}.`);
    requests.unmount();

    renderCalendar('/company/calendar?tab=workdays');
    expect(await screen.findByText('Works')).toBeInTheDocument();
    expect(screen.getByText(longDate(workday.work_date))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Delete Ana Ruiz's workday" })).toBeInTheDocument();
  });

  it('textos de las reglas del calendario', async () => {
    await setLocale('en-US');
    expect(daysText(1)).toBe('1 day');
    expect(daysText(366)).toBe('366 days');
    expect(rangeText('2026-10-01', '2026-10-05')).toBe(`${formatDate('2026-10-01')} to ${formatDate('2026-10-05')}`);
    expect(rangeError('2026-10-02', '2026-10-01')).toBe("The end date can't be before the start date");
    expect(rangeError('2026-01-01', '2027-01-02')).toBe('An absence can last at most 366 days');
  });
});

describe('Formularios del calendario en inglés', () => {
  it('registrar una ausencia: se llena en español, el idioma cambia sin perder lo escrito y se confirma en inglés', async () => {
    const { calls } = pickerServer();
    renderWithProviders(<AbsenceFormPage />, { route: '/company/calendar/absences/new' });
    await userEvent.click(await screen.findByRole('checkbox', { name: /Ana Ruiz/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Beto Díaz/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Tipo/ }));
    await userEvent.click(screen.getByRole('option', { name: /Incapacidad/ }));
    await userEvent.type(screen.getByLabelText('Primer día'), '05102026');
    await userEvent.type(screen.getByLabelText('Último día'), '09102026');

    await act(() => setLocale('en-US'));
    expect(screen.getByRole('heading', { name: 'Record absence' })).toBeInTheDocument();
    expect(screen.getByText('5 days, both included')).toBeInTheDocument();
    expect(screen.getByLabelText('First day')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record absence' }));
    const confirm = await screen.findByRole('dialog', { name: 'Record incapacidad for 2 employees?' });
    expect(confirm).toHaveTextContent('Group absence');
    expect(confirm).toHaveTextContent(`${formatDate('2026-10-05')} to ${formatDate('2026-10-09')} · 5 days`);
    expect(confirm).toHaveTextContent("It's approved right away");

    // Abierta, vuelve a español al instante; cancelar no envía nada.
    await act(() => setLocale('es-MX'));
    const spanish = await screen.findByRole('dialog', { name: '¿Registrar incapacidad a 2 empleados?' });
    expect(spanish).toHaveTextContent(`${formatDate('2026-10-05')} al ${formatDate('2026-10-09')} · 5 días`);
    await userEvent.click(within(spanish).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((call: MockCall) => call.init.method === 'POST')).toBe(false);
  });

  it('agregar un festivo y un día laborable: validaciones y confirmaciones en inglés', async () => {
    await setLocale('en-US');
    pickerServer();
    const holiday = renderWithProviders(<HolidayFormPage />, { route: `/company/calendar/holidays/new?date=${last}` });
    await userEvent.click(screen.getByRole('button', { name: 'Add holiday' }));
    expect(await screen.findAllByText('Enter the holiday name (at least 2 letters)')).not.toHaveLength(0);
    holiday.unmount();

    renderWithProviders(<WorkdayFormPage />, { route: '/company/calendar/workdays/new' });
    expect(screen.getByRole('heading', { name: 'Add workday' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add workday' }));
    expect(await screen.findAllByText('Choose the employee')).not.toHaveLength(0);
    expect(screen.getAllByText('Choose the day they work')).not.toHaveLength(0);
  });

  it('rechazar una solicitud en inglés', async () => {
    await setLocale('en-US');
    calendarServer();
    renderWithProviders(
      <Routes>
        <Route path="/company/calendar/absences/:id/reject" element={<AbsenceRejectPage />} />
      </Routes>,
      { route: `/company/calendar/absences/${request.id}/reject` },
    );
    expect(await screen.findByRole('heading', { name: 'Reject request' })).toBeInTheDocument();
    expect(screen.getByText(`They requested permiso: ${formatDate(request.starts_on)} (1 day). They will still have to check in on those days and will see this note in their request.`)).toBeInTheDocument();
  });
});
