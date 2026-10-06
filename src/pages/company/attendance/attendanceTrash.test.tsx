import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { AttendanceBoard, CompanySession, CompanySessionDetail, WorkSession } from '../../../types';
import { AttendanceHistoryPage } from './AttendanceHistoryPage';
import { AttendancePage } from './AttendancePage';
import { AttendanceSessionPage } from './AttendanceSessionPage';

const session: WorkSession = {
  id: 32,
  work_date: '2026-10-02',
  shift_name: 'Matutino',
  scheduled_start: '2026-10-02T14:00:00Z',
  scheduled_end: '2026-10-02T22:00:00Z',
  check_out_deadline: '2026-10-02T23:00:00Z',
  status: 'CLOSED',
  check_in_at: '2026-10-02T14:00:00Z',
  check_in_mode: 'ON_SITE',
  check_in_site: 'Planta Norte',
  check_out_at: '2026-10-02T22:00:00Z',
  check_out_mode: 'ON_SITE',
  check_out_site: 'Planta Norte',
  late_minutes: 0,
  early_leave_minutes: 0,
  break_minutes: 0,
  worked_minutes: 480,
  breaks_allowed: 0,
  break_minutes_allowed: 0,
  breaks: [],
};
/** Beto ya está en «Eliminados»: sus jornadas lo siguen nombrando, con su marca. */
const beto = { id: 8, full_name: 'Beto López', employee_number: 'EMP-8', deleted: true };
const history: CompanySession = { ...session, employee: beto };
const detail: CompanySessionDetail = { ...history, events: [] };
const board: AttendanceBoard = {
  items: [{ employee: beto, department: 'Almacén', shift_name: 'Matutino', scheduled_start: session.scheduled_start, scheduled_end: session.scheduled_end, state: 'DONE', session }],
  total: 1,
  page: 1,
  size: 10,
  work_date: '2026-10-02',
  working: 0,
  on_break: 0,
  done: 1,
  missed_checkout: 0,
};

function server() {
  return mockFetch((call: MockCall) => {
    if (call.url.startsWith('/api/attendance/sessions/32')) return apiOk(detail);
    if (call.url.startsWith('/api/attendance/sessions')) return apiOk({ items: [history], total: 1, page: 1, size: 10 });
    return apiOk(board);
  });
}

const renderAt = (route: string) =>
  renderWithProviders(
    <Routes>
      <Route path="/company/attendance" element={<AttendancePage />} />
      <Route path="/company/attendance/history" element={<AttendanceHistoryPage />} />
      <Route path="/company/attendance/sessions/:id" element={<AttendanceSessionPage />} />
    </Routes>,
    { route },
  );

describe('Asistencia: un empleado eliminado lleva su marca (lo registrado no cambia)', () => {
  it('en el tablero del día', async () => {
    server();
    renderAt('/company/attendance?date=2026-10-02');
    const person = (await screen.findByText('Beto López')).closest('.person') as HTMLElement;
    expect(within(person).getByText('Eliminado')).toHaveClass('deleted-mark');
  });

  it('en el historial de jornadas', async () => {
    server();
    renderAt('/company/attendance/history');
    const row = (await screen.findByText('Beto López')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Eliminado')).toBeInTheDocument();
  });

  it('en el detalle de la jornada', async () => {
    server();
    renderAt('/company/attendance/sessions/32');
    expect(await screen.findByRole('heading', { name: 'Beto López' })).toBeInTheDocument();
    expect(screen.getByText('Eliminado')).toHaveClass('deleted-mark');
  });
});
