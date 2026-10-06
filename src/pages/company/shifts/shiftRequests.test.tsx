import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { businessTomorrow } from '../../../components/shifts/shiftRules';
import { setLocale } from '../../../i18n/core';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { morning as morningShift, plantRef, weekend as weekendShift } from '../../../test/shifts';
import type { ShiftRef, ShiftRequest, ShiftSummary } from '../../../types';
import { formatDate } from '../../../utils/format';
import { ShiftRequestApprovePage } from './ShiftRequestApprovePage';
import { validateRejectNote } from '../../../components/RejectRequestPanel';
import { ShiftRequestRejectPage } from './ShiftRequestRejectPage';
import { ShiftRequestsPage } from './ShiftRequestsPage';

/** El turno actual (resumido) y el pedido (con dónde se checa: el sábado en la planta, el domingo remoto). */
const morning: ShiftRef = { id: 5, name: 'Matutino', start_time: '08:00:00', end_time: '16:00:00', overnight: false, weekdays: [0, 1, 2, 3, 4], remote_weekdays: morningShift.remote_weekdays };
const weekend: ShiftSummary = { ...weekendShift, remote_weekdays: [6], sites: [plantRef] };

const pending: ShiftRequest = {
  id: 31,
  employee: { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7' },
  shift: weekend,
  current_shift: morning,
  valid_from: '2030-01-07',
  reason: 'Estudio entre semana',
  status: 'PENDING',
  review_note: null,
  reviewed_at: null,
  created_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
};
const rejected: ShiftRequest = { ...pending, id: 30, status: 'REJECTED', current_shift: null, review_note: 'Falta personal ese día', reviewed_at: '2026-10-02T10:00:00Z' };

const page = <T,>(items: T[], total = items.length, size = 10) => ({ items, total, page: 1, size });
const bodyOf = (call: MockCall | undefined) => JSON.parse(call?.init.body as string) as unknown;
const fieldFail = (status: number, code: string, message: string, field: string) => jsonResponse(envelope(null, { status, code, message, errors: [{ code, message, field, details: null }] }), status);
const isList = (call: MockCall) => call.url.startsWith('/api/shift-requests?');
/** Filas de "Detalles" de la confirmación, como texto. */
const rows = (dialog: HTMLElement) => within(within(dialog).getByRole('region', { name: 'Detalles' })).getAllByRole('listitem').map((row) => row.textContent);
const APPROVE = '¿Aprobar el cambio de Ana Ruiz al turno Fin de semana?';
const REJECT = '¿Rechazar el cambio de Ana Ruiz?';

/** Pide aprobar y devuelve la confirmación abierta (todavía sin responder). */
async function askApprove() {
  await userEvent.click(screen.getByRole('button', { name: 'Aprobar cambio' }));
  return screen.findByRole('dialog', { name: APPROVE });
}

/** Pide rechazar y devuelve la confirmación abierta (todavía sin responder). */
async function askReject() {
  await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
  return screen.findByRole('alertdialog', { name: REJECT });
}

/** Avisos al contador del menú (`notifyShiftRequestsChanged`). */
const changes = vi.fn();
beforeEach(() => {
  changes.mockReset();
  window.addEventListener('tc:shift-requests-changed', changes);
});
afterEach(() => {
  window.removeEventListener('tc:shift-requests-changed', changes);
  vi.unstubAllGlobals();
});

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/shifts" element={<p>Turnos</p>} />
      <Route path="/company/shifts/requests" element={<ShiftRequestsPage />} />
      <Route path="/company/shifts/requests/:id/approve" element={<ShiftRequestApprovePage />} />
      <Route path="/company/shifts/requests/:id/reject" element={<ShiftRequestRejectPage />} />
    </Routes>,
    { route },
  );
}

