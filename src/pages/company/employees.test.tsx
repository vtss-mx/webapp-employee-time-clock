import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { apiFail, apiOk, liveCheck, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Employee } from '../../types';
import { EmployeeCreatePage } from './EmployeeCreatePage';
import { EmployeeEditPage } from './EmployeeEditPage';
import { EmployeesListPage } from './EmployeesListPage';
import { ReverifyIdentityPage } from './ReverifyIdentityPage';

const ana: Employee = {
  id: 7,
  user_id: 70,
  employee_number: 'EMP-7',
  first_name: 'Ana',
  last_name: 'Ruiz',
  full_name: 'Ana Ruiz',
  birth_date: '1990-01-01',
  rfc: 'RUAA900101AB1',
  curp: 'RUAA900101MSRRZL09',
  nss: '12345678903',
  phone: '+526621234567',
  email: 'ana@empresa.com',
  active: true,
  headwear_exempt: false,
  face_status: 'APPROVED',
  face_rejection_reason: null,
  latest_enrollment_id: 3,
  has_face: true,
  face_samples: 5,
  department_id: 3,
  department_name: 'Producción',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
};
const luis: Employee = { ...ana, id: 8, employee_number: 'EMP-8', first_name: 'Luis', last_name: 'Paz', full_name: 'Luis Paz', email: 'luis@empresa.com', active: false, face_status: 'NOT_ENROLLED', department_id: null, department_name: null };

const page = (items: Employee[]) => ({ items, total: items.length, page: 1, size: 10 });
const posted = (calls: MockCall[], method: string) => {
  const call = calls.find((c) => c.init.method === method);
  return { url: call?.url, body: JSON.parse((call?.init.body as string | undefined) ?? 'null') as unknown };
};

/** Validación en vivo (respaldo HTTP): cada dato único responde según su campo. */
function live(call: MockCall, codes: Record<string, string> = {}) {
  const field = new URL(call.url, 'http://localhost').searchParams.get('field') ?? '';
  return liveCheck(codes[field] ?? 'AVAILABLE', codes[field] === 'LINKABLE' ? 'Esta persona ya tiene cuenta en Employee Time Clock' : 'Disponible', field);
}

/** Pantallas de empleados con sus destinos (expediente y listado). */
function renderEmployees(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/employees" element={<EmployeesListPage />} />
      <Route path="/company/employees/new" element={<EmployeeCreatePage />} />
      <Route path="/company/employees/:id/edit" element={<EmployeeEditPage />} />
      <Route path="/company/employees/:id/reverify" element={<ReverifyIdentityPage />} />
      <Route
        path="/company/employees/:id"
        element={
          <>
            <p>Expediente del empleado</p>
            <Link to="/company/employees/7/edit">Ir a editar</Link>
          </>
        }
      />
    </Routes>,
    { route },
  );
}

const VALID = {
  Nombres: 'Eva',
  Apellidos: 'Sol',
  CURP: 'RUAA900101MSRRZL09',
  RFC: 'RUAA900101AB1',
  'No. de Seguridad Social (NSS)': '12345678903',
  'No. de empleado': 'EMP-9',
  'Teléfono celular': '6621234567',
  'Correo electrónico': 'eva@empresa.com',
};

/** Llena el alta como lo haría la persona (la contraseña solo si se pide). */
async function fillEmployee({ password = true } = {}) {
  for (const [label, value] of Object.entries(VALID)) await userEvent.type(screen.getByLabelText(label), value);
  await userEvent.type(screen.getByLabelText('Fecha de nacimiento'), '01011990');
  if (password) {
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Segura123');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Segura123');
  }
}

const submitForm = (button: string) => {
  const form = screen.getByRole('button', { name: button }).closest('form');
  if (!form) throw new Error('sin formulario');
  fireEvent.submit(form);
};

afterEach(() => vi.unstubAllGlobals());

/** Responde la confirmación previa al envío (crear, editar...) con el botón indicado. */
async function answer(role: 'dialog' | 'alertdialog', title: string, button: string) {
  const dialog = await screen.findByRole(role, { name: title });
  await userEvent.click(within(dialog).getByRole('button', { name: button }));
  return dialog;
}

