import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestsTab } from '../../../components/calendar/RequestsTab';
import { ABSENCES_CHANGED, first, request } from '../../../components/calendar/testData';
import { page } from '../../../components/employees/testData';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { formatDate } from '../../../utils/format';
import { AbsenceRejectPage } from './AbsenceRejectPage';

const changes = vi.fn();
beforeEach(() => {
  changes.mockReset();
  window.addEventListener(ABSENCES_CHANGED, changes);
});
afterEach(() => {
  window.removeEventListener(ABSENCES_CHANGED, changes);
  vi.unstubAllGlobals();
});

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/calendar" element={<RequestsTab onTotal={vi.fn()} />} />
      <Route path="/company/calendar/absences/:id/reject" element={<AbsenceRejectPage />} />
    </Routes>,
    { route },
  );
}

const lists = (calls: MockCall[]) => calls.filter((call) => call.url.startsWith('/api/calendar/absences?'));
const posted = (calls: MockCall[]) => calls.find((call) => call.init.method === 'POST');
const others = Array.from({ length: 50 }, (_, index) => ({ ...request, id: 100 + index }));
const QUESTION = '¿Rechazar permiso de Ana Ruiz?';
/** Envía la nota y confirma la pregunta (el botón del formulario y el del popup se llaman igual). */
async function rejectAndConfirm() {
  await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
  await userEvent.click(within(await screen.findByRole('alertdialog', { name: QUESTION })).getByRole('button', { name: 'Rechazar' }));
}

describe('Rechazar una solicitud de vacaciones o permiso', () => {
  it('desde la bandeja (sin volver a buscarla): pide la nota, rechaza, avisa y regresa', async () => {
    const { calls } = mockFetch((call) => (call.init.method === 'POST' ? apiOk({ ...request, status: 'REJECTED' }) : apiOk(page([request]))));
    renderAt('/company/calendar?tab=requests');
    await userEvent.click(await screen.findByRole('link', { name: 'Rechazar la solicitud de Ana Ruiz' }));
    expect(await screen.findByRole('heading', { name: 'Rechazar solicitud' })).toBeInTheDocument();
    expect(lists(calls)).toHaveLength(1);
    expect(screen.getByText('Ana Ruiz · EMP-7')).toBeInTheDocument();
    expect(screen.getByText(`Pidió permiso: ${formatDate(first)} (1 día). Esos días seguirá teniendo que checar y verá esta nota en su solicitud.`)).toBeInTheDocument();
    const note = screen.getByLabelText(/Nota para el empleado/);
    await userEvent.type(note, 'no');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(screen.getByText(/al menos 5 caracteres/)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull(); // una nota inválida no pregunta
    await userEvent.type(note, ' hay personal suficiente  ');

    // Pregunta con lo que pidió y la nota que verá (sin espacios sobrantes); cancelar deja el formulario.
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    const confirm = await screen.findByRole('alertdialog', { name: QUESTION });
    expect(within(confirm).getByText('Rechazar solicitud')).toBeInTheDocument();
    expect(confirm).toHaveTextContent('Esos días seguirá teniendo que checar y verá tu nota en su solicitud.');
    expect(within(confirm).getByRole('region', { name: 'Detalles' })).toHaveTextContent(
      `EmpleadoAna Ruiz · EMP-7TipoPermisoFechas${formatDate(first)} · 1 díaNotaTrámiteNota que veráno hay personal suficiente`,
    );
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posted(calls)).toBeUndefined();
    expect(changes).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Rechazar solicitud' })).toBeInTheDocument();
    expect(note).toHaveValue('no hay personal suficiente  ');
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();

    await rejectAndConfirm();
    expect(await screen.findByRole('dialog', { name: 'Solicitud rechazada' })).toHaveTextContent('Ana Ruiz conserva esos días como laborables y verá tu nota.');
    expect(posted(calls)?.url).toBe('/api/calendar/absences/11/reject');
    expect(JSON.parse(posted(calls)?.init.body as string)).toEqual({ note: 'no hay personal suficiente' });
    expect(changes).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('link', { name: 'Rechazar la solicitud de Ana Ruiz' })).toBeInTheDocument();
  });

  it('por enlace directo la busca entre las pendientes; una falla deja corregir; si ya se decidió, regresa', async () => {
    let posts = 0;
    const { calls } = mockFetch((call) => {
      if (call.init.method === 'POST') {
        posts += 1;
        return posts === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada') : apiFail(409, 'ABSENCE_CLOSED', 'La solicitud ya fue atendida');
      }
      return call.url.includes('page=1&') ? apiOk({ ...page(others, 51), size: 50 }) : apiOk({ ...page([request], 51), page: 2, size: 50 });
    });
    renderAt('/company/calendar/absences/11/reject');
    const note = await screen.findByLabelText(/Nota para el empleado/);
    expect(lists(calls).map((call) => call.url)).toEqual(['/api/calendar/absences?status=PENDING&page=1&size=50', '/api/calendar/absences?status=PENDING&page=2&size=50']);
    await userEvent.type(note, 'Falta personal');
    await rejectAndConfirm();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo rechazar la solicitud' })).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByRole('heading', { name: 'Rechazar solicitud' })).toBeInTheDocument();
    expect(changes).not.toHaveBeenCalled();

    await rejectAndConfirm();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo rechazar la solicitud' })).toHaveTextContent('La solicitud ya fue atendida');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Rechazar solicitud' })).toBeNull());
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('si ya no está pendiente lo explica (sin recorrer páginas de más)', async () => {
    const { calls } = mockFetch(() => apiOk({ ...page(others, 5000), size: 50 }));
    renderAt('/company/calendar/absences/11/reject');
    expect(await screen.findByText('Esta solicitud ya no está pendiente')).toBeInTheDocument();
    expect(lists(calls)).toHaveLength(20);
    expect(screen.getByRole('link', { name: 'Ver solicitudes' })).toHaveAttribute('href', '/company/calendar?tab=requests');
  });

  it('sin pendientes no la busca más; si no se puede buscar ofrece volver a cargar', async () => {
    let attempts = 0;
    const { calls } = mockFetch(() => {
      attempts += 1;
      return attempts === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada') : apiOk({ ...page([], 0), size: 50 });
    });
    renderAt('/company/calendar/absences/11/reject');
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar la solicitud' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Esta solicitud ya no está pendiente')).toBeInTheDocument();
    expect(lists(calls)).toHaveLength(2);
  });
});