describe('Solicitudes de cambio: bandeja', () => {
  it('por omisión las pendientes, con el cambio, la fecha, el motivo y cómo decidirlas; filtra por estado', async () => {
    const { calls } = mockFetch((call) => apiOk(page(call.url.includes('status=PENDING') ? [pending] : [rejected])));
    renderAt('/company/shifts/requests');
    const item = (await screen.findByText('Estudio entre semana', { exact: false })).closest('li') as HTMLElement;
    expect(calls[0].url).toBe('/api/shift-requests?page=1&size=10&status=PENDING');
    expect(item).toHaveTextContent('Ana Ruiz · EMP-7');
    expect(item).toHaveTextContent('Matutino (08:00 – 16:00)');
    expect(item).toHaveTextContent('Fin de semana (22:00 – 06:00 (día siguiente))');
    expect(item).toHaveTextContent(`Desde el ${formatDate('2030-01-07')} · pedida hace 2 horas`);
    expect(within(item).getByText('Pendiente')).toBeInTheDocument();
    expect(within(item).getByRole('link', { name: 'Aprobar la solicitud de Ana Ruiz' })).toHaveAttribute('href', '/company/shifts/requests/31/approve');
    expect(within(item).getByRole('link', { name: 'Rechazar la solicitud de Ana Ruiz' })).toHaveAttribute('href', '/company/shifts/requests/31/reject');
    expect(screen.getByRole('link', { name: /Turnos/ })).toHaveAttribute('href', '/company/shifts');
    expect(screen.getByText(/1 solicitud de tus empleados/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Rechazada' }));
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/shift-requests?page=1&size=10&status=REJECTED'));
    const decided = (await screen.findByText('Nota de la empresa: “Falta personal ese día”')).closest('li') as HTMLElement;
    expect(decided).toHaveTextContent('Sin turno');
    expect(within(decided).queryByRole('link')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Todas las solicitudes' }));
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/shift-requests?page=1&size=10'));
  });

  it('sin pendientes es buena noticia; con otro estado sugiere otro; con «Todas» dice qué aparecerá', async () => {
    mockFetch(() => apiOk({ ...page([]), total: 0 }));
    renderAt('/company/shifts/requests');
    expect(await screen.findByText('Todo al día')).toBeInTheDocument();
    expect(screen.getByText('No hay solicitudes de turno por revisar.')).toBeInTheDocument();
    expect(screen.getByText(/0 solicitudes/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Cancelada' }));
    expect(await screen.findByText('Sin solicitudes')).toBeInTheDocument();
    expect(screen.getByText('Prueba con otro estado.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Todas las solicitudes' }));
    expect(await screen.findByText('Aquí verás los cambios de turno que pida tu personal.')).toBeInTheDocument();
  });

  it('los vacíos en inglés (en-US): buena noticia, otro estado y «Todas»', async () => {
    await setLocale('en-US');
    mockFetch(() => apiOk({ ...page([]), total: 0 }));
    renderAt('/company/shifts/requests');
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
    expect(screen.getByText('No shift requests to review.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Filter by status/ }));
    await userEvent.click(screen.getByRole('option', { name: 'All requests' }));
    expect(await screen.findByText('Shift changes your staff requests will appear here.')).toBeInTheDocument();
    expect(screen.getByText('No requests')).toBeInTheDocument();
  });

  it('en inglés (en-US): si no carga lo dice y se reintenta; cada solicitud con su cambio, su fecha y cómo decidirla', async () => {
    await setLocale('en-US');
    let attempts = 0;
    mockFetch(() => (++attempts === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Unexpected failure') : apiOk(page([pending]))));
    renderAt('/company/shifts/requests');
    const failed = await screen.findByRole('alertdialog', { name: "Couldn't load the requests" });
    await userEvent.click(within(failed).getByRole('button', { name: 'Retry' }));
    const item = (await screen.findByText('Estudio entre semana', { exact: false })).closest('li') as HTMLElement;
    expect(screen.getByRole('heading', { name: 'Shift change requests' })).toBeInTheDocument();
    expect(screen.getByText(/1 request from your employees/)).toBeInTheDocument();
    expect(item).toHaveTextContent('Matutino (8:00 AM – 4:00 PM)');
    expect(item).toHaveTextContent('Fin de semana (10:00 PM – 6:00 AM (next day))');
    expect(item).toHaveTextContent(`From ${formatDate('2030-01-07')} · requested 2 hours ago`);
    expect(within(item).getByRole('link', { name: "Approve Ana Ruiz's request" })).toHaveTextContent('Approve');
    expect(within(item).getByRole('img', { name: 'changes to' })).toBeInTheDocument();
  });
});

describe('Solicitudes de cambio: aprobar', () => {
  it('desde la bandeja: muestra dónde checará con el turno pedido, aprueba con la fecha pedida y vuelve a la bandeja', async () => {
    const { calls } = mockFetch((call) => (call.init.method === 'POST' ? apiOk({ ...pending, status: 'APPROVED' }) : apiOk(page([pending]))));
    renderAt('/company/shifts/requests');
    await userEvent.click(await screen.findByRole('link', { name: 'Aprobar la solicitud de Ana Ruiz' }));
    expect(await screen.findByRole('heading', { name: 'Aprobar cambio de turno' })).toBeInTheDocument();
    expect(calls.filter(isList)).toHaveLength(1); // la solicitud llegó con la navegación
    expect(screen.getByText('“Estudio entre semana”')).toBeInTheDocument();
    expect(screen.getByLabelText(/Aplica desde/)).toHaveValue('07/01/2030');
    // Dónde checará lo dice el turno pedido: no se eligen días remotos ni sitios.
    const card = screen.getByRole('group', { name: 'Turno Fin de semana: cuándo y dónde se checa' });
    expect(card).toHaveTextContent('Remoto: Dom');
    expect(card).toHaveTextContent('Planta Norte');
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(calls.some((c) => c.url.startsWith('/api/sites'))).toBe(false);

    // Se confirma el horario, dónde checará y la fecha; cancelar no envía nada.
    const confirm = await askApprove();
    expect(confirm).toHaveTextContent('Su turno actual termina el día anterior y lo ya registrado no cambia.');
    expect(rows(confirm)).toEqual(['Horario22:00 – 06:00 (día siguiente) · Sáb y dom', 'Sitios donde checaPlanta Norte', 'Días remotosDom', `Aplica desde${formatDate('2030-01-07')}`]);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog', { name: APPROVE })).toBeNull();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    expect(changes).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Aplica desde/)).toHaveValue('07/01/2030');
    expect(screen.getByRole('button', { name: 'Aprobar cambio' })).toBeEnabled();
    await userEvent.click(within(await askApprove()).getByRole('button', { name: 'Aprobar cambio' }));

    expect(await screen.findByRole('dialog', { name: 'Cambio de turno aprobado' })).toHaveTextContent(`Ana Ruiz tendrá el turno Fin de semana desde el ${formatDate('2030-01-07')}.`);
    expect(await screen.findByRole('heading', { name: 'Solicitudes de cambio de turno' })).toBeInTheDocument();
    expect(bodyOf(calls.find((c) => c.init.method === 'POST'))).toEqual({ valid_from: '2030-01-07' });
    expect(calls.find((c) => c.init.method === 'POST')?.url).toBe('/api/shift-requests/31/approve');
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('por enlace directo la busca entre las pendientes; la fecha pasada se corrige; errores del servidor', async () => {
    const old = { ...pending, valid_from: '2026-01-05' };
    const others = Array.from({ length: 50 }, (_, i) => ({ ...pending, id: 100 + i }));
    let posts = 0;
    const { calls } = mockFetch((call) => {
      if (call.init.method === 'POST') {
        posts += 1;
        return posts === 1
          ? fieldFail(422, 'SHIFT_REQUEST_NOTICE_REQUIRED', 'El cambio de turno se pide con al menos un día de anticipación: elige desde mañana', 'valid_from')
          : apiFail(409, 'SHIFT_REQUEST_CLOSED', 'La solicitud ya fue atendida');
      }
      return apiOk(call.url.includes('page=1&') ? page(others, 51, 50) : { ...page([old], 51, 50), page: 2 });
    });
    renderAt('/company/shifts/requests/31/approve');
    const date = await screen.findByLabelText(/Aplica desde/);
    expect(calls.filter(isList).map((c) => c.url)).toEqual(['/api/shift-requests?status=PENDING&page=1&size=50', '/api/shift-requests?status=PENDING&page=2&size=50']);
    // La fecha pedida ya pasó: se propone mañana.
    expect(date).toHaveValue(businessTomorrow().split('-').reverse().join('/'));
    expect(screen.getByText(new RegExp(`Pidió desde el ${formatDate('2026-01-05')}`))).toBeInTheDocument();

    // Una fecha sin el día de anticipación no se confirma.
    await userEvent.clear(date);
    await userEvent.type(date, '01012020');
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar cambio' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'Revisa los datos' })).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Elige desde mañana: el cambio de turno se programa con un día de anticipación.')).toBeInTheDocument();
    await userEvent.clear(date);
    await userEvent.type(date, businessTomorrow().split('-').reverse().join(''));
    const confirm = await askApprove();
    expect(rows(confirm).at(-1)).toBe(`Aplica desde${formatDate(businessTomorrow())}`);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Aprobar cambio' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo aprobar el cambio de turno' })).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText(/elige desde mañana/)).toBeInTheDocument();
    expect(bodyOf(calls.find((c) => c.init.method === 'POST'))).toEqual({ valid_from: businessTomorrow() });
    expect(changes).not.toHaveBeenCalled();

    // Otra persona ya la decidió: se explica y vuelve a la bandeja (con el contador actualizado).
    await userEvent.click(within(await askApprove()).getByRole('button', { name: 'Aprobar cambio' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo aprobar el cambio de turno' })).toHaveTextContent('La solicitud ya fue atendida');
    expect(await screen.findByRole('heading', { name: 'Solicitudes de cambio de turno' })).toBeInTheDocument();
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('si ya no está pendiente lo explica y lleva a la bandeja (sin recorrer páginas de más)', async () => {
    const others = Array.from({ length: 50 }, (_, i) => ({ ...pending, id: 100 + i }));
    const { calls } = mockFetch(() => apiOk(page(others, 5000, 50)));
    renderAt('/company/shifts/requests/31/approve');
    expect(await screen.findByText('Esta solicitud ya no está pendiente')).toBeInTheDocument();
    expect(calls.filter(isList)).toHaveLength(20); // tope de páginas
    expect(screen.getByRole('link', { name: 'Ver solicitudes' })).toHaveAttribute('href', '/company/shifts/requests');
  });

  it('sin pendientes no la encuentra en la primera página y no pide más', async () => {
    const { calls } = mockFetch(() => apiOk(page([], 0, 50)));
    renderAt('/company/shifts/requests/31/reject');
    expect(await screen.findByText('Esta solicitud ya no está pendiente')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rechazar cambio de turno' })).toBeInTheDocument();
    expect(calls.filter(isList)).toHaveLength(1);
  });

  it('si no se puede buscar ofrece volver a cargar', async () => {
    let attempts = 0;
    mockFetch(() => {
      attempts += 1;
      return attempts === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada') : apiOk(page([pending]));
    });
    renderAt('/company/shifts/requests/31/approve');
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar la solicitud' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Solicitudes de cambio de turno' })).toBeInTheDocument();
  });
});

describe('Solicitudes de cambio: rechazar', () => {
  it('regla de la nota', () => {
    expect(validateRejectNote(' no ')).toMatch(/al menos 5 caracteres/);
    expect(validateRejectNote('Falta personal')).toBeUndefined();
  });

  it('con una nota para el empleado (sin sugerencias de catálogo); rechaza y vuelve a la bandeja', async () => {
    const { calls } = mockFetch((call) => (call.init.method === 'POST' ? apiOk({ ...rejected, id: 31 }) : apiOk(page([pending]))));
    renderAt('/company/shifts/requests');
    await userEvent.click(await screen.findByRole('link', { name: 'Rechazar la solicitud de Ana Ruiz' }));
    expect(await screen.findByText(/Pidió cambiar al turno Fin de semana/)).toBeInTheDocument();
    expect(document.querySelector('.chips')).toBeNull();
    const note = screen.getByLabelText(/Nota para el empleado/);
    await userEvent.type(note, 'no');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(screen.getByText(/al menos 5 caracteres/)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog', { name: REJECT })).toBeNull(); // lo inválido no se confirma
    await userEvent.type(note, ' hay personal suficiente  ');

    // Se confirma el turno pedido y la nota que verá; cancelar no envía nada y deja la nota escrita.
    const confirm = await askReject();
    expect(confirm).toHaveTextContent('Conservará su turno actual y verá tu nota en su solicitud.');
    expect(rows(confirm)).toEqual([`Turno pedidoFin de semana desde el ${formatDate('2030-01-07')}`, 'Nota que veráno hay personal suficiente']);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog', { name: REJECT })).toBeNull();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    expect(changes).not.toHaveBeenCalled();
    expect(note).toHaveValue('no hay personal suficiente  ');
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeEnabled();
    await userEvent.click(within(await askReject()).getByRole('button', { name: 'Rechazar' }));

    expect(await screen.findByRole('dialog', { name: 'Solicitud rechazada' })).toHaveTextContent('Ana Ruiz conserva su turno y verá tu nota.');
    expect(await screen.findByRole('heading', { name: 'Solicitudes de cambio de turno' })).toBeInTheDocument();
    expect(bodyOf(calls.find((c) => c.init.method === 'POST'))).toEqual({ note: 'no hay personal suficiente' });
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('una falla se explica y deja corregir; si ya se decidió, vuelve a la bandeja', async () => {
    let posts = 0;
    mockFetch((call) => {
      if (call.init.method !== 'POST') return apiOk(page([pending]));
      posts += 1;
      return posts === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada') : apiFail(409, 'SHIFT_REQUEST_CLOSED', 'La solicitud ya fue atendida');
    });
    renderAt('/company/shifts/requests/31/reject');
    await userEvent.type(await screen.findByLabelText(/Nota para el empleado/), 'Falta personal');
    await userEvent.click(within(await askReject()).getByRole('button', { name: 'Rechazar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo rechazar la solicitud' })).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByRole('heading', { name: 'Rechazar cambio de turno' })).toBeInTheDocument();
    expect(changes).not.toHaveBeenCalled();
    await userEvent.click(within(await askReject()).getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo rechazar la solicitud' })).toHaveTextContent('La solicitud ya fue atendida');
    expect(await screen.findByRole('heading', { name: 'Solicitudes de cambio de turno' })).toBeInTheDocument();
    expect(changes).toHaveBeenCalledTimes(1);
  });
});
