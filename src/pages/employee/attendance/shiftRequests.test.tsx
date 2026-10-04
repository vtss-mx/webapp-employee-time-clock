import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { attendanceToday, companyShift, pageOf, shiftRequest } from '../../../components/attendance/employee/testData';
import { toIso } from '../../../components/ui/DateField';
import { paths } from '../../../routes/paths';
import { apiFail, apiOk, jsonResponse, envelope, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { businessDate, formatDate } from '../../../utils/format';
import { MyShiftRequestsPage } from './MyShiftRequestsPage';
import { ShiftRequestFormPage } from './ShiftRequestFormPage';

type Responder = (call: MockCall) => Response;

const vespertino = companyShift({ id: 9, name: 'Vespertino', start_time: '14:00:00', end_time: '22:00:00' });
const matutino = companyShift();

/** Las dos pantallas con sus rutas; cada endpoint responde con su función (o una lista por omisión). */
function renderAt(route: string, overrides: Record<string, Responder> = {}) {
  const server = mockFetch((call) => {
    const path = call.url.split('?')[0];
    const key = `${call.init.method ?? 'GET'} ${path}`;
    if (overrides[key]) return overrides[key](call);
    if (key === 'GET /api/me/shifts') return apiOk(pageOf([matutino, vespertino]));
    if (key === 'GET /api/me/attendance/today') return apiOk(attendanceToday());
    if (key === 'POST /api/me/shift-requests') return apiOk(shiftRequest(), { status: 201 });
    return apiOk(pageOf([]));
  });
  renderWithProviders(
    <Routes>
      <Route path={paths.employee.shiftRequests} element={<MyShiftRequestsPage />} />
      <Route path={paths.employee.newShiftRequest} element={<ShiftRequestFormPage />} />
    </Routes>,
    { route },
  );
  return server;
}

/** Varias respuestas en orden para el mismo endpoint (la última se repite). */
function inOrder(...responses: Response[]): Responder {
  const queue = [...responses];
  return () => (queue.length > 1 ? (queue.shift() as Response) : queue[0].clone());
}

const listCalls = (calls: MockCall[]) => calls.filter((c) => c.url.startsWith('/api/me/shift-requests?'));
/** La confirmación de cancelar la pendiente (destructiva: alerta). */
const cancelDialog = () => screen.findByRole('alertdialog', { name: '¿Cancelar tu solicitud de cambio de turno?' });

describe('MyShiftRequestsPage (mis solicitudes de cambio de turno)', () => {
  it('pendiente: su detalle, sin pedir otra, y se cancela con confirmación (la lista se actualiza)', async () => {
    const { calls } = renderAt(paths.employee.shiftRequests, {
      'GET /api/me/shift-requests': inOrder(apiOk(pageOf([shiftRequest()])), apiOk(pageOf([shiftRequest({ status: 'CANCELLED' })]))),
      'POST /api/me/shift-requests/4/cancel': () => apiOk(shiftRequest({ status: 'CANCELLED' })),
    });
    const item = within((await screen.findAllByRole('listitem'))[0]);
    expect(item.getByText('Vespertino')).toBeInTheDocument();
    expect(item.getByText('14:00 – 22:00 · Lun a vie')).toBeInTheDocument();
    expect(item.getByText('Pendiente')).toBeInTheDocument();
    expect(item.getByText('12 oct 2026')).toBeInTheDocument();
    expect(item.getByText('Matutino')).toBeInTheDocument();
    expect(item.getByText('Entro a la escuela por las mañanas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedir cambio de turno' })).toBeDisabled();
    expect(screen.getByText(/Solo puedes tener una solicitud pendiente a la vez/)).toBeInTheDocument();

    await userEvent.click(item.getByRole('button', { name: 'Cancelar solicitud' }));
    const ask = await cancelDialog();
    expect(ask).toHaveTextContent('Se retirará y tu empresa ya no la revisará.');
    const facts = within(ask).getByRole('region', { name: 'Detalles' });
    expect(within(facts).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Turno que pedisteVespertino · 14:00 – 22:00 · Lun a vie', 'Desde12 oct 2026']);
    expect(within(ask).getByRole('button', { name: 'Conservarla' })).toHaveFocus(); // lo seguro primero
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancelar solicitud' }));
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/me/shift-requests/4/cancel' && c.init.method === 'POST')).toBe(true);
    expect(listCalls(calls)).toHaveLength(2);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('link', { name: 'Pedir cambio de turno' })).toHaveAttribute('href', paths.employee.newShiftRequest);
  });

  it('confirmación: "Conservarla" la cierra sin tocar nada; si falla, el popup lo explica', async () => {
    const { calls } = renderAt(paths.employee.shiftRequests, {
      'GET /api/me/shift-requests': () => apiOk(pageOf([shiftRequest()])),
      'POST /api/me/shift-requests/4/cancel': () => apiFail(409, 'SHIFT_REQUEST_CLOSED', 'La solicitud ya fue atendida'),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar solicitud' }));
    await userEvent.click(within(await cancelDialog()).getByRole('button', { name: 'Conservarla' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    expect(listCalls(calls)).toHaveLength(1); // la lista no se vuelve a pedir
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar solicitud' })).toBeEnabled(); // nada quedó ocupado
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));
    await userEvent.click(within(await cancelDialog()).getByRole('button', { name: 'Cancelar solicitud' }));
    expect(await screen.findByText('No se pudo cancelar la solicitud')).toBeInTheDocument();
    expect(screen.getByText('La solicitud ya fue atendida')).toBeInTheDocument();
  });

  it('sin pendiente: se puede pedir otra; las atendidas muestran la respuesta de la empresa', async () => {
    renderAt(paths.employee.shiftRequests, {
      'GET /api/me/shift-requests': () =>
        apiOk({
          ...pageOf([shiftRequest({ id: 5, status: 'REJECTED', review_note: 'No hay cupo en ese turno', current_shift: null }), shiftRequest({ id: 3, status: 'APPROVED' })]),
          total: 14,
        }),
    });
    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]).getByText('Rechazada')).toBeInTheDocument();
    expect(within(items[0]).getByText('No hay cupo en ese turno')).toBeInTheDocument();
    expect(within(items[0]).getByText('Sin turno')).toBeInTheDocument();
    expect(within(items[0]).queryByRole('button', { name: 'Cancelar solicitud' })).toBeNull();
    expect(within(items[1]).getByText('Aprobada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir cambio de turno' })).toBeInTheDocument();
    expect(screen.queryByText(/Solo puedes tener una solicitud pendiente/)).toBeNull();
    // La segunda página no cambia lo que se sabe de la pendiente (siempre es la más reciente).
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Pedir cambio de turno' })).toBeInTheDocument());
  });

  it('sin solicitudes: estado vacío', async () => {
    renderAt(paths.employee.shiftRequests);
    expect(await screen.findByText('Aún no has pedido cambios de turno')).toBeInTheDocument();
  });
});

