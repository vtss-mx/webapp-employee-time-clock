import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attendanceToday, breakWindow, dayOff, NOW, workSession } from '../../../components/attendance/employee/testData';
import { paths } from '../../../routes/paths';
import { apiFail, apiOk, mockFetch } from '../../../test/http';
import { renderWithProviders, sampleUser } from '../../../test/render';
import type { AttendanceToday, User } from '../../../types';
import { MyAttendancePage } from './MyAttendancePage';

const auth = vi.hoisted(() => ({ user: null as User | null }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => auth }));

const next = { work_date: '2026-10-06', start: '2026-10-06T14:00:00Z', end: '2026-10-06T22:00:00Z', opens: '2026-10-06T13:45:00Z', deadline: '2026-10-06T23:00:00Z' };
const completedBreak = { started_at: '2026-10-05T16:00:00Z', ended_at: '2026-10-05T16:30:00Z', minutes: 30, exceeded_minutes: 0 };

/** La pantalla del registro (ubicación y cámara): basta saber a qué registro llegó. */
function RecordScreen() {
  const { action } = useParams();
  return <h1>Pantalla de registro: {action}</h1>;
}

/** "Mi asistencia" con las respuestas de GET /me/attendance/today en orden (la última se repite). */
function renderPage(...responses: Array<AttendanceToday | Response>) {
  const server = mockFetch(...responses.map((item) => (item instanceof Response ? item : apiOk(item))));
  renderWithProviders(
    <Routes>
      <Route path={paths.employee.attendance} element={<MyAttendancePage />} />
      <Route path={paths.employee.recordAttendance(':action')} element={<RecordScreen />} />
    </Routes>,
    { route: paths.employee.attendance },
  );
  return server;
}

const clock = () => within(screen.getByRole('region', { name: 'Reloj checador' }));
const clockText = (text: string | RegExp, options?: { timeout: number }) => screen.findByText(text, { selector: '.time-clock__note' }, options);
const action = (name: string) => clock().getByRole('button', { name });

/** Toca un botón del reloj y devuelve su confirmación ("¿Registrar tu entrada?"). */
async function askRecord(name: string, title: string) {
  await userEvent.click(action(name));
  return screen.findByRole('dialog', { name: title });
}

beforeEach(() => {
  auth.user = sampleUser;
});

