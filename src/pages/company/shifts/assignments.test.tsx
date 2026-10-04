import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { businessTomorrow } from '../../../components/shifts/shiftRules';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { Employee, Shift, ShiftAssignment, WorkSite } from '../../../types';
import { businessToday, formatDate } from '../../../utils/format';
import { AssignShiftPage } from './AssignShiftPage';
import { EmployeeShiftsPage } from './EmployeeShiftsPage';

const employee = { id: 7, full_name: 'Ana Ruiz', first_name: 'Ana', last_name: 'Ruiz', employee_number: 'EMP-7', active: true } as Employee;

const morning: Shift = {
  id: 5,
  name: 'Matutino',
  start_time: '08:00:00',
  end_time: '16:00:00',
  overnight: false,
  weekdays: [0, 1, 2, 3, 4],
  breaks_count: 1,
  break_minutes: 30,
  early_check_in_minutes: 15,
  late_tolerance_minutes: 10,
  early_check_out_minutes: 0,
  late_check_out_minutes: 60,
  duration_minutes: 480,
  active: true,
  employees: 8,
  created_at: '2026-10-01T00:00:00Z',
};
const weekend: Shift = { ...morning, id: 6, name: 'Fin de semana', start_time: '22:00:00', end_time: '06:00:00', overnight: true, weekdays: [5, 6], breaks_count: 0, break_minutes: 0 };

const plant: WorkSite = {
  id: 3,
  name: 'Planta Norte',
  radius_m: 100,
  active: true,
  employees: 1,
  created_at: '2026-10-01T00:00:00Z',
  address: { street: 'Blvd. Kino', exterior_number: '100', interior_number: null, postal_code: '83150', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo', latitude: 29.1, longitude: -110.9 },
};
const siteRef = { id: 3, name: 'Planta Norte', latitude: 29.1, longitude: -110.9, radius_m: 100 };

const assignment = (id: number, extra: Partial<ShiftAssignment>): ShiftAssignment => ({
  id,
  shift: morning,
  valid_from: '2026-09-01',
  valid_to: null,
  remote_weekdays: [],
  sites: [siteRef],
  state: 'CURRENT',
  created_at: '2026-09-01T00:00:00Z',
  ...extra,
});
const scheduled = assignment(12, { shift: weekend, valid_from: '2026-11-02', state: 'SCHEDULED', remote_weekdays: [5, 6], sites: [] });
const current = assignment(11, { valid_to: '2026-11-01', remote_weekdays: [0] });
const ended = assignment(10, { valid_from: '2026-01-01', valid_to: '2026-08-31', state: 'ENDED' });

const page = <T,>(items: T[], total = items.length) => ({ items, total, page: 1, size: 10 });
const bodyOf = (call: MockCall | undefined) => JSON.parse(call?.init.body as string) as unknown;
/** Error de negocio con su campo (como lo envía el backend). */
const fieldFail = (status: number, code: string, message: string, field: string) => jsonResponse(envelope(null, { status, code, message, errors: [{ code, message, field, details: null }] }), status);
/** "YYYY-MM-DD" → lo que se escribe en el campo de fecha (dd/mm/aaaa). */
const typed = (iso: string) => iso.split('-').reverse().join('');
/** Filas de una sección de la confirmación ("Detalles"), como texto. */
const rows = (dialog: HTMLElement, region = 'Detalles') => within(within(dialog).getByRole('region', { name: region })).getAllByRole('listitem').map((row) => row.textContent);

afterEach(() => vi.unstubAllGlobals());

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/shifts/employees/:id" element={<EmployeeShiftsPage />} />
      <Route path="/company/shifts/employees/:id/assign" element={<AssignShiftPage />} />
    </Routes>,
    { route },
  );
}

