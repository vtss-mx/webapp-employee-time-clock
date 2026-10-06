import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { workSession } from '../../../components/attendance/employee/testData';
import { setLocale } from '../../../i18n/core';
import { paths } from '../../../routes/paths';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { AttendanceBoard, BoardRow, CompanySessionDetail } from '../../../types';
import { businessToday, formatDate } from '../../../utils/format';
import { AttendanceHistoryPage } from './AttendanceHistoryPage';
import { AttendancePage } from './AttendancePage';
import { AttendanceSessionPage } from './AttendanceSessionPage';
import { ManualSessionPage } from './ManualSessionPage';

/** Turno de 08:00 a 16:00 (hora del Centro, UTC−6) del 2 de octubre: entró 08:25 remoto y salió 16:00. */
const scheduled = { shift_name: 'Matutino', scheduled_start: '2026-10-02T14:00:00Z', scheduled_end: '2026-10-02T22:00:00Z' };
const session = workSession({
  id: 32,
  work_date: '2026-10-02',
  ...scheduled,
  check_out_deadline: '2026-10-02T23:00:00Z',
  status: 'CLOSED',
  check_in_at: '2026-10-02T14:25:00Z',
  check_in_mode: 'REMOTE',
  check_in_site: null,
  check_out_at: '2026-10-02T22:00:00Z',
  check_out_mode: 'ON_SITE',
  late_minutes: 25,
  worked_minutes: 455,
  breaks: [{ started_at: '2026-10-02T18:00:00Z', ended_at: '2026-10-02T18:30:00Z', minutes: 30, exceeded_minutes: 0 }],
});
const beto = { id: 8, full_name: 'Beto López', employee_number: 'EMP-8' };
const carla = { id: 9, full_name: 'Carla Díaz', employee_number: 'EMP-9' };
const detail: CompanySessionDetail = { ...session, employee: beto, events: [] };
const rows: BoardRow[] = [
  { employee: beto, department: 'Ventas', ...scheduled, state: 'DONE', session },
  { employee: carla, department: null, ...scheduled, state: 'MISSING', session: null },
];
const board = (items: BoardRow[]): AttendanceBoard => ({ items, total: items.length, page: 1, size: 10, work_date: businessToday(), working: 0, on_break: 0, done: 1, missed_checkout: 0 });
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, size: 10 });

/** Las horas de en-US llevan un espacio angosto antes de AM/PM: se comparan como espacio normal. */
const plain = (text: string | null) => (text ?? '').replace(/\s/g, ' ');