describe('MyAttendancePage (inicio del empleado: su reloj checador)', () => {
  it('en turno: saludo, turno, estado y retardo, lo que corre, lo trabajado, botones, jornada, sitios y enlaces', async () => {
    const { calls } = renderPage(
      attendanceToday({
        now: '2026-10-05T17:00:00Z',
        occurrence: null,
        session: workSession({ late_minutes: 12, breaks: [completedBreak], break_minutes: 30 }),
        actions: ['BREAK_START', 'CHECK_OUT'],
        message: 'En turno desde las 07:55; tu salida es a las 16:00.',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(calls[0].url).toBe('/api/me/attendance/today');
    expect(screen.getByText('5 oct 2026')).toBeInTheDocument();
    expect(clock().getByText('Matutino')).toBeInTheDocument();
    expect(clock().getByText('08:00 – 16:00')).toBeInTheDocument();
    expect(clock().getByText('Lun a vie')).toBeInTheDocument();
    expect(clock().getByText('En turno')).toBeInTheDocument();
    expect(clock().getByText('12 min de retardo')).toBeInTheDocument();
    expect(clock().getByText('En turno desde las 07:55; tu salida es a las 16:00.')).toBeInTheDocument();
    expect(clock().getByText('Tu salida es en')).toBeInTheDocument();
    expect(clock().getByText('5 h')).toBeInTheDocument();
    expect(clock().getByText('Entrada').nextSibling).toHaveTextContent('07:55 En sitio · Planta Norte');
    expect(clock().getByText('Trabajado').nextSibling).toHaveTextContent('2 h 35 min'); // 07:55 a 11:00 menos 30 min
    expect(clock().getByText('Descansos').nextSibling).toHaveTextContent('1 de 2 de 30 min cada uno');
    expect(action('Registrar inicio de descanso')).toHaveClass('btn--light');
    expect(action('Registrar salida')).toHaveClass('btn--ghost');
    expect(screen.getByRole('heading', { name: /Tu jornada/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Dónde puedes checar hoy/ })).toBeInTheDocument();
    expect(screen.getByText('Dentro de 150 m de su ubicación')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Historial' })).toHaveAttribute('href', paths.employee.attendanceHistory);
    expect(screen.getByRole('link', { name: 'Cambio de turno' })).toHaveAttribute('href', paths.employee.shiftRequests);
    expect(screen.getByRole('link', { name: 'Mis días libres' })).toHaveAttribute('href', paths.employee.daysOff);

    // Iniciar el descanso también se confirma (sin nota: no cierra nada) y lleva a su registro.
    const pause = await askRecord('Registrar inicio de descanso', '¿Registrar tu inicio de descanso?');
    expect(pause.querySelector('.confirm-note')).toBeNull();
    await userEvent.click(within(pause).getByRole('button', { name: 'Registrar inicio de descanso' }));
    expect(await screen.findByRole('heading', { name: 'Pantalla de registro: break-start' })).toBeInTheDocument();
    expect(calls).toHaveLength(1); // confirmar solo navega: el registro lo hace su pantalla
  });

  it('el descanso: disponible y hasta cuándo, desde cuándo podrá o que ya los tomó (datos del servidor)', async () => {
    const open = { occurrence: null, session: workSession(), message: 'En turno desde las 07:55; tu salida es a las 16:00.' };
    renderPage(attendanceToday({ ...open, now: '2026-10-05T17:00:00Z', break_window: breakWindow(), actions: ['BREAK_START', 'CHECK_OUT'] }));
    expect(await clockText('Descanso disponible hasta las 16:00 · 30 min')).toBeInTheDocument();
  });

  it('antes de la ventana del descanso lo dice y vuelve a preguntar al abrirse', async () => {
    const opens = new Date(Date.parse(NOW) + 100).toISOString();
    const { calls } = renderPage(
      attendanceToday({ occurrence: null, session: workSession({ scheduled_start: opens }), break_window: breakWindow({ starts_at: opens }), actions: ['CHECK_OUT'] }),
      attendanceToday({ occurrence: null, session: workSession(), break_window: breakWindow({ remaining: 0 }), actions: ['CHECK_OUT'], now: '2026-10-05T17:00:00Z' }),
    );
    expect(await clockText(/Podrás tomar tu descanso desde las/)).toBeInTheDocument();
    expect(await clockText('Ya tomaste tus descansos', { timeout: 5_000 })).toBeInTheDocument();
    await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(2));
  });

  it('día libre con turno: "Día libre", su motivo y fechas en el reloj, sin botones; su próxima jornada', async () => {
    renderPage(
      attendanceToday({
        occurrence: null,
        next_occurrence: next,
        actions: [],
        day_off: dayOff({ kind: 'HOLIDAY', name: 'Día de la Raza', starts_on: '2026-10-05', ends_on: '2026-10-05' }),
        message: 'Hoy es día festivo: Día de la Raza. Tu siguiente turno es el 06/10 a las 08:00; puedes checar desde las 07:45.',
      }),
    );
    expect(await screen.findByText(/Hoy es día festivo: Día de la Raza/)).toBeInTheDocument();
    expect(clock().getByText('Día libre')).toBeInTheDocument();
    const card = clock().getByRole('region', { name: 'Día libre' });
    expect(card).toHaveTextContent('Hoy no trabajas');
    expect(card).toHaveTextContent('Día festivo: Día de la Raza');
    expect(card).toHaveTextContent('5 oct 2026');
    expect(clock().queryByRole('button')).toBeNull();
    expect(clock().getByText(/Próxima jornada: 6 oct 2026/)).toBeInTheDocument();
  });

  it('de vacaciones sin turno próximo: su día libre en lugar de "sin turno"', async () => {
    renderPage(
      attendanceToday({
        shift: null,
        occurrence: null,
        actions: [],
        sites: [],
        day_off: dayOff({ ends_on: '2026-11-30' }),
        message: 'Estás de vacaciones del 05/10/2026 al 30/11/2026.',
      }),
    );
    const card = await screen.findByRole('region', { name: 'Día libre' });
    expect(card).toHaveTextContent('Hoy no trabajas');
    expect(card).toHaveTextContent('Vacaciones');
    expect(card).toHaveTextContent('5 oct 2026 al 30 nov 2026 · 57 días');
    expect(card).toHaveTextContent('Estás de vacaciones del 05/10/2026 al 30/11/2026.');
    expect(screen.queryByText('Aún no tienes un turno asignado')).toBeNull();
    expect(document.querySelector('.time-clock')).toBeNull();
    expect(screen.getByRole('link', { name: 'Mis días libres' })).toHaveAttribute('href', paths.employee.daysOff);
  });

  it('en descanso: desde qué hora, lo trabajado se detiene, cuánto le queda y volver es lo principal', async () => {
    renderPage(
      attendanceToday({
        now: '2026-10-05T18:10:00Z',
        occurrence: null,
        session: workSession({ breaks: [{ started_at: '2026-10-05T18:00:00Z', ended_at: null, minutes: 0, exceeded_minutes: 0 }] }),
        actions: ['BREAK_END', 'CHECK_OUT'],
        message: 'En descanso desde las 12:00.',
      }),
    );
    expect(await screen.findByText('En descanso desde las 12:00.')).toBeInTheDocument();
    expect(clock().getByText('En descanso')).toBeInTheDocument();
    expect(clock().getByText('En descanso desde').nextSibling).toHaveTextContent('12:00');
    expect(clock().getByText('Trabajado').nextSibling).toHaveTextContent('4 h 5 min');
    expect(clock().getByText('Tu descanso termina en')).toBeInTheDocument();
    expect(clock().getByText('20 min 00 s')).toBeInTheDocument();
    expect(action('Registrar fin de descanso')).toHaveClass('btn--light');

    const back = await askRecord('Registrar fin de descanso', '¿Registrar tu fin de descanso?');
    await userEvent.click(within(back).getByRole('button', { name: 'Registrar fin de descanso' }));
    expect(await screen.findByRole('heading', { name: 'Pantalla de registro: break-end' })).toBeInTheDocument();
  });

  it('pasada la hora de salida: la salida es lo principal; sin descansos en el turno no los muestra', async () => {
    renderPage(attendanceToday({ now: '2026-10-05T22:05:00Z', occurrence: null, session: workSession({ breaks_allowed: 0 }), actions: ['CHECK_OUT'] }));
    expect(await screen.findByText('Ya es hora de tu salida')).toBeInTheDocument();
    expect(action('Registrar salida')).toHaveClass('btn--light');
    expect(clock().queryByText('Descansos')).toBeNull();
  });

  it('registrar la salida se confirma antes (avisa que cierra la jornada): cancelar no navega; confirmar abre su registro', async () => {
    const { calls } = renderPage(attendanceToday({ now: '2026-10-05T22:05:00Z', occurrence: null, session: workSession({ breaks_allowed: 0 }), actions: ['CHECK_OUT'] }));
    await screen.findByText('Ya es hora de tu salida');
    const leave = await askRecord('Registrar salida', '¿Registrar tu salida?');
    expect(leave).toHaveTextContent('Se leerá tu ubicación y se abrirá la cámara para confirmar que eres tú.');
    expect(within(leave).getByRole('region', { name: 'Detalles' })).toHaveTextContent('TurnoMatutino · 08:00 – 16:00');
    expect(within(leave).getByText('Con tu salida se cierra tu jornada de hoy.').closest('.confirm-note')).not.toBeNull();
    await userEvent.click(within(leave).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { name: /Pantalla de registro/ })).toBeNull();
    expect(action('Registrar salida')).toBeEnabled(); // sigue en su reloj, como estaba
    expect(screen.getByText('Ya es hora de tu salida')).toBeInTheDocument();

    const again = await askRecord('Registrar salida', '¿Registrar tu salida?');
    await userEvent.click(within(again).getByRole('button', { name: 'Registrar salida' }));
    expect(await screen.findByRole('heading', { name: 'Pantalla de registro: check-out' })).toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it('antes del turno: "Programado", cuánto falta, la entrada y dónde checar (remoto y sitios)', async () => {
    renderPage(attendanceToday({ remote_allowed: true }));
    expect(await screen.findByText('Tu turno empieza en')).toBeInTheDocument();
    expect(clock().getByText('30 min 00 s')).toBeInTheDocument();
    expect(clock().getByText('Programado')).toBeInTheDocument();
    expect(action('Registrar entrada')).toHaveClass('btn--light');
    expect(screen.getByText('Puedes checar de forma remota')).toBeInTheDocument();
    expect(screen.getByText('Planta Norte')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Tu jornada/ })).toBeNull();
  });

  it('registrar la entrada se confirma antes de abrir ubicación y cámara: cancelar no navega; confirmar abre su registro', async () => {
    const { calls } = renderPage(attendanceToday());
    await screen.findByText('Tu turno empieza en');
    const enter = await askRecord('Registrar entrada', '¿Registrar tu entrada?');
    expect(within(enter).getByText('Mi asistencia')).toBeInTheDocument();
    expect(within(enter).getByRole('region', { name: 'Detalles' })).toHaveTextContent('TurnoMatutino · 08:00 – 16:00');
    expect(enter.querySelector('.confirm-note')).toBeNull(); // la entrada no cierra nada
    await userEvent.click(within(enter).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { name: /Pantalla de registro/ })).toBeNull();
    expect(clock().getByText('Programado')).toBeInTheDocument();

    const again = await askRecord('Registrar entrada', '¿Registrar tu entrada?');
    await userEvent.click(within(again).getByRole('button', { name: 'Registrar entrada' }));
    expect(await screen.findByRole('heading', { name: 'Pantalla de registro: check-in' })).toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it('ya empezó y no ha entrado: "Sin entrada" y sin cuenta regresiva; sin sitios ni remoto lo explica', async () => {
    renderPage(attendanceToday({ now: '2026-10-05T14:05:00Z', sites: [] }));
    expect(await screen.findByText('Sin entrada')).toBeInTheDocument();
    expect(screen.queryByText('Tu turno empieza en')).toBeNull();
    expect(screen.getByText('Sin sitio de trabajo asignado')).toBeInTheDocument();
  });

  it('turno ya registrado: "Salió", sin botones y con su jornada', async () => {
    renderPage(
      attendanceToday({
        now: '2026-10-05T22:30:00Z',
        session: workSession({ status: 'CLOSED', check_out_at: '2026-10-05T22:02:00Z', check_out_mode: 'ON_SITE', check_out_site: 'Planta Norte', worked_minutes: 487 }),
        actions: [],
        message: 'Ya registraste este turno.',
      }),
    );
    expect(await screen.findByText('Ya registraste este turno.')).toBeInTheDocument();
    expect(clock().getByText('Salió')).toBeInTheDocument();
    expect(clock().queryByRole('button')).toBeNull();
    expect(screen.getByRole('heading', { name: /Tu jornada/ })).toBeInTheDocument();
  });

  it('sin salida registrada a tiempo: "Sin salida"', async () => {
    renderPage(attendanceToday({ session: workSession({ status: 'MISSED_CHECKOUT' }), actions: [] }));
    expect(await screen.findAllByText('Sin salida')).not.toHaveLength(0);
  });

  it('antes de su jornada: su turno, cuándo es la siguiente, cuánto falta y dónde checará', async () => {
    renderPage(attendanceToday({ occurrence: null, next_occurrence: next, actions: [], message: 'Tu siguiente turno es el 06/10 a las 08:00; puedes checar desde las 07:45.' }));
    expect(await screen.findByText(/Próxima jornada: 6 oct 2026 · puedes checar desde las 07:45/)).toBeInTheDocument();
    expect(clock().getByText('08:00 – 16:00')).toBeInTheDocument();
    expect(clock().getByText('Podrás checar en')).toBeInTheDocument();
    expect(clock().getByText('1 d')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Dónde checarás tu próxima jornada/ })).toBeInTheDocument();
  });

  it('sin turno: lo explica y ofrece solicitar uno (sin reloj vacío); sin nombre, un saludo general', async () => {
    auth.user = { ...sampleUser, employee: null };
    renderPage(attendanceToday({ shift: null, occurrence: null, actions: [], sites: [], message: 'No tienes un turno asignado: pídeselo a tu empresa.' }));
    expect(await screen.findByRole('heading', { name: 'Hola' })).toBeInTheDocument();
    expect(screen.getByText('Aún no tienes un turno asignado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Solicitar un turno/ })).toHaveAttribute('href', '/employee/attendance/requests/new');
    expect(screen.getByRole('link', { name: /Mis solicitudes/ })).toHaveAttribute('href', '/employee/attendance/requests');
    expect(document.querySelector('.time-clock')).toBeNull();
    expect(screen.queryByRole('heading', { name: /Dónde/ })).toBeNull();
  });

  it('si falla la carga: popup con "Reintentar" y "Volver a cargar" en la pantalla', async () => {
    const { calls } = renderPage(apiFail(500, 'INTERNAL_ERROR', 'Falló el servidor'), attendanceToday(), apiFail(500, 'INTERNAL_ERROR'), attendanceToday());
    expect(await screen.findByText('No se pudo cargar tu asistencia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Tu turno empieza en')).toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });

  it('desde "Volver a cargar" también se recupera', async () => {
    renderPage(apiFail(500, 'INTERNAL_ERROR', 'Falló el servidor'), attendanceToday());
    await userEvent.click((await screen.findAllByRole('button', { name: 'Cerrar' }))[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Tu turno empieza en')).toBeInTheDocument();
  });

  it('al abrirse la ventana para checar vuelve a preguntar al servidor (sin recargar)', async () => {
    const opens = new Date(Date.parse(NOW) + 100).toISOString();
    const { calls } = renderPage(
      attendanceToday({ occurrence: null, next_occurrence: { ...next, opens }, actions: [], message: 'Tu siguiente turno...' }),
      attendanceToday({ now: opens }),
    );
    expect(await screen.findByText('Tu siguiente turno...')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Registrar entrada' }, { timeout: 5_000 })).toBeInTheDocument();
    await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(2));
  });
});