describe('Turnos del empleado', () => {
  it('historial con su estado, días remotos y sitios; un cambio programado se cancela con confirmación', async () => {
    let deletes = 0;
    let lists = 0;
    // La lista que se vuelve a pedir tras cancelar llega cuando la prueba lo decide (se ve "cargando").
    let release: (response: Response) => void = () => undefined;
    const reload = new Promise<Response>((done) => {
      release = done;
    });
    const { calls } = mockFetch((call) => {
      if (call.init.method === 'DELETE') {
        deletes += 1;
        return deletes === 1 ? apiFail(409, 'ASSIGNMENT_STARTED', 'La asignación ya empezó') : apiOk(null);
      }
      if (!call.url.includes('/shift-assignments')) return apiOk(employee);
      lists += 1;
      return lists === 1 ? apiOk(page([scheduled, current, ended])) : reload;
    });
    renderAt('/company/shifts/employees/7');
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Expediente/ })).toHaveAttribute('href', '/company/employees/7');
    expect(screen.getByRole('link', { name: 'Asignar turno' })).toHaveAttribute('href', '/company/shifts/employees/7/assign');

    const items = await screen.findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Fin de semana');
    expect(items[0]).toHaveTextContent('22:00 – 06:00 (día siguiente) · Sáb y dom');
    expect(items[0]).toHaveTextContent(`Desde el ${formatDate('2026-11-02')}`);
    expect(items[0]).toHaveTextContent('Remoto: Sáb y dom · En sitio: ningún sitio');
    expect(within(items[0]).getByText('Programado')).toBeInTheDocument();
    expect(items[1]).toHaveTextContent(`Del ${formatDate('2026-09-01')} al ${formatDate('2026-11-01')}`);
    expect(items[1]).toHaveTextContent('Remoto: Lun · En sitio: Planta Norte');
    expect(within(items[1]).getByText('Vigente')).toBeInTheDocument();
    expect(items[2]).toHaveTextContent('Solo en sitio: Planta Norte');
    expect(within(items[2]).getByText('Terminado')).toBeInTheDocument();
    expect(within(items[1]).queryByRole('button')).toBeNull(); // solo lo programado se cancela

    const title = '¿Cancelar el cambio de Ana Ruiz al turno Fin de semana?';
    const cancel = () => userEvent.click(within(items[0]).getByRole('button', { name: 'Cancelar cambio' }));
    // Lo seguro primero: el foco empieza en "Conservar el cambio" y elegirlo no envía nada.
    await cancel();
    const keep = await screen.findByRole('alertdialog', { name: title });
    await waitFor(() => expect(within(keep).getByRole('button', { name: 'Conservar el cambio' })).toHaveFocus());
    await userEvent.click(within(keep).getByRole('button', { name: 'Conservar el cambio' }));
    expect(screen.queryByRole('alertdialog', { name: title })).toBeNull();
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    expect(within(items[0]).getByText('Programado')).toBeInTheDocument();
    expect(within(items[0]).getByRole('button', { name: 'Cancelar cambio' })).toBeEnabled();

    await cancel();
    const confirm = await screen.findByRole('alertdialog', { name: title });
    expect(confirm).toHaveTextContent('Ana Ruiz conservará el turno que tiene.');
    expect(rows(confirm)).toEqual(['Turno programado22:00 – 06:00 (día siguiente) · Sáb y dom', `Iba a aplicar desde${formatDate('2026-11-02')}`]);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar cambio' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo cancelar el cambio de turno' })).getByRole('button', { name: 'Entendido' }));

    await cancel();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: title })).getByRole('button', { name: 'Cancelar cambio' }));
    expect(await screen.findByRole('dialog', { name: 'Cambio de turno cancelado' })).toHaveTextContent('Ana Ruiz conserva el turno que tenía.');
    expect(calls.filter((c) => c.init.method === 'DELETE').map((c) => c.url)).toEqual(['/api/shift-assignments/12', '/api/shift-assignments/12']);
    await waitFor(() => expect(items[0].closest('ul')).toHaveClass('is-loading')); // se vuelve a pedir
    release(apiOk(page([current, ended])));
    await waitFor(() => expect(screen.queryByText('Fin de semana')).toBeNull());
    expect(calls.filter((c) => c.url.includes('/shift-assignments?'))).toHaveLength(2);
  });

  it('sin turnos invita a asignar uno; un empleado inactivo no se puede asignar', async () => {
    mockFetch((call) => (call.url.includes('/shift-assignments') ? apiOk(page([])) : apiOk(employee)));
    const { unmount } = renderAt('/company/shifts/employees/7');
    expect(await screen.findByText('Sin turno asignado')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Asignar turno' })).toHaveLength(2);
    unmount();

    mockFetch((call) => (call.url.includes('/shift-assignments') ? apiOk(page([])) : apiOk({ ...employee, active: false })));
    renderAt('/company/shifts/employees/7');
    expect(await screen.findByText(/El empleado está inactivo/)).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Asignar turno' })).toBeNull();
  });

  it('si el empleado no carga ofrece volver a cargar', async () => {
    let attempts = 0;
    mockFetch((call) => {
      if (call.url.includes('/shift-assignments')) return apiOk(page([]));
      attempts += 1;
      return attempts === 1 ? apiFail(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado') : apiOk(employee);
    });
    renderAt('/company/shifts/employees/7');
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar el empleado' });
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: 'Turnos del empleado' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
  });
});