describe('Asistencia en inglés (en-US)', () => {
  it('el tablero del día: encabezados, conteos, horas de 12 h y acciones de la empresa', async () => {
    await setLocale('en-US');
    mockFetch(apiOk(board(rows)));
    renderWithProviders(
      <Routes>
        <Route path="/company/attendance" element={<AttendancePage />} />
      </Routes>,
      { route: '/company/attendance' },
    );
    expect(await screen.findByText('Beto López')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText(`Today, ${formatDate(businessToday())}`)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Quick days' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name or employee number')).toBeInTheDocument();
    expect(screen.getByText('With a shift', { selector: '.kpi__label' })).toBeInTheDocument();
    expect(screen.getByText('Completed', { selector: '.kpi__label' })).toBeInTheDocument();
    expect(document.querySelector('.att-board__head')).toHaveTextContent(/Shift.*Check-in.*Breaks.*Check-out/);

    const item = (name: string) => within(screen.getByText(name).closest('li') as HTMLElement);
    expect(item('Beto López').getByText('8:25 AM')).toBeInTheDocument();
    expect(item('Beto López').getByText('8:00 AM – 4:00 PM')).toBeInTheDocument();
    expect(item('Beto López').getByText('1/2 breaks')).toBeInTheDocument();
    expect(item('Beto López').getByRole('link', { name: 'Correct' })).toHaveAttribute('title', "Correct Beto López's workday");
    expect(item('Carla Díaz').getByRole('link', { name: 'Record attendance' })).toHaveAttribute('title', "Record Carla Díaz's attendance");
    expect(screen.getByRole('link', { name: /History/ })).toHaveAttribute('href', '/company/attendance/history');
  });

  it('sin turnos ese día y una falla al cargar, en inglés', async () => {
    await setLocale('en-US');
    mockFetch((call: MockCall) => (call.url.includes('search=') ? apiOk(board([])) : apiFail(500, 'INTERNAL_ERROR', 'Unexpected failure')));
    renderWithProviders(<AttendancePage />, { route: '/company/attendance' });
    expect(await screen.findByRole('alertdialog', { name: "Couldn't load the day's attendance" })).toBeInTheDocument();
  });

  it('el historial y el detalle de una jornada', async () => {
    await setLocale('en-US');
    mockFetch((call: MockCall) => (call.url.includes('/attendance/sessions/') ? apiOk(detail) : apiOk(page([detail]))));
    renderWithProviders(
      <Routes>
        <Route path="/company/attendance/history" element={<AttendanceHistoryPage />} />
        <Route path="/company/attendance/sessions/:id" element={<AttendanceSessionPage />} />
      </Routes>,
      { route: '/company/attendance/history' },
    );
    expect(await screen.findByText('Beto López')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Attendance history' })).toBeInTheDocument();
    expect(screen.getByText('1 workday')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All dates' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByText('7 h 35 min').closest('td')).toHaveAttribute('data-label', 'Worked');

    await userEvent.click(screen.getByText('Beto López'));
    expect(await screen.findByRole('heading', { name: 'Beto López' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Attendance history/ })).toHaveAttribute('href', '/company/attendance/history');
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByText('0 records')).toBeInTheDocument();
    expect(screen.getByText('No records')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Correct' })).toHaveAttribute('href', '/company/attendance/sessions/32/correct');
  });

  it('corregir una jornada: la confirmación en inglés (horas de 12 h) sigue un cambio de idioma en caliente', async () => {
    await setLocale('en-US');
    const { calls } = mockFetch((call: MockCall) => (call.init.method === 'PUT' ? apiOk(detail) : apiOk(detail)));
    renderWithProviders(
      <Routes>
        <Route path={paths.company.correctAttendanceSession(':id')} element={<ManualSessionPage />} />
        <Route path={paths.company.attendanceSession(':id')} element={<p>Workday detail</p>} />
      </Routes>,
      { route: paths.company.correctAttendanceSession(32) },
    );
    expect(await screen.findByRole('heading', { name: 'Correct workday' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Check-in and check-out' })).toBeInTheDocument();
    expect(screen.getAllByText(/^Scheduled for/).map((hint) => plain(hint.textContent))).toEqual(['Scheduled for 8:00 AM', 'Scheduled for 4:00 PM; after midnight counts as the next day']);

    await userEvent.click(screen.getByRole('checkbox', { name: /Still working/ }));
    await userEvent.type(screen.getByLabelText('Why are you correcting it?'), 'Forgot to check out');
    await userEvent.click(screen.getByRole('button', { name: 'Save correction' }));
    const english = "Correct Beto López's workday for Oct 2, 2026?";
    const dialog = await screen.findByRole('dialog', { name: english });
    expect(plain(dialog.textContent)).toContain('Check-out');
    expect(plain(dialog.textContent)).toContain('4:00 PM');
    expect(dialog).toHaveTextContent('Still working');
    expect(dialog).toHaveTextContent('Reason they will see');
    expect(dialog).toHaveTextContent('The previous record stays in the log');

    // Con la confirmación abierta, el idioma cambia al instante (también las horas).
    await act(() => setLocale('es-MX'));
    const spanish = await screen.findByRole('dialog', { name: '¿Corregir la jornada de Beto López del 2 oct 2026?' });
    expect(spanish).toHaveTextContent('Aún no sale');
    expect(spanish).toHaveTextContent('16:00');
    await userEvent.click(within(spanish).getByRole('button', { name: 'Guardar corrección' }));
    expect(await screen.findByRole('dialog', { name: 'Jornada corregida' })).toBeInTheDocument();
    await waitFor(() => expect(calls.some((call) => call.init.method === 'PUT')).toBe(true));
  });

  it('registrar sin empleado y una jornada que no carga, en inglés', async () => {
    await setLocale('en-US');
    mockFetch(apiFail(500, 'INTERNAL_ERROR', 'Unexpected failure'));
    const { unmount } = renderWithProviders(<ManualSessionPage />, { route: paths.company.newAttendanceSession });
    expect(screen.getByRole('heading', { name: 'Record attendance' })).toBeInTheDocument();
    expect(screen.getByText('Choose who to record')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the board' })).toHaveAttribute('href', '/company/attendance');
    unmount();
    renderWithProviders(
      <Routes>
        <Route path={paths.company.attendanceSession(':id')} element={<AttendanceSessionPage />} />
      </Routes>,
      { route: paths.company.attendanceSession(32) },
    );
    expect(await screen.findByRole('alertdialog', { name: "Couldn't load the workday" })).toBeInTheDocument();
  });
});