describe('Empleados: listado', () => {
  it('muestra a cada empleado con su departamento, registro facial y estado; una fila abre su expediente', async () => {
    mockFetch(apiOk(page([ana, luis])));
    renderEmployees('/company/employees');
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    const row = (await screen.findByText('Ana Ruiz')).closest('tr')!;
    expect(screen.getByText('2 registrados')).toBeInTheDocument();
    expect(within(row).getByText('Producción')).toBeInTheDocument();
    expect(within(row).getByText('Validado')).toBeInTheDocument();
    expect(within(screen.getByText('Luis Paz').closest('tr')!).getByText('Sin departamento')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Solicitar verificación a todos' })).toHaveAttribute('href', '/company/employees/reverify-all');
    await userEvent.click(row);
    expect(await screen.findByText('Expediente del empleado')).toBeInTheDocument();
  });

  it('sin empleados invita a registrar el primero y no ofrece la verificación masiva', async () => {
    mockFetch(apiOk(page([])));
    renderEmployees('/company/employees');
    expect(await screen.findByText('Sin empleados')).toBeInTheDocument();
    expect(screen.getByText('Registra al primer empleado para empezar.')).toBeInTheDocument();
    expect(screen.getByText('0 registrados')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar el primero' })).toHaveAttribute('href', '/company/employees/new');
    expect(screen.queryByRole('link', { name: 'Solicitar verificación a todos' })).toBeNull();
  });

  it('buscar y filtrar se piden al servidor; sin coincidencias lo dice', async () => {
    const { calls } = mockFetch((call) => apiOk(page(call.url.includes('search=') ? [] : [ana])));
    renderEmployees('/company/employees');
    await screen.findByText('Ana Ruiz');
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: /^Inactiv/ }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain('active=false'));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar empleados' }), 'zzz');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    expect(calls.at(-1)?.url).toContain('search=zzz');
  });

  it('si no carga lo avisa en un popup con "Reintentar"', async () => {
    mockFetch(apiFail(403, 'FORBIDDEN', 'No tienes acceso a esta pantalla'), apiOk(page([ana])));
    renderEmployees('/company/employees');
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los empleados' });
    expect(popup).toHaveTextContent('No tienes acceso a esta pantalla');
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
  });
});