/** Servidor de la asignación: empleado, turnos activos, sitios activos, historial y el alta. */
function assignServer(history: ReturnType<typeof page<ShiftAssignment>>, post: (call: MockCall) => Response, shifts = [morning, weekend]) {
  return mockFetch((call) => {
    if (call.url.startsWith('/api/sites')) return apiOk(page([plant]));
    if (call.url.startsWith('/api/shifts')) return apiOk(page(shifts));
    if (call.url.includes('/shift-assignments')) return call.init.method === 'POST' ? post(call) : apiOk(history);
    return apiOk(employee);
  });
}

async function chooseShift(name: string) {
  await userEvent.click(screen.getByRole('button', { name: /^Turno/ }));
  await userEvent.click(screen.getByRole('option', { name: new RegExp(name) }));
}

/** Pide asignar y devuelve la confirmación abierta (todavía sin responder). */
async function askAssign(title: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Asignar turno' }));
  return screen.findByRole('dialog', { name: title });
}

/** Pide asignar y lo confirma. */
async function assign(title: string) {
  await userEvent.click(within(await askAssign(title)).getByRole('button', { name: 'Asignar turno' }));
}

describe('Asignar turno', () => {
  it('primer turno: desde hoy, días remotos dentro del turno y sitios; vuelve a sus turnos con aviso', async () => {
    const { calls } = assignServer(page([]), () => apiOk(assignment(20, { valid_from: businessToday() }), { status: 201 }));
    renderAt('/company/shifts/employees/7/assign');
    expect(await screen.findByText('Ana Ruiz · EMP-7')).toBeInTheDocument();
    expect(screen.getByLabelText(/Aplica desde/)).toHaveValue(typed(businessToday()).replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3'));
    expect(screen.getByText('Su primer turno puede empezar hoy.')).toBeInTheDocument();
    expect(screen.getByText(/Elige primero el turno/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'lunes' })).toBeDisabled();

    await chooseShift('Matutino');
    expect(screen.getByText('08:00 – 16:00 · Lun a vie · 1 × 30 min')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sábado' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'lunes' }));
    expect(screen.getByText(/Obligatorio: los días que no son remotos/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('checkbox', { name: /Planta Norte/ }));

    // Se confirma qué turno, desde cuándo, qué días remotos y dónde checa; cancelar no envía nada.
    const title = '¿Asignar el turno Matutino a Ana Ruiz?';
    const confirm = await askAssign(title);
    expect(confirm.querySelector('.msg__eyebrow')).toHaveTextContent('Asignar turno');
    expect(rows(confirm)).toEqual(['Horario08:00 – 16:00 · Lun a vie', `Aplica desde${formatDate(businessToday())}`, 'Días remotosLun', 'Sitios donde checaPlanta Norte']);
    expect(confirm.querySelector('.confirm-note')).toBeNull(); // primer turno: no hay un turno actual que termine
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog', { name: title })).toBeNull();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    expect(screen.getByRole('button', { name: 'lunes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: /Planta Norte/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Asignar turno' })).toBeEnabled();
    await assign(title);

    expect(await screen.findByRole('dialog', { name: 'Turno asignado' })).toHaveTextContent(`Ana Ruiz tendrá el turno Matutino desde el ${formatDate(businessToday())}.`);
    expect(screen.queryByText('Su turno actual termina el día anterior.')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument(); // sus turnos
    expect(bodyOf(calls.find((c) => c.init.method === 'POST'))).toEqual({ shift_id: 5, valid_from: businessToday(), remote_weekdays: [0], site_ids: [3] });
  });

  it('cambio de turno: desde mañana; lo que falta, los errores del servidor y el aviso al guardar', async () => {
    let posts = 0;
    const { calls } = assignServer(page([scheduled], 3), () => {
      posts += 1;
      if (posts === 1) return fieldFail(422, 'SITE_REQUIRED', 'Elige al menos un sitio donde checar los días que no son remotos', 'site_ids');
      if (posts === 2) return apiFail(409, 'ASSIGNMENT_ALREADY_SCHEDULED', 'Ya hay un cambio de turno programado: cancélalo primero');
      return apiOk(assignment(21, { shift: weekend, valid_from: businessTomorrow(), state: 'SCHEDULED' }), { status: 201 });
    });
    renderAt('/company/shifts/employees/7/assign');
    const date = await screen.findByLabelText(/Aplica desde/);
    expect(date).toHaveValue(typed(businessTomorrow()).replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3'));
    expect(screen.getByText(/Ya tiene turno: el cambio aplica desde mañana/)).toHaveTextContent(`Ya tiene un cambio programado a Fin de semana desde el ${formatDate('2026-11-02')}`);

    // Sin turno y con una fecha de hoy: se explica antes de enviar.
    await userEvent.clear(date);
    await userEvent.type(date, typed(businessToday()));
    await userEvent.click(screen.getByRole('button', { name: 'Asignar turno' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa la información' });
    expect(popup).toHaveTextContent('Elige el turno');
    expect(popup).toHaveTextContent('Elige desde mañana: un cambio de turno se programa con un día de anticipación.');
    expect(screen.queryByRole('dialog', { name: /^¿Asignar/ })).toBeNull(); // lo inválido no se confirma
    await userEvent.click(within(popup).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Elige el turno')).toBeInTheDocument();

    await chooseShift('Matutino');
    expect(screen.queryByText('Elige el turno')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'lunes' }));
    await chooseShift('Fin de semana'); // el lunes ya no es día del turno: se descarta
    expect(screen.getByRole('button', { name: 'lunes' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.clear(date);
    await userEvent.type(date, typed(businessTomorrow()));
    await userEvent.click(await screen.findByRole('checkbox', { name: /Planta Norte/ }));
    // Ya tiene turno: la confirmación es de un cambio de turno y dice que el actual termina el día anterior.
    const title = '¿Asignar el turno Fin de semana a Ana Ruiz?';
    const confirm = await askAssign(title);
    expect(confirm.querySelector('.msg__eyebrow')).toHaveTextContent('Cambio de turno');
    expect(rows(confirm)).toEqual(['Horario22:00 – 06:00 (día siguiente) · Sáb y dom', `Aplica desde${formatDate(businessTomorrow())}`, 'Días remotosNinguno', 'Sitios donde checaPlanta Norte']);
    expect(confirm.querySelector('.confirm-note')).toHaveTextContent('Su turno actual termina el día anterior; lo ya registrado conserva su turno.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Asignar turno' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo asignar el turno' })).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Elige al menos un sitio donde checar los días que no son remotos')).toBeInTheDocument();

    // Todos los días remotos: los sitios ya no hacen falta.
    await userEvent.click(screen.getByRole('button', { name: 'Todos sus días' }));
    expect(screen.getByText('Elige al menos un sitio donde checar los días que no son remotos')).toBeInTheDocument(); // el del servidor sigue hasta cambiar los sitios
    await userEvent.click(screen.getByRole('checkbox', { name: /Planta Norte/ }));
    expect(screen.queryByText('Elige al menos un sitio donde checar los días que no son remotos')).toBeNull();
    expect(screen.getByText(/Opcional: todos los días del turno son remotos/)).toBeInTheDocument();
    const remote = await askAssign(title);
    expect(rows(remote).slice(2)).toEqual(['Días remotosSáb y dom', 'Sitios donde checaNinguno: todos sus días son remotos']);
    await userEvent.click(within(remote).getByRole('button', { name: 'Asignar turno' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo asignar el turno' })).getByRole('button', { name: 'Entendido' }));
    await assign(title);

    const done = await screen.findByRole('dialog', { name: 'Turno asignado' });
    expect(done).toHaveTextContent('Su turno actual termina el día anterior.');
    expect(bodyOf(calls.filter((c) => c.init.method === 'POST').at(-1))).toEqual({ shift_id: 6, valid_from: businessTomorrow(), remote_weekdays: [5, 6], site_ids: [] });
  });

  it('sin turnos activos invita a crear uno y no deja enviar', async () => {
    assignServer(page([]), () => apiOk(null), []);
    renderAt('/company/shifts/employees/7/assign');
    expect(await screen.findByText('No hay turnos activos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo turno' })).toHaveAttribute('href', '/company/shifts/new');
    expect(screen.getByRole('button', { name: 'Asignar turno' })).toBeDisabled();
  });

  it('si no se puede preparar ofrece volver a cargar; cancelar regresa a sus turnos', async () => {
    let attempts = 0;
    mockFetch((call) => {
      if (call.url.startsWith('/api/sites')) return apiOk(page([plant]));
      if (call.url.startsWith('/api/shifts')) {
        attempts += 1;
        return attempts === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Falla inesperada') : apiOk(page([morning]));
      }
      return call.url.includes('/shift-assignments') ? apiOk(page([])) : apiOk(employee);
    });
    renderAt('/company/shifts/employees/7/assign');
    await screen.findByRole('alertdialog', { name: 'No se pudo preparar la asignación' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
  });
});
