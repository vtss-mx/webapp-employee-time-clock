import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { AttendanceBoard, AttendanceEvent, BoardRow, CompanySession, CompanySessionDetail, WorkSession } from '../../../types';
import { businessToday, formatDate } from '../../../utils/format';
import { quickRanges } from '../../../utils/dateRanges';
import { AttendanceHistoryPage } from './AttendanceHistoryPage';
import { AttendancePage } from './AttendancePage';
import { AttendanceSessionPage } from './AttendanceSessionPage';

const WORK_DATE = '2026-10-02';
const today = businessToday();
const yesterday = quickRanges().find((range) => range.key === 'yesterday')?.start as string;

/** Turno de 08:00 a 16:00 en la hora del Centro (UTC-6): entró 08:25, un descanso de 35 min. */
const open: WorkSession = {
  id: 31,
  work_date: WORK_DATE,
  shift_name: 'Matutino',
  scheduled_start: '2026-10-02T14:00:00Z',
  scheduled_end: '2026-10-02T22:00:00Z',
  check_out_deadline: '2026-10-02T23:00:00Z',
  status: 'OPEN',
  check_in_at: '2026-10-02T14:25:00Z',
  check_in_mode: 'REMOTE',
  check_in_site: null,
  check_out_at: null,
  check_out_mode: null,
  check_out_site: null,
  late_minutes: 25,
  early_leave_minutes: 0,
  break_minutes: 35,
  worked_minutes: null,
  breaks_allowed: 2,
  break_minutes_allowed: 30,
  breaks: [{ started_at: '2026-10-02T18:00:00Z', ended_at: '2026-10-02T18:35:00Z', minutes: 35, exceeded_minutes: 5 }],
};
/** Completa: entró a tiempo en Planta Norte y salió 15:40 (20 min antes). */
const closed: WorkSession = {
  ...open,
  id: 32,
  status: 'CLOSED',
  check_in_mode: 'ON_SITE',
  check_in_site: 'Planta Norte',
  late_minutes: 0,
  check_out_at: '2026-10-02T21:40:00Z',
  check_out_mode: 'ON_SITE',
  check_out_site: 'Planta Norte',
  early_leave_minutes: 20,
  break_minutes: 0,
  worked_minutes: 400,
  breaks: [],
};
const ana = { id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7' };
const beto = { id: 8, full_name: 'Beto López', employee_number: 'EMP-8' };
const carla = { id: 9, full_name: 'Carla Díaz', employee_number: 'EMP-9' };
const scheduled = { shift_name: 'Matutino', scheduled_start: open.scheduled_start, scheduled_end: open.scheduled_end };
const rows: BoardRow[] = [
  { employee: ana, department: 'Ventas', ...scheduled, state: 'WORKING', session: open },
  { employee: beto, department: 'Almacén', ...scheduled, state: 'DONE', session: closed },
  { employee: carla, department: null, ...scheduled, state: 'MISSING', session: null },
];

function board(items: BoardRow[]): AttendanceBoard {
  return { items, total: items.length, page: 1, size: 10, work_date: WORK_DATE, working: 1, on_break: 0, done: 1, missed_checkout: 0 };
}
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, size: 10 });

/** El indicador termina su conteo animado en el valor del servidor. */
const expectKpi = (label: string, value: string) =>
  waitFor(() => expect(screen.getByText(label, { selector: '.kpi__label' }).closest('.kpi')).toHaveTextContent(new RegExp(`^${label}${value}$`)));

function renderBoard(route = '/company/attendance') {
  return renderWithProviders(
    <Routes>
      <Route path="/company/attendance" element={<AttendancePage />} />
      <Route path="/company/attendance/sessions/:id" element={<p>Detalle de la jornada</p>} />
    </Routes>,
    { route },
  );
}