describe('Empleados: alta', () => {
  it('registra con los datos verificados en vivo y abre su expediente con lo que sigue', async () => {
    const { calls } = mockFetch((call) => (call.url.startsWith('/api/validation') ? live(call) : apiOk({ ...ana, id: 9, full_name: 'Eva Sol' }, { status: 201 })));
    renderEmployees('/company/employees/new');
    const register = screen.getByRole('button', { name: 'Registrar empleado' });
    expect(register).toBeDisabled();
    expect(register).toHaveAttribute('title', 'Completa correctamente todos los campos obligatorios');
    await fillEmployee();
    await userEvent.click(screen.getByRole('checkbox', { name: /Excepción de prenda de cabeza/ }));
    await waitFor(() => expect(register).toBeEnabled());
    expect(register).not.toHaveAttribute('title');
    await userEvent.click(register);
    // Antes de enviar se confirma lo que se registrará (la contraseña nunca se muestra).
    const confirm = await answer('dialog', '¿Registrar a Eva Sol?', 'Cancelar');
    const facts = within(confirm).getByRole('region', { name: 'Se registrará' });
    expect(facts).toHaveTextContent('Correo electrónicoeva@empresa.com');
    expect(facts).toHaveTextContent('Fecha de nacimiento');
    expect(facts).toHaveTextContent('Excepción de prenda de cabezaSí');
    expect(facts).toHaveTextContent('Contraseña••••••••');
    expect(facts).not.toHaveTextContent('Segura123');
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false); // cancelar no envía nada
    expect(screen.getByLabelText('Nombres')).toHaveValue('Eva'); // y el formulario sigue igual
    await userEvent.click(register);
    await answer('dialog', '¿Registrar a Eva Sol?', 'Registrar empleado');

    expect(await screen.findByText('Expediente del empleado')).toBeInTheDocument();
    const popup = await screen.findByRole('dialog', { name: 'Empleado registrado' });
    expect(popup).toHaveTextContent('Eva Sol ya puede iniciar sesión con su correo y contraseña.');
    expect(popup).toHaveTextContent('Recibirás la solicitud en Validaciones');
    const { url, body } = posted(calls, 'POST');
    expect(url).toBe('/api/employees');
    expect(body).toMatchObject({ first_name: 'Eva', birth_date: '1990-01-01', phone: '+526621234567', password: 'Segura123', headwear_exempt: true });
    expect(body).not.toHaveProperty('password_confirm'); // la confirmación nunca se envía
  });

  it('persona que ya trabaja en otra empresa: se vincula su cuenta sin pedir contraseña', async () => {
    const { calls } = mockFetch((call) =>
      call.url.startsWith('/api/validation') ? live(call, { email: 'LINKABLE' }) : apiOk({ ...ana, id: 9, full_name: 'Eva Sol', shared_account: true }, { status: 201 }),
    );
    renderEmployees('/company/employees/new');
    await fillEmployee({ password: false });
    expect(await screen.findByText('Esta persona ya tiene cuenta en Employee Time Clock')).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
    const register = screen.getByRole('button', { name: 'Registrar empleado' });
    await waitFor(() => expect(register).toBeEnabled());
    await userEvent.click(register);
    const confirm = await answer('dialog', '¿Vincular a Eva Sol a tu empresa?', 'Vincular a mi empresa');
    expect(within(confirm).getByRole('region', { name: 'Se vinculará' })).not.toHaveTextContent('Contraseña');

    const popup = await screen.findByRole('dialog', { name: 'Persona vinculada a tu empresa' });
    expect(popup).toHaveTextContent('Eva Sol usa su misma cuenta');
    expect(posted(calls, 'POST').body).not.toHaveProperty('password'); // conserva la suya
  });

  it('datos incompletos: enviar con Enter no llama a la API y resume lo que falta', async () => {
    const { calls } = mockFetch((call) => live(call));
    renderEmployees('/company/employees/new');
    await userEvent.type(screen.getByLabelText('Nombres'), 'Eva');
    submitForm('Registrar empleado');
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(popup).toHaveTextContent('La fecha de nacimiento es obligatoria');
    expect(popup).not.toHaveTextContent('CURP'); // opcional
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
  });

  it('sin RFC, CURP ni NSS (opcionales): se registra y viajan como null', async () => {
    const { calls } = mockFetch((call) => (call.url.startsWith('/api/validation') ? live(call) : apiOk({ ...ana, id: 9, full_name: 'Eva Sol' }, { status: 201 })));
    renderEmployees('/company/employees/new');
    await fillEmployee();
    for (const label of ['CURP', 'RFC', 'No. de Seguridad Social (NSS)']) await userEvent.clear(screen.getByLabelText(label));
    const register = screen.getByRole('button', { name: 'Registrar empleado' });
    await waitFor(() => expect(register).toBeEnabled());
    await userEvent.click(register);
    const confirm = await answer('dialog', '¿Registrar a Eva Sol?', 'Registrar empleado');
    expect(within(confirm).getByRole('region', { name: 'Se registrará' })).not.toHaveTextContent(/RFC|CURP|NSS/);
    await screen.findByText('Expediente del empleado');
    expect(posted(calls, 'POST').body).toMatchObject({ rfc: null, curp: null, nss: null, employee_number: 'EMP-9' });
  });

  it('un dato ya registrado que responde el servidor se marca en su campo', async () => {
    mockFetch((call) => (call.url.startsWith('/api/validation') ? live(call) : apiFail(409, 'EMPLOYEE_NUMBER_TAKEN', 'Ese número de empleado ya existe')));
    renderEmployees('/company/employees/new');
    await fillEmployee();
    const register = screen.getByRole('button', { name: 'Registrar empleado' });
    await waitFor(() => expect(register).toBeEnabled());
    await userEvent.click(register);
    await answer('dialog', '¿Registrar a Eva Sol?', 'Registrar empleado');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo guardar' })).toHaveTextContent('Ese número de empleado ya existe');
    expect(screen.getByLabelText('No. de empleado')).toHaveAccessibleDescription(/Ese número de empleado ya existe/);
  });

  it('"Cancelar" vuelve a la pantalla anterior', async () => {
    mockFetch((call) => (call.url.startsWith('/api/validation') ? live(call) : apiOk(page([ana]))));
    renderEmployees('/company/employees');
    await userEvent.click((await screen.findAllByRole('link', { name: 'Registrar empleado' }))[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
  });
});

describe('Empleados: edición', () => {
  function serve(current: Employee, onPut: () => Response = () => apiOk(current)) {
    return mockFetch((call) => {
      if (call.url.startsWith('/api/validation')) return live(call);
      return call.init.method === 'PUT' ? onPut() : apiOk(current);
    });
  }

  it('llena el formulario; sin cambios no hay nada que guardar; guarda solo lo modificado', async () => {
    const { calls } = serve(ana);
    renderEmployees('/company/employees/7/edit');
    expect(await screen.findByLabelText('Nombres')).toHaveValue('Ana');
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByLabelText('RFC')).toHaveValue('RUAA900101AB1');
    expect(screen.queryByLabelText(/Confirmar contraseña/)).toBeNull(); // vacía = no cambiarla
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    await waitFor(() => expect(save).toHaveAttribute('title', 'No hay cambios por guardar'));
    expect(save).toBeDisabled();
    submitForm('Guardar cambios'); // Enter sin cambios: no se envía nada
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);

    await userEvent.clear(screen.getByLabelText('Nombres'));
    await userEvent.type(screen.getByLabelText('Nombres'), ' Anita ');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Nueva1234');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Nueva1234');
    await userEvent.click(screen.getByRole('checkbox', { name: /Excepción de prenda de cabeza/ }));
    await waitFor(() => expect(save).toBeEnabled());
    expect(save).not.toHaveAttribute('title');
    await userEvent.click(save);
    // La confirmación muestra solo lo que cambia ("antes → después"); la contraseña nunca se ve.
    const confirm = await answer('dialog', '¿Guardar los cambios de Ana Ruiz?', 'Cancelar');
    const rows = within(within(confirm).getByRole('region', { name: 'Cambios' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'NombresAntes: AnaDespués: Anita',
      'ContraseñaAntes: ••••••••Después: Nueva',
      'Excepción de prenda de cabezaAntes: NoDespués: Sí',
    ]);
    expect(confirm).toHaveTextContent('Deberá entrar con la nueva contraseña');
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false); // cancelar no envía nada
    expect(screen.getByLabelText('Nombres')).toHaveValue(' Anita ');
    await userEvent.click(save);
    await answer('dialog', '¿Guardar los cambios de Ana Ruiz?', 'Guardar cambios');

    expect(await screen.findByText('Expediente del empleado')).toBeInTheDocument();
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
    expect(posted(calls, 'PUT')).toEqual({ url: '/api/employees/7', body: { first_name: 'Anita', password: 'Nueva1234', headwear_exempt: true } });
  });

  it('sin RFC, CURP ni NSS (opcionales) ni teléfono (cuentas anteriores): solo se pide el teléfono', async () => {
    const { calls } = serve({ ...ana, rfc: null, curp: null, nss: null, phone: null, headwear_exempt: true });
    renderEmployees('/company/employees/7/edit');
    expect(await screen.findByLabelText('RFC')).toHaveValue('');
    expect(screen.getByLabelText('Teléfono celular')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /Excepción de prenda de cabeza/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toHaveAttribute('title', 'Completa correctamente todos los campos obligatorios');
    await userEvent.type(screen.getByLabelText('Apellidos'), ' López');
    submitForm('Guardar cambios');
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(popup).toHaveTextContent('El teléfono es obligatorio');
    expect(popup).not.toHaveTextContent('RFC');
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
  });

  it('borrar un documento opcional se confirma "antes → Sin capturar" y viaja como null', async () => {
    const { calls } = serve(ana);
    renderEmployees('/company/employees/7/edit');
    await userEvent.clear(await screen.findByLabelText('RFC'));
    await userEvent.clear(screen.getByLabelText('No. de Seguridad Social (NSS)'));
    await userEvent.type(screen.getByLabelText('No. de Seguridad Social (NSS)'), '12345678911');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    const confirm = await answer('dialog', '¿Guardar los cambios de Ana Ruiz?', 'Guardar cambios');
    const rows = within(within(confirm).getByRole('region', { name: 'Cambios' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'RFCAntes: RUAA900101AB1Después: Sin capturar',
      'NSSAntes: 12345678903Después: 12345678911',
    ]);
    await screen.findByText('Expediente del empleado');
    expect(posted(calls, 'PUT').body).toEqual({ rfc: null, nss: '12345678911' });
  });

  it('cuenta compartida con otra empresa: correo, teléfono y contraseña bloqueados', async () => {
    serve({ ...ana, shared_account: true });
    renderEmployees('/company/employees/7/edit');
    expect(await screen.findByLabelText('Correo electrónico')).toBeDisabled();
    expect(screen.getByLabelText('Teléfono celular')).toBeDisabled();
    expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();
  });

  it('si el servidor rechaza el cambio lo marca en el campo y no sale de la pantalla', async () => {
    serve(ana, () => apiFail(409, 'EMAIL_TAKEN', 'El correo ya está registrado'));
    renderEmployees('/company/employees/7/edit');
    const email = await screen.findByLabelText('Correo electrónico');
    await userEvent.clear(email);
    await userEvent.type(email, 'otra@empresa.com');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    const confirm = await answer('dialog', '¿Guardar los cambios de Ana Ruiz?', 'Guardar cambios');
    expect(confirm).not.toHaveTextContent('Deberá entrar con la nueva contraseña'); // la contraseña no cambia
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo guardar' })).toBeInTheDocument();
    expect(email).toHaveAccessibleDescription(/El correo ya está registrado/);
    expect(screen.queryByText('Expediente del empleado')).toBeNull();
  });

  it('si no carga ofrece volver a cargar', async () => {
    mockFetch(apiFail(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado'), apiOk(ana));
    renderEmployees('/company/employees/7/edit');
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar el empleado' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByLabelText('Nombres')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByLabelText('Nombres')).toHaveValue('Ana');
  });

  it('"Cancelar" vuelve al expediente', async () => {
    serve(ana);
    renderEmployees('/company/employees/7');
    await userEvent.click(screen.getByRole('link', { name: 'Ir a editar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Expediente del empleado')).toBeInTheDocument();
  });
});

describe('Empleados: solicitar nueva verificación', () => {
  it('sin motivo no envía cuerpo', async () => {
    const { calls } = mockFetch(apiOk(ana));
    renderEmployees('/company/employees/7/reverify');
    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar verificación' }));
    const confirm = await answer('alertdialog', '¿Solicitar a Ana Ruiz verificar su identidad?', 'Cancelar');
    expect(confirm).toHaveTextContent('Sin motivo: verá que la empresa pidió verificar su identidad');
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false); // cancelar no envía nada
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar verificación' }));
    await answer('alertdialog', '¿Solicitar a Ana Ruiz verificar su identidad?', 'Solicitar verificación');
    expect(await screen.findByText('Verificación solicitada')).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === 'POST');
    expect(post?.url).toBe('/api/employees/7/face/reset');
    expect(post?.init.body).toBeUndefined();
    expect(screen.getByText('Expediente del empleado')).toBeInTheDocument();
  });

  it('si el empleado no carga ofrece volver a cargar', async () => {
    mockFetch(apiFail(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado'), apiOk(ana));
    renderEmployees('/company/employees/7/reverify');
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar el empleado' });
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText(/Ana deberá registrar su rostro/)).toBeInTheDocument();
  });
});

describe('Empleados: cada falla se explica con su título', () => {
  it('solicitar nueva verificación que el servidor no acepta', async () => {
    mockFetch((call) => (call.init.method === 'POST' ? apiFail(409, 'EMPLOYEE_INACTIVE', 'El empleado está inactivo') : apiOk(ana)));
    renderEmployees('/company/employees/7/reverify');
    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar verificación' }));
    await answer('alertdialog', '¿Solicitar a Ana Ruiz verificar su identidad?', 'Solicitar verificación');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo solicitar la verificación' })).toHaveTextContent('El empleado está inactivo');
  });
});

describe('Empleados en inglés (en-US)', () => {
  it('el listado: título, conteo, columnas, búsqueda y vacíos en inglés', async () => {
    await setLocale('en-US');
    mockFetch(apiOk(page([ana, luis])));
    renderEmployees('/company/employees');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await screen.findByText('Ana Ruiz');
    expect(screen.getByRole('heading', { name: 'Employees' })).toBeInTheDocument();
    expect(screen.getByText('2 registered')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Employee', 'Email', 'Department', 'Face enrollment', 'Status']);
    expect(within(screen.getByText('Luis Paz').closest('tr')!).getByText('No department')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request verification from everyone' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search employees' })).toHaveAttribute('placeholder', 'Search by name, number, RFC or email');
  });

  it('el alta: campos, confirmación (que sigue al idioma con el popup abierto) y aviso en inglés', async () => {
    await setLocale('en-US');
    mockFetch((call) => (call.url.startsWith('/api/validation') ? live(call) : apiOk({ ...ana, id: 9, full_name: 'Eva Sol' }, { status: 201 })));
    renderEmployees('/company/employees/new');
    expect(screen.getByText('Optional · 13 characters. Must match the date of birth')).toBeInTheDocument();
    expect(screen.getByText('Optional · 11 digits, as registered with the IMSS')).toBeInTheDocument();
    const english = { 'First names': 'Eva', 'Last names': 'Sol', CURP: VALID.CURP, RFC: VALID.RFC, 'Social Security No. (NSS)': VALID['No. de Seguridad Social (NSS)'], 'Employee No.': 'EMP-9', 'Mobile phone': '6621234567', Email: 'eva@empresa.com' };
    for (const [label, value] of Object.entries(english)) await userEvent.type(screen.getByLabelText(label), value);
    await userEvent.type(screen.getByLabelText('Date of birth'), '01011990');
    await userEvent.type(screen.getByLabelText('Password'), 'Segura123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Segura123');
    expect(screen.getByText('At least 8 characters, with uppercase, lowercase and a number')).toBeInTheDocument();
    const register = screen.getByRole('button', { name: 'Add employee' });
    await waitFor(() => expect(register).toBeEnabled());
    await userEvent.click(register);

    const confirm = await screen.findByRole('dialog', { name: 'Add Eva Sol?' });
    const facts = within(confirm).getByRole('region', { name: 'To be registered' });
    expect(facts).toHaveTextContent('First namesEva');
    expect(facts).toHaveTextContent('Emaileva@empresa.com');
    expect(facts).toHaveTextContent('Employee No.EMP-9');
    expect(facts).toHaveTextContent('Password••••••••');
    // Cambiar el idioma con la confirmación abierta la traduce al instante (sin cerrarla).
    await act(() => setLocale('es-MX'));
    expect(screen.getByRole('dialog', { name: '¿Registrar a Eva Sol?' })).toHaveTextContent('No. de empleadoEMP-9');
    await act(() => setLocale('en-US'));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Add Eva Sol?' })).getByRole('button', { name: 'Add employee' }));

    const popup = await screen.findByRole('dialog', { name: 'Employee added' });
    expect(popup).toHaveTextContent('Eva Sol can now sign in with their email and password.');
    expect(popup).toHaveTextContent('Their personal QR code was generated.');
  });
});
