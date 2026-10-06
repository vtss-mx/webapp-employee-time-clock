import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AttendanceResultCard } from '../../../components/attendance/employee/AttendanceResultCard';
import { actionResult } from '../../../components/attendance/employee/testData';
import { SessionSummary } from '../../../components/attendance/SessionSummary';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { BoardRow, CompanySessionDetail, WorkSession } from '../../../types';
import { AttendanceHistoryPage } from './AttendanceHistoryPage';
import { AttendancePage } from './AttendancePage';
import { AttendanceSessionPage } from './AttendanceSessionPage';
import { RejectAttendanceReviewPage } from './RejectAttendanceReviewPage';

const session: WorkSession = {
  id: 41,
  work_date: '2026-10-02',
  shift_name: 'Matutino',
  scheduled_start: '2026-10-02T14:00:00Z',
  scheduled_end: '2026-10-02T22:00:00Z',
  check_out_deadline: '2026-10-02T23:00:00Z',
  status: 'OPEN',
  check_in_at: '2026-10-02T14:00:00Z',
  check_in_mode: 'ON_SITE',
  check_in_site: 'Planta Norte',
  check_out_at: null,
  check_out_mode: null,
  check_out_site: null,
  late_minutes: 0,
  early_leave_minutes: 0,
  break_minutes: 0,
  worked_minutes: null,
  breaks_allowed: 1,
  break_minutes_allowed: 30,
  breaks: [],
  review_status: 'PENDING',
  review_reasons: ['CAPTURE', 'LOCATION'],
  reviewed_at: null,
  review_note: null,
};
const employee = { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7' };
const detail: CompanySessionDetail = {
  ...session,
  employee,
  events: [
    {
      action: 'CHECK_IN',
      mode: 'ON_SITE',
      site: 'Planta Norte',
      occurred_at: session.check_in_at,
      latitude: null,
      longitude: null,
      accuracy_m: null,
      distance_m: null,
      confidence: 0.999,
      operator: null,
      under_review: true,
    },
  ],
};
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, size: 10 });

function renderAttendance(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/attendance" element={<AttendancePage />} />
      <Route path="/company/attendance/history" element={<AttendanceHistoryPage />} />
      <Route path="/company/attendance/sessions/:id" element={<AttendanceSessionPage />} />
      <Route path="/company/attendance/sessions/:id/reject" element={<RejectAttendanceReviewPage />} />
    </Routes>,
    { route },
  );
}