describe('Asistencia: tablero del día', () => {
  it('muestra el día con sus conteos y en qué va cada empleado', async () => {
    const { calls } = mockFetch(apiOk(board(rows)));
    renderBoard();
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByText(`Hoy, ${formatDate(today)}`)).toBeInTheDocument();
    expect(calls[0].url).toContain(`date=${today}`);
    await expectKpi('Con turno', '3');
    await expectKpi('En turno', '1');
    await expectKpi('En descanso', '0');
    await expectKpi('Completas', '1');
    await expectKpi('Sin salida', '0');
    // Un servidor que aún no envía el conteo de días libres cuenta 0.
    await expectKpi('Día libre', '0');

    // En turno: entró 08:25 con retardo, remoto, un descanso de dos y sin salida; abre su jornada.
    const anaRow = screen.getByRole('link', { name: /Ana Ruiz/ });
    expect(anaRow).toHaveAttribute('href', '/company/attendance/sessions/31');
    for (const text of ['EMP-7 · Ventas', 'En turno', 'Matutino', '08:00 – 16:00', '08:25', '+25 min', 'Remoto', '1/2 descansos']) {
      expect(within(anaRow).getByText(text)).toBeInTheDocument();
    }
    // Salió 15:40, 20 min antes.
    const betoRow = screen.getByRole('link', { name: /Beto López/ });
    for (const text of ['Salió', '15:40', '−20 min', 'En sitio', '0/2 descansos']) expect(within(betoRow).getByText(text)).toBeInTheDocument();
    // Sin entrada: nada que abrir.
    expect(screen.getByText('Carla Díaz').closest('a')).toBeNull();
    expect(screen.getByText('EMP-9')).toBeInTheDocument();
    expect(screen.getByText('Sin entrada')).toBeInTheDocument();

    // La empresa corrige una jornada o registra la de quien no checó (fuera del enlace de la fila).
    const item = (name: string) => within(screen.getByText(name).closest('li') as HTMLElement);
    expect(item('Ana Ruiz').getByRole('link', { name: 'Corregir' })).toHaveAttribute('href', '/company/attendance/sessions/31/correct');
    expect(item('Ana Ruiz').getByRole('link', { name: 'Corregir' })).toHaveAttribute('title', 'Corregir la jornada de Ana Ruiz');
    expect(item('Beto López').getByRole('link', { name: 'Corregir' })).toHaveAttribute('href', '/company/attendance/sessions/32/correct');
    expect(item('Carla Díaz').getByRole('link', { name: 'Registrar asistencia' })).toHaveAttribute('href', `/company/attendance/sessions/new?employee=9&date=${today}`);
    expect(screen.getByRole('link', { name: /Historial/ })).toHaveAttribute('href', '/company/attendance/history');
  });

  it('día libre (con su motivo), faltó y programado: qué se puede hacer con cada uno', async () => {
    const dave = { id: 10, full_name: 'Dave Soto', employee_number: 'EMP-10' };
    const eva = { id: 11, full_name: 'Eva Paz', employee_number: 'EMP-11' };
    const day = {
      kind: 'VACATION',
      name: 'Vacaciones',
      work_date: '2026-09-15',
      starts_on: '2026-09-14',
      ends_on: '2026-09-18',
    };
    mockFetch(
      apiOk({
        ...board([
          { employee: ana, department: null, ...scheduled, state: 'DAY_OFF', session: null, day_off: day },
          { employee: beto, department: null, ...scheduled, state: 'DAY_OFF', session: null },
          { employee: carla, department: null, ...scheduled, state: 'ABSENT', session: null },
          { employee: dave, department: null, ...scheduled, state: 'SCHEDULED', session: null },
          { employee: eva, department: null, ...scheduled, state: 'MISSING', session: null, day_off: null },
        ]),
        day_off: 2,
      }),
    );
    renderBoard('/company/attendance?date=2026-09-15');
    await screen.findByText('Ana Ruiz');
    await expectKpi('Día libre', '2');
    const item = (name: string) => within(screen.getByText(name).closest('li') as HTMLElement);
    // Día libre: no es una falta, dice por qué y no hay nada que registrar.
    expect(item('Ana Ruiz').getByText('Día libre')).toBeInTheDocument();
    expect(item('Ana Ruiz').getByText('Vacaciones')).toBeInTheDocument();
    expect(item('Ana Ruiz').queryByRole('link')).toBeNull();
    expect(item('Beto López').getByText('Día libre')).toBeInTheDocument();
    expect(item('Beto López').queryByRole('link')).toBeNull();
    // Faltó o sin entrada: se registra su asistencia de ese día; programado: aún no hay nada que registrar.
    expect(item('Carla Díaz').getByRole('link', { name: 'Registrar asistencia' })).toHaveAttribute('href', '/company/attendance/sessions/new?employee=9&date=2026-09-15');
    expect(item('Eva Paz').getByRole('link', { name: 'Registrar asistencia' })).toBeInTheDocument();
    expect(item('Dave Soto').queryByRole('link')).toBeNull();
  });

  it('al abrir a quien ya checó lleva al detalle de su jornada', async () => {
    mockFetch(apiOk(board(rows)));
    renderBoard();
    await userEvent.click(await screen.findByRole('link', { name: /Ana Ruiz/ }));
    expect(await screen.findByText('Detalle de la jornada')).toBeInTheDocument();
  });

  it('cambia de día con "Ayer" y "Hoy" o escribiendo la fecha (una fecha a medias no consulta)', async () => {
    const { calls } = mockFetch(apiOk(board(rows)));
    renderBoard();
    await screen.findByText('Ana Ruiz');
    await userEvent.click(screen.getByRole('button', { name: 'Ayer' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain(`date=${yesterday}`));
    expect(screen.getByText(formatDate(yesterday))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ayer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'false');

    const field = screen.getByLabelText('Día');
    await userEvent.clear(field);
    const before = calls.length;
    await userEvent.type(field, '0109');
    expect(calls).toHaveLength(before);
    await userEvent.type(field, '2026');
    await waitFor(() => expect(calls.at(-1)?.url).toContain('date=2026-09-01'));
    expect(screen.getByText(formatDate('2026-09-01'))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain(`date=${today}`));
    expect(screen.getByText(`Hoy, ${formatDate(today)}`)).toBeInTheDocument();
    expect(field).toHaveValue(today.split('-').reverse().join('/'));
  });

  it('abre en el día de la URL; una fecha que no existe se ignora (hoy)', async () => {
    const { calls } = mockFetch(apiOk(board(rows)));
    const { unmount } = renderBoard('/company/attendance?date=2026-09-15');
    await screen.findByText('Ana Ruiz');
    expect(calls[0].url).toContain('date=2026-09-15');
    unmount();
    renderBoard('/company/attendance?date=2026-02-31');
    await waitFor(() => expect(calls.at(-1)?.url).toContain(`date=${today}`));
  });

  it('busca por nombre o número; sin turnos y sin coincidencias lo dice', async () => {
    const { calls } = mockFetch((call: MockCall) => apiOk(board(call.url.includes('search=ana') ? [rows[0]] : [])));
    renderBoard();
    expect(await screen.findByText('Nadie tiene turno este día')).toBeInTheDocument();
    const search = screen.getByRole('searchbox', { name: 'Buscar empleados' });
    await userEvent.type(search, 'zzz');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'ana');
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
    expect(calls.at(-1)?.url).toContain('search=ana');
    await expectKpi('Coinciden con la búsqueda', '1');
  });

  it('"Actualizar" vuelve a pedir el tablero (sin temporizadores)', async () => {
    const { calls } = mockFetch(apiOk(board(rows)));
    renderBoard();
    await screen.findByText('Ana Ruiz');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled());
    const before = calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(calls).toHaveLength(before + 1));
  });

  it('sin red avisa con un popup y ofrece volver a cargar', async () => {
    let online = false;
    mockFetch(() => (online ? apiOk(board(rows)) : Promise.reject(new TypeError('Failed to fetch'))));
    renderBoard();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar la asistencia del día' })).toBeInTheDocument();
    online = true;
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
  });
});

