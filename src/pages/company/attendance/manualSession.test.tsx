import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { workSession } from '../../../components/attendance/employee/testData';
import { paths } from '../../../routes/paths';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { AttendanceBoard, BoardRow, CompanySessionDetail } from '../../../types';
import { businessToday } from '../../../utils/format';
import { ManualSessionPage } from './ManualSessionPage';

type Responder = (call: MockCall) => Response | Promise<Response>;

const today = businessToday();
const carla = { id: 9, full_name: 'Carla Díaz', employee_number: 'EMP-9' };
const employee = { ...carla, first_name: 'Carla', last_name: 'Díaz', email: 'carla@empresa.com', active: true };
/** Turno de 08:00 a 16:00 (hora del Centro, UTC−6) del 2 de octubre. */
const scheduled = { shift_name: 'Matutino', scheduled_start: '2026-10-02T14:00:00Z', scheduled_end: '2026-10-02T22:00:00Z' };
const row = (overrides: Partial<BoardRow> = {}): BoardRow => ({ employee: carla, department: null, ...scheduled, state: 'ABSENT', session: null, ...overrides });
// Otro empleado cuyo número también contiene "EMP-9": la búsqueda lo trae, pero no es Carla.
const other = row({ employee: { id: 90, full_name: 'Otro', employee_number: 'EMP-90' }, state: 'DONE' });
const board = (items: BoardRow[], date = '2026-10-02'): AttendanceBoard => ({ items, total: items.length, page: 1, size: 50, work_date: date, working: 0, on_break: 0, done: 0, missed_checkout: 0 });

const session = workSession({ id: 32, work_date: '2026-10-02', ...scheduled, check_out_deadline: '2026-10-02T23:00:00Z', check_in_at: '2026-10-02T14:25:00Z', check_in_mode: 'REMOTE', check_in_site: null });
const detail = (overrides: Partial<CompanySessionDetail> = {}): CompanySessionDetail => ({
  ...session,
  breaks: [{ started_at: '2026-10-02T18:00:00Z', ended_at: '2026-10-02T18:30:00Z', minutes: 30, exceeded_minutes: 0 }],
  employee: { id: 8, full_name: 'Beto López', employee_number: 'EMP-8' },
  events: [],
  ...overrides,
});

