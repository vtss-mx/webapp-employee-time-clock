import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { absence, holiday, pageOf } from '../../../components/attendance/employee/testData';
import { toIso } from '../../../components/ui/DateField';
import { paths } from '../../../routes/paths';
import { apiFail, apiOk, envelope, jsonResponse, mockFetch, type MockCall } from '../../../test/http';
import { catalogsFixture, catalogsWith, testCatalogs } from '../../../test/catalogs';
import { renderWithProviders } from '../../../test/render';
import type { CatalogApi } from '../../../utils/catalogs';
import { businessDate, formatDate } from '../../../utils/format';
import { AbsenceRequestFormPage, validateAbsenceRequest } from './AbsenceRequestFormPage';
import { MyDaysOffPage } from './MyDaysOffPage';

type Responder = (call: MockCall) => Response | Promise<Response>;

/** Las dos pantallas con sus rutas; cada endpoint responde con su función (o una lista vacía). */
function renderAt(route: string, overrides: Record<string, Responder> = {}, catalogs: CatalogApi = testCatalogs) {
  const server = mockFetch((call) => {
    const path = call.url.split('?')[0];
    const key = `${call.init.method ?? 'GET'} ${path}`;
    if (overrides[key]) return overrides[key](call);
    if (key === 'POST /api/me/absences') return apiOk(absence(), { status: 201 });
    return apiOk(pageOf([]));
  });
  renderWithProviders(
    <Routes>
      <Route path={paths.employee.attendance} element={<p>Mi asistencia</p>} />
      <Route path={paths.employee.daysOff} element={<MyDaysOffPage />} />
      <Route path={paths.employee.newAbsenceRequest} element={<AbsenceRequestFormPage />} />
    </Routes>,
    { route, catalogs },
  );
  return server;
}

/** Varias respuestas en orden para el mismo endpoint (la última se repite). */
function inOrder(...responses: Response[]): Responder {
  const queue = [...responses];
  return () => (queue.length > 1 ? (queue.shift() as Response) : queue[0].clone());
}

const section = (title: string) => within(screen.getByRole('heading', { name: title }).closest('section') as HTMLElement);
/** Lo que dice cada fila de la confirmación ("TipoVacaciones"). */
const factRows = (dialog: HTMLElement, region = 'Detalles') => within(within(dialog).getByRole('region', { name: region })).getAllByRole('listitem').map((li) => li.textContent);
/** Toca "Cancelar solicitud" de la lista y devuelve su confirmación (destructiva: alerta). */
async function askCancel(title = '¿Cancelar tu solicitud de vacaciones?') {
  await userEvent.click(await screen.findByRole('button', { name: 'Cancelar solicitud' }));
  return screen.findByRole('alertdialog', { name: title });
}