const history = (items: CompanySession[]) => apiOk(page(items));
const betoSession: CompanySession = { ...closed, employee: beto };
const anaSession: CompanySession = { ...open, status: 'MISSED_CHECKOUT', employee: ana };

const event = (overrides: Partial<AttendanceEvent>): AttendanceEvent => ({
  action: 'CHECK_IN',
  mode: 'ON_SITE',
  site: null,
  occurred_at: closed.check_in_at,
  latitude: null,
  longitude: null,
  accuracy_m: null,
  distance_m: null,
  confidence: null,
  operator: null,
  ...overrides,
});
const detail: CompanySessionDetail = {
  ...betoSession,
  events: [
    event({ site: 'Planta Norte', latitude: 29.07, longitude: -110.95, accuracy_m: 10, distance_m: 12.4, confidence: 0.99991, operator: 'beto@empresa.com' }),
    event({ action: 'BREAK_START', mode: 'REMOTE', occurred_at: '2026-10-02T18:00:00Z' }),
    event({ action: 'CHECK_OUT', mode: 'VALIDATOR', site: 'Planta Norte', occurred_at: '2026-10-03T12:02:00Z', latitude: 29.07, accuracy_m: 1500, confidence: 0.9, operator: 'Recepción planta 1' }),
  ],
};