describe('Asistencia en revisión (empresa)', () => {
  it('la jornada dice por qué y la empresa la confirma (antes → después); deja de pedir decisión', async () => {
    const { calls } = mockFetch((call: MockCall) =>
      apiOk(call.init.method === 'POST' ? { ...detail, review_status: 'CONFIRMED', reviewed_at: '2026-10-02T18:00:00Z' } : detail),
    );
    renderAttendance('/company/attendance/sessions/41');
    expect(await screen.findByText(/Algo de la captura o la ubicación no fue del todo confiable/)).toBeInTheDocument();
    expect(screen.getByText('Por qué: Captura poco confiable y Ubicación poco confiable')).toBeInTheDocument();
    expect(screen.getByText('Tu empresa debe confirmarlo.')).toBeInTheDocument();
    expect(screen.getAllByText('En revisión').length).toBeGreaterThanOrEqual(2); // la jornada y su registro

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar registro' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Confirmar el registro de Ana Ruiz?' });
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Antes: En revisiónDespués: Confirmado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar registro' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar registro' })).toBeNull());
    expect(screen.getAllByText('Confirmado').length).toBeGreaterThan(0);
    expect(screen.getByText(/Decidido el/)).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === 'POST');
    expect(post?.url).toBe('/api/attendance/sessions/41/review');
    expect(JSON.parse(post?.init.body as string)).toEqual({ decision: 'CONFIRMED', note: null });
  });

  it('rechazar es un formulario con la nota que verá el empleado; la jornada queda marcada', async () => {
    const { calls } = mockFetch((call: MockCall) => apiOk(call.init.method === 'POST' ? { ...detail, review_status: 'REJECTED', review_note: 'No era ella' } : detail));
    renderAttendance('/company/attendance/sessions/41');
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByRole('heading', { name: 'Rechazar registro' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByText('Escribe la nota (al menos 3 caracteres). El empleado la verá.')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /Nota para el empleado/ }), 'No era ella');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Rechazar el registro de Ana Ruiz?' });
    expect(dialog).toHaveTextContent('No era ella');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByRole('dialog', { name: 'Registro rechazado' })).toHaveTextContent('Ana Ruiz verá tu nota en su historial.');
    const post = calls.find((c) => c.init.method === 'POST');
    expect(JSON.parse(post?.init.body as string)).toEqual({ decision: 'REJECTED', note: 'No era ella' });
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
  });

  it('una jornada ya decidida no se puede rechazar; si no carga ofrece reintentar', async () => {
    mockFetch(apiOk({ ...detail, review_status: 'REJECTED', review_note: 'Foto', reviewed_at: '2026-10-02T18:00:00Z' }));
    const view = renderAttendance('/company/attendance/sessions/41/reject');
    expect(await screen.findByRole('button', { name: 'Rechazar' })).toBeDisabled();
    view.unmount();
    mockFetch(apiFail(404, 'WORK_SESSION_NOT_FOUND', 'Jornada no encontrada'));
    renderAttendance('/company/attendance/sessions/41/reject');
    expect(await screen.findByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
  });

  it('el historial filtra "solo en revisión" (también desde el tablero) y marca cada jornada', async () => {
    const row: BoardRow = { employee, department: null, shift_name: 'Matutino', scheduled_start: session.scheduled_start, scheduled_end: session.scheduled_end, state: 'WORKING', session };
    const { calls } = mockFetch((call: MockCall) => {
      if (call.url.startsWith('/api/attendance/board')) return apiOk({ ...page([row]), work_date: '2026-10-02', working: 1, on_break: 0, done: 0, missed_checkout: 0 });
      return apiOk(page([{ ...session, employee }]));
    });
    renderAttendance('/company/attendance');
    const link = await screen.findByRole('link', { name: /Ana Ruiz/ });
    expect(within(link).getByText('En revisión')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'En revisión' }));
    const only = await screen.findByRole('checkbox', { name: /Solo en revisión/ });
    expect(only).toBeChecked();
    await waitFor(() => expect(calls.at(-1)?.url).toContain('in_review=true'));
    expect(within(screen.getByRole('table')).getByText('En revisión')).toBeInTheDocument();
    await userEvent.click(only);
    await waitFor(() => expect(calls.at(-1)?.url).not.toContain('in_review'));
  });

  it('el empleado ve la nota de la decisión (sin los motivos internos) y el aviso al registrar', () => {
    renderWithProviders(<SessionSummary session={{ ...session, review_status: 'REJECTED', review_reasons: [], review_note: 'No era ella', reviewed_at: '2026-10-02T18:00:00Z' }} />);
    expect(screen.getByText('Rechazado')).toBeInTheDocument();
    expect(screen.getByText('Nota de la empresa: No era ella')).toBeInTheDocument();
    expect(screen.queryByText(/Por qué/)).toBeNull();
    renderWithProviders(
      <AttendanceResultCard result={actionResult({ message: 'Entrada: queda en revisión de tu empresa', verification: { ...actionResult().verification, review: true } })} onDone={() => undefined} />,
    );
    expect(screen.getByText(/tu empresa debe revisarlo/)).toBeInTheDocument();
  });
});

describe('Asistencia en revisión: fallas y bordes', () => {
  it('confirmar que falla se explica; cancelar el rechazo regresa; rechazar que falla se explica; sin motivos no los lista', async () => {
    mockFetch((call: MockCall) => (call.init.method === 'POST' ? apiFail(409, 'ATTENDANCE_REVIEW_NOT_PENDING', 'Esta jornada no está en revisión') : apiOk({ ...detail, review_reasons: undefined })));
    const view = renderAttendance('/company/attendance/sessions/41');
    expect(await screen.findByText('Tu empresa debe confirmarlo.')).toBeInTheDocument();
    expect(screen.queryByText(/Por qué/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar registro' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Confirmar el registro de Ana Ruiz?' })).getByRole('button', { name: 'Confirmar registro' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo confirmar el registro' })).toHaveTextContent('Esta jornada no está en revisión');
    view.unmount();

    const reject = renderAttendance('/company/attendance/sessions/41/reject');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    reject.unmount();
    renderAttendance('/company/attendance/sessions/41/reject');
    await userEvent.type(await screen.findByRole('textbox', { name: /Nota para el empleado/ }), 'No era ella');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Rechazar el registro de Ana Ruiz?' })).getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo rechazar el registro' })).toBeInTheDocument();
  });
});
