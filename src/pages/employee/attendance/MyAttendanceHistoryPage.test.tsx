import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pageOf, workSession } from '../../../components/attendance/employee/testData';
import { setLocale } from '../../../i18n/core';
import { paths } from '../../../routes/paths';
import { apiFail, apiOk, mockFetch } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { MyAttendanceHistoryPage } from './MyAttendanceHistoryPage';

describe('MyAttendanceHistoryPage (mis jornadas)', () => {
  it('cada jornada con su día, turno, estado y resumen; paginadas en el servidor', async () => {
    const closed = workSession({
      id: 7,
      status: 'CLOSED',
      late_minutes: 12,
      check_out_at: '2026-10-05T21:40:00Z',
      check_out_mode: 'REMOTE',
      early_leave_minutes: 20,
      worked_minutes: 445,
    });
    const missed = workSession({ id: 6, work_date: '2026-10-02', status: 'MISSED_CHECKOUT' });
    const { calls } = mockFetch(apiOk({ ...pageOf([closed, missed]), total: 12 }));
    renderWithProviders(<MyAttendanceHistoryPage />, { route: paths.employee.attendanceHistory });
    expect(screen.getByRole('heading', { name: 'Mi historial' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mi asistencia/ })).toHaveAttribute('href', paths.employee.attendance);
    const items = await screen.findAllByRole('listitem');
    expect(calls[0].url).toBe('/api/me/attendance/history?page=1&size=10');
    const first = within(items[0]);
    expect(first.getByText('5 oct 2026')).toBeInTheDocument();
    expect(first.getByText('Turno Matutino')).toBeInTheDocument();
    expect(first.getByText('08:00 – 16:00')).toBeInTheDocument();
    expect(first.getByText('Completa')).toBeInTheDocument();
    expect(first.getByText('12 min de retardo')).toBeInTheDocument();
    expect(first.getByText('Salió 20 min antes')).toBeInTheDocument();
    expect(first.getByText('7 h 25 min')).toBeInTheDocument();
    expect(within(items[1]).getAllByText('Sin salida').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
  });

  it('si no carga lo dice en su popup', async () => {
    mockFetch(apiFail(500, 'INTERNAL_ERROR', 'Falló el servidor'));
    renderWithProviders(<MyAttendanceHistoryPage />);
    expect(await screen.findByText('No se pudo cargar tu historial')).toBeInTheDocument();
  });

  it('sin jornadas: estado vacío y sin paginador', async () => {
    mockFetch(apiOk(pageOf([])));
    renderWithProviders(<MyAttendanceHistoryPage />);
    expect(await screen.findByText('Sin jornadas')).toBeInTheDocument();
    expect(screen.getByText('Aquí verás tus entradas y salidas de cada día.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });
});

describe('MyAttendanceHistoryPage en inglés (en-US)', () => {
  it('sus jornadas con fechas, turno y cuántas son en inglés; sin jornadas, su estado vacío', async () => {
    await setLocale('en-US');
    mockFetch(apiOk({ ...pageOf([workSession({ status: 'CLOSED' })]), total: 12 }));
    const view = renderWithProviders(<MyAttendanceHistoryPage />);
    expect(screen.getByRole('heading', { name: 'My history' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /My attendance/ })).toHaveAttribute('href', paths.employee.attendance);
    const [item] = await screen.findAllByRole('listitem');
    expect(within(item).getByText('Oct 5, 2026')).toBeInTheDocument();
    expect(within(item).getByText('Matutino shift')).toBeInTheDocument();
    expect(document.querySelector('.pager__range')).toHaveTextContent(/12 workdays/);
    view.unmount();
    mockFetch(apiOk(pageOf([])));
    renderWithProviders(<MyAttendanceHistoryPage />);
    expect(await screen.findByText("No workdays")).toBeInTheDocument();
    expect(screen.getByText('Your daily check-ins and check-outs will appear here.')).toBeInTheDocument();
  });
});