function renderHistory() {
  return renderWithProviders(
    <Routes>
      <Route path="/company/attendance/history" element={<AttendanceHistoryPage />} />
      <Route path="/company/attendance/sessions/:id" element={<AttendanceSessionPage />} />
    </Routes>,
    { route: '/company/attendance/history' },
  );
}

describe('Asistencia: historial', () => {
  it('lista las jornadas con entrada, salida, retardo, trabajado y estado; abre el detalle y regresa al historial', async () => {
    mockFetch((call: MockCall) => (call.url.includes('/attendance/sessions/') ? apiOk(detail) : history([betoSession, anaSession])));
    renderHistory();
    expect(await screen.findByText('Beto López')).toBeInTheDocument();
    expect(screen.getByText('2 jornadas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Asistencia del día/ })).toHaveAttribute('href', '/company/attendance');
    expect(screen.getAllByText(formatDate(WORK_DATE))).toHaveLength(2);
    expect(screen.getAllByText('En sitio · Planta Norte')).toHaveLength(2);
    for (const text of ['15:40', '−20 min', '6 h 40 min', 'Completa', '+25 min', 'Remoto', 'Sin salida']) expect(screen.getByText(text)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Beto López'));
    expect(await screen.findByRole('heading', { name: 'Beto López' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Historial de asistencia/ })).toHaveAttribute('href', '/company/attendance/history');
  });

  it('filtra por rangos rápidos, fechas a mano y estado', async () => {
    const { calls } = mockFetch(history([betoSession]));
    renderHistory();
    await screen.findByText('Beto López');
    expect(screen.getByText('1 jornada')).toBeInTheDocument();
    expect(calls[0].url).not.toContain('start=');
    expect(screen.getByRole('button', { name: 'Todas las fechas' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Ayer' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain(`start=${yesterday}&end=${yesterday}`));
    expect(screen.getByRole('button', { name: 'Ayer' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: /^Estado/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Completa' }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain('status=CLOSED'));

    await userEvent.click(screen.getByRole('button', { name: 'Todas las fechas' }));
    await waitFor(() => expect(calls.at(-1)?.url).not.toContain('start='));
    await userEvent.type(screen.getByLabelText('Hasta'), '01092026');
    await waitFor(() => expect(calls.at(-1)?.url).toContain('end=2026-09-01'));
    expect(calls.at(-1)?.url).not.toContain('start=');
  });

  it('una fecha que no existe se marca y no filtra', async () => {
    const { calls } = mockFetch(history([betoSession]));
    renderHistory();
    await screen.findByText('Beto López');
    await userEvent.type(screen.getByLabelText('Desde'), '31022026');
    expect(await screen.findByText('Escribe una fecha válida')).toBeInTheDocument();
    expect(calls.every((call) => !call.url.includes('start='))).toBe(true);
  });

  it('si el backend rechaza el rango (422) lo explica en un popup y no deja ver las jornadas anteriores', async () => {
    mockFetch((call: MockCall) =>
      call.url.includes('start=') ? apiFail(422, 'ATTENDANCE_INVALID_PERIOD', 'Elige un rango de fechas en orden y de hasta 366 días') : history([betoSession]),
    );
    renderHistory();
    await screen.findByText('Beto López');
    await userEvent.click(screen.getByRole('button', { name: 'Mes pasado' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el historial de asistencia' });
    expect(dialog).toHaveTextContent('Elige un rango de fechas en orden y de hasta 366 días');
    expect(screen.queryByText('Beto López')).toBeNull();
    expect(screen.getByRole('button', { name: 'Volver a cargar' })).toBeInTheDocument();
  });

  it('sin jornadas lo explica; con filtros dice que nada coincide', async () => {
    mockFetch(history([]));
    renderHistory();
    expect(await screen.findByText('Sin jornadas')).toBeInTheDocument();
    expect(screen.getByText('0 jornadas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Estado/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'En turno' }));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });
});

function renderDetail(route = '/company/attendance/sessions/32') {
  return renderWithProviders(
    <Routes>
      <Route path="/company/attendance/sessions/:id" element={<AttendanceSessionPage />} />
    </Routes>,
    { route },
  );
}

describe('Asistencia: detalle de una jornada', () => {
  it('muestra el resumen y cada registro con su evidencia; regresa al tablero de ese día', async () => {
    const { calls } = mockFetch(apiOk(detail));
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Beto López' })).toBeInTheDocument();
    expect(calls[0].url).toBe('/api/attendance/sessions/32');
    expect(screen.getByText('EMP-8 · 2 oct 2026 · Matutino')).toBeInTheDocument();
    expect(screen.getByText('Completa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Asistencia del día/ })).toHaveAttribute('href', `/company/attendance?date=${WORK_DATE}`);
    expect(screen.getByRole('link', { name: 'Corregir' })).toHaveAttribute('href', '/company/attendance/sessions/32/correct');
    for (const text of ['08:00 – 16:00', '15:40', '−20 min', '0 de 2', 'De 30 min cada uno', '6 h 40 min', '3 registros']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }

    const log = screen.getByRole('list', { name: 'Registros de la jornada' });
    for (const text of ['Entrada', 'Inicio de descanso', 'Salida', 'a 12 m de Planta Norte', '±10 m', 'Rostro 99.991 %', 'beto@empresa.com', 'Remoto']) {
      expect(within(log).getByText(text)).toBeInTheDocument();
    }
    // Salida del día siguiente (con su fecha), en un validador: sitio sin distancia, precisión en km.
    for (const text of ['06:02 · 3 oct 2026', 'Validador', 'Planta Norte', '±1.5 km', 'Rostro 90 %', 'Recepción planta 1']) {
      expect(within(log).getByText(text)).toBeInTheDocument();
    }
    // Solo el registro con ambas coordenadas tiene enlace al mapa (otra pestaña).
    const maps = within(log).getAllByRole('link', { name: /Ver en el mapa/ });
    expect(maps).toHaveLength(1);
    expect(maps[0]).toHaveAttribute('href', 'https://www.google.com/maps?q=29.07,-110.95');
    expect(maps[0]).toHaveAttribute('target', '_blank');
    expect(maps[0]).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('una jornada que no existe (404) se avisa; ofrece volver a cargar y regresar', async () => {
    let found = false;
    mockFetch(() => (found ? apiOk(detail) : apiFail(404, 'WORK_SESSION_NOT_FOUND', 'Jornada no encontrada')));
    renderDetail();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar la jornada' })).toHaveTextContent('Jornada no encontrada');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: 'Jornada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Asistencia del día/ })).toHaveAttribute('href', '/company/attendance');
    found = true;
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('heading', { name: 'Beto López' })).toBeInTheDocument();
  });

  it('sin registros en la bitácora lo dice; uno solo, en singular', async () => {
    mockFetch(apiOk({ ...detail, events: [] }));
    const { unmount } = renderDetail();
    expect(await screen.findByText('Sin registros')).toBeInTheDocument();
    expect(screen.getByText('0 registros')).toBeInTheDocument();
    unmount();
    mockFetch(apiOk({ ...detail, events: detail.events.slice(0, 1) }));
    renderDetail();
    expect(await screen.findByText('1 registro')).toBeInTheDocument();
  });
});