const base = businessDate();
const day = (offset: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
const typed = (date: Date) => toIso(date).split('-').reverse().join('');
const shiftSelect = () => screen.getByRole('button', { name: /^Turno/ });

async function fillForm({ date = typed(day(7)), reason = 'Entro a la escuela por las mañanas' } = {}) {
  await userEvent.click(shiftSelect());
  await userEvent.click(screen.getByRole('option', { name: /Vespertino/ }));
  await userEvent.clear(screen.getByLabelText('Desde'));
  await userEvent.type(screen.getByLabelText('Desde'), date);
  await userEvent.clear(screen.getByLabelText('¿Por qué pides el cambio?'));
  await userEvent.type(screen.getByLabelText('¿Por qué pides el cambio?'), reason);
}
const send = () => userEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
const askDialog = () => screen.findByRole('dialog', { name: '¿Pedir el cambio de turno?' });
/** Envía y confirma en el popup lo que se enviará. */
async function sendConfirmed() {
  await send();
  await userEvent.click(within(await askDialog()).getByRole('button', { name: 'Enviar solicitud' }));
}

describe('ShiftRequestFormPage (pedir cambio de turno)', () => {
  it('turnos con horario y días (el actual no se elige); valida, confirma y envía; avisa y vuelve a la lista', async () => {
    const { calls } = renderAt(paths.employee.newShiftRequest);
    await userEvent.click(await screen.findByRole('button', { name: /^Turno/ }));
    expect(screen.getByRole('option', { name: /Matutino/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('08:00 – 16:00 · Lun a vie · Tu turno actual')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await send();
    expect(await screen.findByText('Revisa la información')).toBeInTheDocument();
    expect(screen.getAllByText('Elige el turno que quieres').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Elige desde cuándo quieres el cambio').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await fillForm({ date: typed(day(0)), reason: 'abc' });
    expect(screen.getByText('Elige desde mañana: el cambio se pide con al menos un día de anticipación')).toBeInTheDocument();
    expect(screen.getByText('Explica brevemente el motivo (al menos 5 caracteres)')).toBeInTheDocument();
    await fillForm({ date: '31022030' });
    expect(screen.getByText('Escribe una fecha válida (dd/mm/aaaa)')).toBeInTheDocument();

    await fillForm();
    // Antes de enviar pregunta con lo que se enviará; "Cancelar" no envía nada y deja el formulario como estaba.
    await send();
    const ask = await askDialog();
    expect(ask).toHaveTextContent('Tu empresa la revisará y aquí verás si la aprueba');
    const facts = within(ask).getByRole('region', { name: 'Se enviará' });
    expect(within(facts).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Turno que pidesVespertino · 14:00 – 22:00 · Lun a vie',
      `Desde${formatDate(toIso(day(7)))}`,
      'MotivoEntro a la escuela por las mañanas',
    ]);
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    expect(screen.queryByText('Solicitud enviada a tu empresa')).toBeNull();
    expect(screen.getByLabelText('¿Por qué pides el cambio?')).toHaveValue('Entro a la escuela por las mañanas');
    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();

    await sendConfirmed();
    expect(await screen.findByText('Solicitud enviada a tu empresa')).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === 'POST');
    expect(JSON.parse(post?.init.body as string)).toEqual({ shift_id: 9, valid_from: toIso(day(7)), reason: 'Entro a la escuela por las mañanas' });
    expect(await screen.findByRole('heading', { name: 'Cambio de turno' })).toBeInTheDocument();
  });

  it('errores del servidor: la fecha sin anticipación se marca en su campo; una pendiente se explica', async () => {
    const notice = jsonResponse(
      envelope(null, {
        status: 422,
        code: 'SHIFT_REQUEST_NOTICE_REQUIRED',
        message: 'El cambio de turno se pide con al menos un día de anticipación: elige desde mañana',
        errors: [{ code: 'SHIFT_REQUEST_NOTICE_REQUIRED', message: 'El cambio de turno se pide con al menos un día de anticipación: elige desde mañana', field: 'valid_from', details: null }],
      }),
      422,
    );
    renderAt(paths.employee.newShiftRequest, {
      'POST /api/me/shift-requests': inOrder(notice, apiFail(409, 'SHIFT_REQUEST_PENDING', 'Ya tienes una solicitud de cambio de turno pendiente')),
    });
    await screen.findByRole('button', { name: /^Turno/ });
    await fillForm();
    await sendConfirmed();
    expect(await screen.findByText('No se pudo enviar tu solicitud')).toBeInTheDocument();
    expect(screen.getAllByText('El cambio de turno se pide con al menos un día de anticipación: elige desde mañana').length).toBeGreaterThan(1);
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await sendConfirmed();
    expect(await screen.findByText('Ya tienes una solicitud de cambio de turno pendiente')).toBeInTheDocument();
  });

  it('si no se sabe su turno actual, todos se pueden elegir; "Cancelar" vuelve a la lista', async () => {
    renderAt(paths.employee.newShiftRequest, { 'GET /api/me/attendance/today': () => apiFail(500, 'INTERNAL_ERROR') });
    await userEvent.click(await screen.findByRole('button', { name: /^Turno/ }));
    expect(screen.getByRole('option', { name: /Matutino/ })).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Cambio de turno' })).toBeInTheDocument();
  });

  it('sin turno vigente hoy: nada se marca como actual', async () => {
    renderAt(paths.employee.newShiftRequest, { 'GET /api/me/attendance/today': () => apiOk(attendanceToday({ shift: null })) });
    await userEvent.click(await screen.findByRole('button', { name: /^Turno/ }));
    expect(screen.queryByText(/Tu turno actual/)).toBeNull();
  });

  it('sin turnos en la empresa: lo explica y ofrece volver', async () => {
    renderAt(paths.employee.newShiftRequest, { 'GET /api/me/shifts': () => apiOk(pageOf([])) });
    expect(await screen.findByText('Tu empresa no tiene turnos disponibles')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', paths.employee.shiftRequests);
  });

  it('si no cargan los turnos: popup y "Volver a cargar"', async () => {
    renderAt(paths.employee.newShiftRequest, { 'GET /api/me/shifts': inOrder(apiFail(500, 'INTERNAL_ERROR', 'Falló'), apiOk(pageOf([vespertino]))) });
    expect(await screen.findByText('No se pudieron cargar los turnos')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('button', { name: /^Turno/ })).toBeInTheDocument();
  });
});