/** La pantalla con sus rutas; cada endpoint responde con su función (por omisión, lo normal). */
function renderAt(route: string, overrides: Record<string, Responder> = {}) {
  const server = mockFetch((call) => {
    const path = call.url.split('?')[0];
    const key = `${call.init.method ?? 'GET'} ${path}`;
    if (overrides[key]) return overrides[key](call);
    if (key === 'GET /api/employees/9') return apiOk(employee);
    if (key === 'GET /api/attendance/board') return apiOk(board([other, row()]));
    if (key === 'POST /api/attendance/sessions') return apiOk(detail({ id: 40 }), { status: 201 });
    if (key === 'GET /api/attendance/sessions/32') return apiOk(detail());
    if (key === 'PUT /api/attendance/sessions/32') return apiOk(detail());
    return apiFail(404, 'NOT_FOUND', 'No existe');
  });
  renderWithProviders(
    <Routes>
      <Route path={paths.company.attendance} element={<p>Tablero del día</p>} />
      <Route path={paths.company.newAttendanceSession} element={<ManualSessionPage />} />
      <Route path={paths.company.correctAttendanceSession(':id')} element={<ManualSessionPage />} />
      <Route path={paths.company.attendanceSession(':id')} element={<p>Detalle de la jornada</p>} />
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

/** Error de validación del servidor marcado en un campo. */
const fieldFail = (status: number, code: string, message: string, field: string | null) =>
  jsonResponse(envelope(null, { status, code, message, errors: [{ code, message, field, details: null }] }), status);

const NEW_ROUTE = `${paths.company.newAttendanceSession}?employee=9&date=2026-10-02`;
const entry = () => screen.getByLabelText('Hora de entrada');
const exit = () => screen.getByLabelText('Hora de salida');
const reason = (label = '¿Por qué la registras tú?') => screen.getByLabelText(label);
const submit = (name = 'Registrar asistencia') => userEvent.click(screen.getByRole('button', { name }));
const posted = (calls: MockCall[], method = 'POST') => JSON.parse(calls.find((call) => call.init.method === method)?.init.body as string) as Record<string, unknown>;
const dialogCount = () => screen.queryAllByRole('alertdialog').length;
const REGISTER_TITLE = '¿Registrar la asistencia de Carla Díaz?';
const CORRECT_TITLE = '¿Corregir la jornada de Beto López del 2 oct 2026?';
/** Lo que dice cada fila de una sección de la confirmación ("Entrada08:00"). */
const rows = (dialog: HTMLElement, region: string) => within(within(dialog).getByRole('region', { name: region })).getAllByRole('listitem').map((li) => li.textContent);
/** Envía y devuelve la confirmación (registrar o corregir). */
async function ask(title = REGISTER_TITLE, button = 'Registrar asistencia') {
  await submit(button);
  return screen.findByRole('dialog', { name: title });
}
/** Envía y confirma en el popup (su botón dice lo mismo que el del formulario). */
async function submitConfirmed(title = REGISTER_TITLE, button = 'Registrar asistencia') {
  await userEvent.click(within(await ask(title, button)).getByRole('button', { name: button }));
}

describe('ManualSessionPage: la empresa registra la asistencia de un empleado', () => {
  it('su turno ese día, valida, sugiere el horario, confirma y registra entrada, salida, descansos y motivo', async () => {
    const { calls } = renderAt(NEW_ROUTE);
    expect(await screen.findByRole('heading', { name: 'Registrar asistencia' })).toBeInTheDocument();
    expect(screen.getByText('Carla Díaz · EMP-9')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Asistencia del día/ })).toHaveAttribute('href', '/company/attendance?date=2026-10-02');
    expect(await screen.findByText('Turno Matutino: 08:00 – 16:00.')).toBeInTheDocument();
    const lookup = calls.find((call) => call.url.startsWith('/api/attendance/board'));
    expect(lookup?.url).toContain('date=2026-10-02');
    expect(lookup?.url).toContain('search=EMP-9');
    expect(screen.getByLabelText('Día que trabajó')).toHaveValue('02/10/2026');
    expect(screen.getByText('Programada a las 08:00')).toBeInTheDocument();
    expect(screen.getByText('Programada a las 16:00; de madrugada cuenta como el día siguiente')).toBeInTheDocument();
    expect(screen.getByText(/Los que tomó, según su turno \(máximo 6\)/)).toBeInTheDocument();

    // Sin datos: el popup lo resume y los campos quedan marcados.
    await submit();
    expect(await screen.findByText('Revisa los datos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Indica la hora de entrada')).toBeInTheDocument();
    expect(screen.getByText('Indica la hora de salida o marca «Aún no sale»')).toBeInTheDocument();
    expect(screen.getByText('Explica el motivo (al menos 5 caracteres)')).toBeInTheDocument();

    // La entrada programada, de un toque en el selector; la salida escrita.
    await userEvent.click(within(entry().closest('.field') as HTMLElement).getByRole('button', { name: 'Elegir hora' }));
    await userEvent.click(screen.getByRole('button', { name: '08:00 (programada)' }));
    expect(entry()).toHaveValue('08:00');
    await userEvent.type(exit(), '1600');

    // Un descanso a medias se marca; completo, se envía.
    await userEvent.click(screen.getByRole('button', { name: 'Agregar descanso' }));
    await userEvent.type(screen.getByLabelText('Inicio'), '1200');
    await submit();
    expect(await screen.findByText('Revisa los datos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Indica el inicio y el fin de cada descanso (o quítalo)')).toBeInTheDocument();
    expect(screen.getByText('Indica la hora')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Fin'), '1230');

    // Motivo sugerido del catálogo.
    await userEvent.click(screen.getByRole('button', { name: 'Olvidó checar' }));
    expect(reason()).toHaveValue('Olvidó checar');

    // Antes de enviar pregunta con lo que se guardará; "Cancelar" no envía nada y deja el formulario como estaba.
    const confirm = await ask();
    expect(confirm).toHaveTextContent('Queda registrada por la empresa, sin rostro ni ubicación: la respalda el motivo.');
    expect(rows(confirm, 'Detalles')).toEqual(['Día2 oct 2026', 'Entrada08:00', 'Salida16:00', 'Descansos12:00 – 12:30', 'Motivo que veráOlvidó checar']);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false);
    expect(screen.queryByText('Asistencia registrada')).toBeNull();
    expect(entry()).toHaveValue('08:00');
    expect(exit()).toHaveValue('16:00');
    expect(reason()).toHaveValue('Olvidó checar');
    expect(screen.getByRole('button', { name: 'Registrar asistencia' })).toBeEnabled();

    await submitConfirmed();
    expect(await screen.findByText('Asistencia registrada')).toBeInTheDocument();
    expect(screen.getByText('La jornada de Carla Díaz del 2 oct 2026 quedó registrada.')).toBeInTheDocument();
    expect(posted(calls)).toEqual({
      check_in: '08:00',
      check_out: '16:00',
      breaks: [{ start: '12:00', end: '12:30' }],
      reason: 'Olvidó checar',
      employee_id: 9,
      work_date: '2026-10-02',
    });
    expect(await screen.findByText('Detalle de la jornada')).toBeInTheDocument();
  });

  it('sin número de empleado (opcional): se nombra solo por su nombre y su turno se busca por su nombre', async () => {
    const unnumbered = { ...carla, employee_number: null };
    const { calls } = renderAt(NEW_ROUTE, {
      'GET /api/employees/9': () => apiOk({ ...employee, employee_number: null }),
      'GET /api/attendance/board': () => apiOk(board([other, row({ employee: unnumbered })])),
    });
    expect(await screen.findByRole('heading', { name: 'Registrar asistencia' })).toBeInTheDocument();
    expect(screen.getByText('Carla Díaz')).toBeInTheDocument();
    expect(await screen.findByText('Turno Matutino: 08:00 – 16:00.')).toBeInTheDocument();
    const lookup = calls.find((call) => call.url.startsWith('/api/attendance/board'));
    expect(new URL(lookup?.url ?? '', 'http://localhost').searchParams.get('search')).toBe('Carla Díaz');
  });

  it('errores del servidor en su campo (se limpian al cambiarlo); "Aún no sale" envía sin salida', async () => {
    const { calls } = renderAt(NEW_ROUTE, {
      'POST /api/attendance/sessions': inOrder(
        fieldFail(422, 'CHECK_IN_OUTSIDE_SHIFT', 'La entrada se registra entre las 07:45 y las 16:00', 'check_in'),
        fieldFail(422, 'CHECK_OUT_AFTER_DEADLINE', 'La salida se registra a más tardar a las 17:00', 'check_out'),
        apiFail(409, 'DAY_OFF', 'Vacaciones: el 02/10/2026 es día libre para Carla Díaz. Si sí trabajó, márcalo como laborable en Calendario y luego registra su asistencia.'),
        apiOk(detail({ id: 41 }), { status: 201 }),
      ),
    });
    await screen.findByText('Turno Matutino: 08:00 – 16:00.');
    await userEvent.type(entry(), '0700');
    await userEvent.type(exit(), '1800');
    await userEvent.type(reason(), 'Falla de su teléfono');

    await submitConfirmed();
    expect(await screen.findByText('No se pudo registrar la asistencia')).toBeInTheDocument();
    expect(screen.getAllByText('La entrada se registra entre las 07:45 y las 16:00').length).toBeGreaterThan(1);
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await userEvent.clear(entry());
    await userEvent.type(entry(), '0750');
    expect(screen.queryByText('La entrada se registra entre las 07:45 y las 16:00')).toBeNull();

    await submitConfirmed();
    expect(await screen.findByText('La salida se registra a más tardar a las 17:00', { selector: '.field__error' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    // "Aún no sale" quita el error de la salida y la deja sin capturar.
    await userEvent.click(screen.getByText('Aún no sale'));
    expect(screen.queryByText('La salida se registra a más tardar a las 17:00', { selector: '.field__error' })).toBeNull();
    expect(exit()).toBeDisabled();
    expect(exit()).toHaveValue('');

    // La confirmación dice que aún no sale y que no tomó descansos.
    const stillWorking = await ask();
    expect(rows(stillWorking, 'Detalles')).toEqual(['Día2 oct 2026', 'Entrada07:50', 'SalidaAún no sale', 'DescansosSin descansos', 'Motivo que veráFalla de su teléfono']);
    // Día libre: el popup lo explica y el día queda marcado.
    await userEvent.click(within(stillWorking).getByRole('button', { name: 'Registrar asistencia' }));
    expect(await screen.findAllByText(/es día libre para Carla Díaz/)).not.toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText(/es día libre para Carla Díaz/, { selector: '.field__error' })).toBeInTheDocument();

    await submitConfirmed();
    expect(await screen.findByText('Asistencia registrada')).toBeInTheDocument();
    const bodies = calls.filter((call) => call.init.method === 'POST').map((call) => JSON.parse(call.init.body as string) as Record<string, unknown>);
    expect(bodies.at(-1)).toMatchObject({ check_in: '07:50', check_out: null, breaks: [], reason: 'Falla de su teléfono' });
  });

  it('al cambiar el día consulta su turno: libre, ya registrado, sin turno, sin respuesta o a medias', async () => {
    let release: () => void = () => undefined;
    const boardFor: Responder = (call) => {
      const date = new URL(call.url, 'http://test').searchParams.get('date');
      if (date === '2026-10-02') return new Promise((resolve) => (release = () => resolve(apiOk(board([other, row()])))));
      if (date === '2026-10-01') return apiOk(board([row({ state: 'DAY_OFF', day_off: { kind: 'VACATION', name: 'Vacaciones', work_date: '2026-10-01', starts_on: '2026-09-28', ends_on: '2026-10-02' } })]));
      if (date === '2026-09-30') return apiOk(board([row({ state: 'DAY_OFF' })]));
      if (date === '2026-09-29') return apiOk(board([row({ state: 'DONE', session: detail() })]));
      if (date === '2026-09-28') return apiOk(board([other]));
      return apiFail(500, 'INTERNAL_ERROR', 'Falló');
    };
    renderAt(NEW_ROUTE, { 'GET /api/attendance/board': boardFor });
    expect(await screen.findByText('Consultando su turno…')).toBeInTheDocument();
    release();
    expect(await screen.findByText('Turno Matutino: 08:00 – 16:00.')).toBeInTheDocument();

    const day = screen.getByLabelText('Día que trabajó');
    const pick = async (typed: string) => {
      await userEvent.clear(day);
      await userEvent.type(day, typed);
    };
    await pick('01102026');
    expect(await screen.findByText('Turno Matutino: 08:00 – 16:00. Es día libre (Vacaciones). Si trabajó, márcalo como laborable en Calendario.')).toBeInTheDocument();
    await pick('30092026');
    expect(await screen.findByText('Turno Matutino: 08:00 – 16:00. Es día libre. Si trabajó, márcalo como laborable en Calendario.')).toBeInTheDocument();
    await pick('29092026');
    expect(await screen.findByText('Turno Matutino: 08:00 – 16:00. Ya tiene jornada registrada; corrígela en vez de registrar otra.')).toBeInTheDocument();
    await pick('28092026');
    expect(await screen.findByText('No tiene turno ese día; elige un día de su turno.')).toBeInTheDocument();
    // Sin horario no hay sugerencias.
    expect(screen.queryByText(/Programada a las/)).toBeNull();
    expect(screen.getByText('De madrugada cuenta como el día siguiente')).toBeInTheDocument();
    // Si no se puede consultar, no abre un popup: lo dice bajo el día y se registra igual.
    await pick('27092026');
    expect(await screen.findByText('No se pudo consultar su turno; se validará al registrar.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.clear(day);
    await userEvent.type(day, '0109');
    expect(await screen.findByText('El día de su turno (hasta hoy).')).toBeInTheDocument();
  });

  it('un día inválido o futuro en el enlace usa hoy; "Cancelar" regresa al tablero', async () => {
    const { calls } = renderAt(`${paths.company.newAttendanceSession}?employee=9&date=2999-01-01`);
    await screen.findByRole('heading', { name: 'Registrar asistencia' });
    await waitFor(() => expect(calls.some((call) => call.url.includes(`date=${today}`))).toBe(true));
    expect(screen.getByRole('link', { name: /Asistencia del día/ })).toHaveAttribute('href', `/company/attendance?date=${today}`);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Tablero del día')).toBeInTheDocument();
  });

  it('un día futuro escrito se marca; una fecha que no existe en el enlace usa hoy', async () => {
    renderAt(`${paths.company.newAttendanceSession}?employee=9&date=2026-02-31`);
    const day = await screen.findByLabelText('Día que trabajó');
    expect(day).toHaveValue(today.split('-').reverse().join('/'));
    await userEvent.clear(day);
    await userEvent.type(day, '01012999');
    await submit();
    expect(await screen.findByText('Revisa los datos')).toBeInTheDocument();
    expect(screen.getAllByText('No puede ser un día futuro').length).toBeGreaterThan(0);
  });

  it('sin día en el enlace: hoy', async () => {
    renderAt(`${paths.company.newAttendanceSession}?employee=9`);
    expect(await screen.findByLabelText('Día que trabajó')).toHaveValue(today.split('-').reverse().join('/'));
  });

  it('sin empleado (o uno que no es un número) en el enlace: explica que se registra desde el tablero', async () => {
    const { calls } = renderAt(paths.company.newAttendanceSession);
    expect(await screen.findByText('Elige a quién registrar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al tablero' })).toHaveAttribute('href', paths.company.attendance);
    expect(calls).toHaveLength(0);
  });

  it('un empleado que no es un número tampoco se consulta', async () => {
    const { calls } = renderAt(`${paths.company.newAttendanceSession}?employee=abc&date=2026-10-02`);
    expect(await screen.findByText('Elige a quién registrar')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('si el empleado no se puede cargar: popup y "Volver a cargar"', async () => {
    renderAt(NEW_ROUTE, { 'GET /api/employees/9': inOrder(apiFail(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado'), apiOk(employee)) });
    expect(await screen.findByText('No se pudo cargar al empleado')).toBeInTheDocument();
    expect(screen.getByText('Empleado no encontrado')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(screen.getByRole('link', { name: /Asistencia del día/ })).toHaveAttribute('href', '/company/attendance?date=2026-10-02');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Carla Díaz · EMP-9')).toBeInTheDocument();
  });
});

const CORRECT_ROUTE = paths.company.correctAttendanceSession(32);

describe('ManualSessionPage: la empresa corrige una jornada', () => {
  it('trae lo registrado, corrige la salida y los descansos, confirma lo que cambia y vuelve a la jornada', async () => {
    const { calls } = renderAt(CORRECT_ROUTE);
    expect(await screen.findByRole('heading', { name: 'Corregir jornada' })).toBeInTheDocument();
    expect(screen.getByText('Beto López · 2 oct 2026 · Matutino')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Jornada/ })).toHaveAttribute('href', '/company/attendance/sessions/32');
    expect(screen.queryByLabelText('Día que trabajó')).toBeNull();
    expect(entry()).toHaveValue('08:25');
    // Abierta: sigue sin salida.
    expect(exit()).toBeDisabled();
    expect(screen.getByLabelText('Inicio')).toHaveValue('12:00');
    expect(screen.getByLabelText('Fin')).toHaveValue('12:30');
    expect(screen.getByText('Su turno permite 2 descansos')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Aún no sale'));
    await userEvent.type(exit(), '1540');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar descanso' }));
    expect(screen.getByRole('button', { name: 'Agregar descanso' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el descanso 2' }));
    await userEvent.type(reason('¿Por qué la corriges?'), 'Registro equivocado de la salida');

    // Pregunta con lo que cambia ("antes → después"), el motivo y que lo anterior se conserva; "Cancelar" no envía nada.
    const confirm = await ask(CORRECT_TITLE, 'Guardar corrección');
    expect(rows(confirm, 'Cambios')).toEqual(['SalidaAntes: Aún no saleDespués: 15:40']);
    expect(rows(confirm, 'Detalles')).toEqual(['Motivo que veráRegistro equivocado de la salida']);
    expect(within(confirm).getByText('Lo anterior queda en la bitácora y el empleado verá el motivo.').closest('.confirm-note')).not.toBeNull();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls.some((call) => call.init.method === 'PUT')).toBe(false);
    expect(exit()).toHaveValue('15:40');
    expect(reason('¿Por qué la corriges?')).toHaveValue('Registro equivocado de la salida');
    expect(screen.getByRole('button', { name: 'Guardar corrección' })).toBeEnabled();

    await submitConfirmed(CORRECT_TITLE, 'Guardar corrección');
    expect(await screen.findByText('Jornada corregida')).toBeInTheDocument();
    expect(screen.getByText('Lo anterior queda en la bitácora de Beto López.')).toBeInTheDocument();
    expect(posted(calls, 'PUT')).toEqual({ check_in: '08:25', check_out: '15:40', breaks: [{ start: '12:00', end: '12:30' }], reason: 'Registro equivocado de la salida' });
    expect(await screen.findByText('Detalle de la jornada')).toBeInTheDocument();
  });

  it('solo con el motivo (sin cambiar horas): avisa "Sin cambios" y no envía nada', async () => {
    const { calls } = renderAt(CORRECT_ROUTE);
    await screen.findByRole('heading', { name: 'Corregir jornada' });
    await userEvent.type(reason('¿Por qué la corriges?'), 'Olvidó checar');
    await submit('Guardar corrección');
    expect(await screen.findByRole('dialog', { name: 'Sin cambios' })).toHaveTextContent('No hay nada que guardar');
    expect(screen.queryByRole('dialog', { name: CORRECT_TITLE })).toBeNull();
    expect(calls.some((call) => call.init.method === 'PUT' || call.init.method === 'POST')).toBe(false);
    expect(screen.queryByText('Jornada corregida')).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar corrección' })).toBeEnabled();
    expect(entry()).toHaveValue('08:25');
  });

  it('un error de los descansos se marca en el grupo y se limpia al editarlos; "Cancelar" vuelve a la jornada', async () => {
    renderAt(CORRECT_ROUTE, { 'PUT /api/attendance/sessions/32': () => fieldFail(422, 'BREAKS_OVERLAP', 'Los descansos no se pueden encimar', 'breaks') });
    await screen.findByRole('heading', { name: 'Corregir jornada' });
    // Corrige la entrada (sin un cambio no hay nada que enviar).
    await userEvent.clear(entry());
    await userEvent.type(entry(), '0820');
    await userEvent.type(reason('¿Por qué la corriges?'), 'Olvidó checar');
    const confirm = await ask(CORRECT_TITLE, 'Guardar corrección');
    expect(rows(confirm, 'Cambios')).toEqual(['EntradaAntes: 08:25Después: 08:20']);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Guardar corrección' }));
    expect(await screen.findByText('No se pudo corregir la jornada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Los descansos no se pueden encimar', { selector: '.field__error' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el descanso 1' }));
    expect(screen.queryByText('Los descansos no se pueden encimar', { selector: '.field__error' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Detalle de la jornada')).toBeInTheDocument();
  });

  it('si la jornada no se puede cargar: popup, "Volver a cargar" y regreso a la jornada', async () => {
    renderAt(CORRECT_ROUTE, { 'GET /api/attendance/sessions/32': inOrder(apiFail(404, 'WORK_SESSION_NOT_FOUND', 'Jornada no encontrada'), apiOk(detail({ status: 'MISSED_CHECKOUT' }))) });
    expect(await screen.findByText('No se pudo cargar la jornada')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(screen.getByRole('heading', { name: 'Corregir jornada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Jornada/ })).toHaveAttribute('href', '/company/attendance/sessions/32');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    // Venció sin salida: la salida se escribe.
    expect(await screen.findByLabelText('Hora de salida')).toBeEnabled();
    expect(dialogCount()).toBe(0);
  });
});