describe('MyDaysOffPage (mis vacaciones, permisos y próximos festivos)', () => {
  it('sus ausencias con tipo, fechas, días, estado y respuesta; los festivos con su hoja de calendario', async () => {
    const { calls } = renderAt(paths.employee.daysOff, {
      'GET /api/me/absences': () =>
        apiOk(
          pageOf([
            absence({ note: 'Viaje familiar' }),
            absence({ id: 12, type: 'PERMISSION', starts_on: '2026-11-03', ends_on: '2026-11-03', days: 1, status: 'REJECTED', decision_note: 'Es cierre de mes' }),
            absence({ id: 13, type: 'SICK_LEAVE', status: 'APPROVED', requested_by_employee: false }),
          ]),
        ),
      'GET /api/me/holidays': () => apiOk({ ...pageOf([holiday(), holiday({ id: 4, holiday_date: '2027-01-01', name: 'Aniversario de la empresa', official: false })]), size: 5 }),
    });
    const [pending, rejected, sick] = await section('Mis vacaciones y permisos').findAllByRole('listitem');
    expect(calls.some((call) => call.url.startsWith('/api/me/holidays?') && call.url.includes('size=5'))).toBe(true);

    expect(within(pending).getByText('Vacaciones')).toBeInTheDocument();
    expect(within(pending).getByText('1 dic 2026 al 15 dic 2026')).toBeInTheDocument();
    expect(within(pending).getByText('15 días')).toBeInTheDocument();
    expect(within(pending).getByText('Pendiente')).toBeInTheDocument();
    expect(within(pending).getByText('La pediste')).toBeInTheDocument();
    expect(within(pending).getByText('Viaje familiar')).toBeInTheDocument();
    expect(within(pending).getByRole('button', { name: 'Cancelar solicitud' })).toBeInTheDocument();

    expect(within(rejected).getByText('Permiso')).toBeInTheDocument();
    expect(within(rejected).getByText('3 nov 2026')).toBeInTheDocument();
    expect(within(rejected).getByText('1 día')).toBeInTheDocument();
    expect(within(rejected).getByText('Rechazada')).toBeInTheDocument();
    expect(within(rejected).getByText('Es cierre de mes')).toBeInTheDocument();
    expect(within(rejected).queryByRole('button')).toBeNull();

    expect(within(sick).getByText('Incapacidad')).toBeInTheDocument();
    expect(within(sick).getByText('La registró tu empresa')).toBeInTheDocument();
    expect(within(sick).queryByText('Nota')).toBeNull();

    const holidays = section('Próximos días festivos');
    const [christmas, own] = holidays.getAllByRole('listitem');
    expect(within(christmas).getByText('Navidad')).toBeInTheDocument();
    expect(within(christmas).getByText('25')).toBeInTheDocument();
    expect(within(christmas).getByText(/25 dic 2026/)).toBeInTheDocument();
    expect(within(christmas).getByText('Oficial')).toBeInTheDocument();
    expect(within(own).getByText('Aniversario de la empresa')).toBeInTheDocument();
    expect(within(own).getByText('De tu empresa')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Solicitar vacaciones o permiso' })).toHaveAttribute('href', paths.employee.newAbsenceRequest);
    expect(screen.getByRole('link', { name: /Mi asistencia/ })).toHaveAttribute('href', paths.employee.attendance);
  });

  it('cancela una pendiente tras confirmarla (su tipo y fechas, sin decir de quién es) y la lista se actualiza', async () => {
    const { calls } = renderAt(paths.employee.daysOff, {
      'GET /api/me/absences': inOrder(apiOk(pageOf([absence()])), apiOk(pageOf([absence({ status: 'CANCELLED' })]))),
      'POST /api/me/absences/11/cancel': () => apiOk(absence({ status: 'CANCELLED' })),
    });
    const ask = await askCancel();
    expect(ask).toHaveTextContent('Se retirará y tu empresa ya no la revisará.');
    expect(factRows(ask)).toEqual(['TipoVacaciones', 'Fechas1 dic 2026 al 15 dic 2026 · 15 días']);
    expect(within(ask).queryByText('Empleado')).toBeNull(); // es suya
    expect(within(ask).getByRole('button', { name: 'Conservarla' })).toHaveFocus(); // lo seguro primero
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancelar solicitud' }));
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(calls.some((call) => call.url === '/api/me/absences/11/cancel' && call.init.method === 'POST')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Cancelar solicitud' })).toBeNull();
  });

  it('"Conservarla" no envía nada: la solicitud sigue igual y disponible (con su nota en la confirmación)', async () => {
    const { calls } = renderAt(paths.employee.daysOff, {
      'GET /api/me/absences': () => apiOk(pageOf([absence({ type: 'PERMISSION', starts_on: '2026-11-03', ends_on: '2026-11-03', days: 1, note: 'Trámite en el banco' })])),
    });
    const ask = await askCancel('¿Cancelar tu solicitud de permiso?');
    expect(factRows(ask)).toEqual(['TipoPermiso', 'Fechas3 nov 2026 · 1 día', 'NotaTrámite en el banco']);
    await userEvent.click(within(ask).getByRole('button', { name: 'Conservarla' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false);
    expect(calls.filter((call) => call.url.startsWith('/api/me/absences?'))).toHaveLength(1); // la lista no se vuelve a pedir
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar solicitud' })).toBeEnabled(); // nada quedó ocupado
  });

  it('si cancelar falla: el popup lo explica y la solicitud sigue ahí', async () => {
    renderAt(paths.employee.daysOff, {
      'GET /api/me/absences': () => apiOk(pageOf([absence({ id: 14 })])),
      'POST /api/me/absences/14/cancel': () => apiFail(409, 'ABSENCE_CLOSED', 'La solicitud ya fue atendida'),
    });
    await userEvent.click(within(await askCancel()).getByRole('button', { name: 'Cancelar solicitud' }));
    expect(await screen.findByText('No se pudo cancelar la solicitud')).toBeInTheDocument();
    expect(screen.getByText('La solicitud ya fue atendida')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Cerrar|Entendido/ })[0]);
    expect(screen.getByRole('button', { name: 'Cancelar solicitud' })).toBeEnabled();
  });

  it('los festivos se paginan (atenuados mientras llega la otra página)', async () => {
    let release: () => void = () => undefined;
    const second = new Promise<Response>((resolve) => (release = () => resolve(apiOk({ ...pageOf([holiday({ id: 9, name: 'Año Nuevo', holiday_date: '2027-01-01' })]), page: 2, size: 5, total: 6 }))));
    renderAt(paths.employee.daysOff, {
      'GET /api/me/holidays': (call) => (call.url.includes('page=2') ? second : apiOk({ ...pageOf([holiday()]), size: 5, total: 6 })),
    });
    const holidays = await screen.findByText('Navidad');
    await userEvent.click(within(holidays.closest('section') as HTMLElement).getByRole('button', { name: 'Página siguiente' }));
    expect(document.querySelector('.holiday-list.is-loading')).not.toBeNull();
    release();
    expect(await screen.findByText('Año Nuevo')).toBeInTheDocument();
    expect(document.querySelector('.holiday-list.is-loading')).toBeNull();
  });

  it('sin ausencias ni festivos: estados vacíos', async () => {
    renderAt(paths.employee.daysOff);
    expect(await screen.findByText('Aún no tienes vacaciones ni permisos')).toBeInTheDocument();
    expect(await screen.findByText('Sin días festivos próximos')).toBeInTheDocument();
  });

  it('si no cargan: popup y "Volver a cargar"', async () => {
    renderAt(paths.employee.daysOff, { 'GET /api/me/absences': inOrder(apiFail(500, 'INTERNAL_ERROR', 'Falló'), apiOk(pageOf([absence()]))) });
    expect(await screen.findByText('No se pudieron cargar tus vacaciones y permisos')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Pendiente')).toBeInTheDocument();
  });
});

const base = businessDate();
const day = (offset: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
const typed = (date: Date) => toIso(date).split('-').reverse().join('');
const from = () => screen.getByLabelText('Desde');
const to = () => screen.getByLabelText('Hasta');
const send = () => userEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
/** Envía y devuelve la confirmación de lo que se pedirá ("¿Pedir vacaciones?"). */
async function ask(title: string) {
  await send();
  return screen.findByRole('dialog', { name: title });
}
const confirmSend = async (dialog: HTMLElement) => userEvent.click(within(dialog).getByRole('button', { name: 'Enviar solicitud' }));
async function typeDate(field: HTMLElement, value: string) {
  await userEvent.clear(field);
  await userEvent.type(field, value);
}

describe('AbsenceRequestFormPage (pedir vacaciones o un permiso)', () => {
  it('solo los tipos que puede pedir; valida, sigue el último día, cuenta los días, confirma, envía y vuelve', async () => {
    const { calls } = renderAt(paths.employee.newAbsenceRequest);
    const types = await screen.findByRole('radiogroup', { name: 'Tipo' });
    expect(within(types).getAllByRole('radio')).toHaveLength(2);
    expect(within(types).getByRole('radio', { name: 'Vacaciones' })).not.toBeChecked();
    expect(within(types).queryByRole('radio', { name: 'Incapacidad' })).toBeNull();
    expect(screen.getByText('El mismo día si es solo uno.')).toBeInTheDocument();

    await send();
    expect(await screen.findByText('Revisa la información')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Elige qué quieres pedir')).toBeInTheDocument();
    expect(screen.getByText('Elige el primer día')).toBeInTheDocument();
    expect(screen.getByText('Elige el último día')).toBeInTheDocument();

    await userEvent.click(within(types).getByRole('radio', { name: 'Permiso' }));
    // El último día sigue al primero (un solo día por omisión) y cuenta los días.
    await typeDate(from(), typed(day(7)));
    expect(to()).toHaveValue(toIso(day(7)).split('-').reverse().join('/'));
    expect(screen.getByText('Es 1 día.')).toBeInTheDocument();
    await typeDate(to(), typed(day(9)));
    expect(screen.getByText('Son 3 días (ambos incluidos).')).toBeInTheDocument();
    // Si el primero se mueve sin pasar al último, el último se queda.
    await typeDate(from(), typed(day(8)));
    expect(screen.getByText('Son 2 días (ambos incluidos).')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'Trámite en el banco');

    // Antes de enviar pregunta con lo que se pedirá (la nota, porque la escribió); "Cancelar" no envía nada.
    const permission = await ask('¿Pedir permiso?');
    expect(factRows(permission, 'Se enviará')).toEqual(['TipoPermiso', `Fechas${formatDate(toIso(day(8)))} al ${formatDate(toIso(day(9)))} · 2 días`, 'NotaTrámite en el banco']);
    await userEvent.click(within(permission).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false);
    expect(screen.getByLabelText('Nota (opcional)')).toHaveValue('Trámite en el banco');
    expect(screen.getByText('Son 2 días (ambos incluidos).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();

    await confirmSend(await ask('¿Pedir permiso?'));
    expect(await screen.findByText('Solicitud enviada a tu empresa')).toBeInTheDocument();
    const post = calls.find((call) => call.init.method === 'POST');
    expect(JSON.parse(post?.init.body as string)).toEqual({ type: 'PERMISSION', starts_on: toIso(day(8)), ends_on: toIso(day(9)), note: 'Trámite en el banco' });
    expect(await screen.findByRole('heading', { name: 'Mis días libres' })).toBeInTheDocument();
  });

  it('errores del servidor en su campo: fechas encimadas y un tipo que ya no se puede pedir', async () => {
    const overlap = apiFail(409, 'ABSENCE_OVERLAP', 'Ya tienes días libres en esas fechas');
    const notRequestable = jsonResponse(
      envelope(null, { status: 422, code: 'DAY_OFF_TYPE_NOT_REQUESTABLE', message: 'Ese tipo de ausencia lo registra tu empresa', errors: [{ code: 'DAY_OFF_TYPE_NOT_REQUESTABLE', message: 'Ese tipo de ausencia lo registra tu empresa', field: 'type', details: null }] }),
      422,
    );
    renderAt(paths.employee.newAbsenceRequest, { 'POST /api/me/absences': inOrder(overlap, notRequestable) });
    await userEvent.click(await screen.findByRole('radio', { name: 'Vacaciones' }));
    await typeDate(from(), typed(day(3)));
    // Sin nota, la confirmación no la menciona.
    const vacation = await ask('¿Pedir vacaciones?');
    expect(factRows(vacation, 'Se enviará')).toEqual(['TipoVacaciones', `Fechas${formatDate(toIso(day(3)))} · 1 día`]);
    expect(within(vacation).queryByText('Nota')).toBeNull();
    await confirmSend(vacation);
    expect(await screen.findByText('No se pudo enviar tu solicitud')).toBeInTheDocument();
    expect(screen.getAllByText('Ya tienes días libres en esas fechas').length).toBeGreaterThan(1);
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await confirmSend(await ask('¿Pedir vacaciones?'));
    expect(await screen.findAllByText('Ese tipo de ausencia lo registra tu empresa')).not.toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Ese tipo de ausencia lo registra tu empresa', { selector: '.field__error' })).toBeInTheDocument();
  });

  it('"Cancelar" vuelve a la lista', async () => {
    renderAt(paths.employee.newAbsenceRequest);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Mis días libres' })).toBeInTheDocument();
  });

  it('con un solo tipo que se puede pedir, ya viene elegido', async () => {
    const onlyVacation = catalogsWith({ day_off_types: catalogsFixture.day_off_types.map((type) => ({ ...type, requestable: type.code === 'VACATION' })) });
    renderAt(paths.employee.newAbsenceRequest, {}, onlyVacation);
    expect(await screen.findByRole('radio', { name: 'Vacaciones' })).toBeChecked();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
  });

  it('sin tipos que pueda pedir: lo explica y ofrece volver', async () => {
    const none = catalogsWith({ day_off_types: catalogsFixture.day_off_types.map((type) => ({ ...type, requestable: false })) });
    renderAt(paths.employee.newAbsenceRequest, {}, none);
    expect(await screen.findByText('Por ahora no puedes pedir días desde aquí')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', paths.employee.daysOff);
  });

  it('reglas: fechas completas y reales, desde hoy, en orden y de hasta un año', () => {
    const today = toIso(day(0));
    const values = { type: 'VACATION', starts_on: toIso(day(1)), ends_on: toIso(day(2)), note: '' };
    expect(validateAbsenceRequest(values, today)).toEqual({});
    expect(validateAbsenceRequest({ ...values, starts_on: toIso(day(-1)) }, today).starts_on).toBe('Pide tus días desde hoy en adelante');
    expect(validateAbsenceRequest({ ...values, starts_on: '31/02/2030' }, today).starts_on).toBe('Escribe una fecha válida (dd/mm/aaaa)');
    expect(validateAbsenceRequest({ ...values, starts_on: '' }, today).starts_on).toBe('Elige el primer día');
    expect(validateAbsenceRequest({ ...values, ends_on: toIso(day(0)) }, today).ends_on).toBe('La fecha final no puede ser anterior a la inicial');
    expect(validateAbsenceRequest({ ...values, ends_on: toIso(day(400)) }, today).ends_on).toBe('Una ausencia dura a lo más 366 días');
    expect(validateAbsenceRequest({ ...values, ends_on: toIso(day(366)) }, today).ends_on).toBeUndefined();
  });
});
