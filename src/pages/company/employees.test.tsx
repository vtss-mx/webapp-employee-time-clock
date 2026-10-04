import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  face_learned_samples: 0,
  face_last_learned_at: null,
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

describe('Empleados: listado', () => {
  it('muestra a cada empleado con su departamento, registro facial y estado; una fila abre su expediente', async () => {
    mockFetch(apiOk(page([ana, luis])));
    renderEmployees('/company/employees');
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
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
    expect(await screen.findByText('No hay empleados registrados')).toBeInTheDocument();
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
    expect(await screen.findByText('Ningún empleado coincide con la búsqueda')).toBeInTheDocument();
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

    const popup = await screen.findByRole('dialog', { name: 'Persona vinculada a tu empresa' });
    expect(popup).toHaveTextContent('Eva Sol ya trabajaba en otra empresa');
    expect(posted(calls, 'POST').body).not.toHaveProperty('password'); // conserva la suya
  });

  it('datos incompletos: enviar con Enter no llama a la API y resume lo que falta', async () => {
    const { calls } = mockFetch((call) => live(call));
    renderEmployees('/company/employees/new');
    await userEvent.type(screen.getByLabelText('Nombres'), 'Eva');
    submitForm('Registrar empleado');
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa la información' });
    expect(popup).toHaveTextContent('La CURP es obligatoria');
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
  });

  it('un dato ya registrado que responde el servidor se marca en su campo', async () => {
    mockFetch((call) => (call.url.startsWith('/api/validation') ? live(call) : apiFail(409, 'EMPLOYEE_NUMBER_TAKEN', 'Ese número de empleado ya existe')));
    renderEmployees('/company/employees/new');
    await fillEmployee();
    const register = screen.getByRole('button', { name: 'Registrar empleado' });
    await waitFor(() => expect(register).toBeEnabled());
    await userEvent.click(register);
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

    expect(await screen.findByText('Expediente del empleado')).toBeInTheDocument();
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
    expect(posted(calls, 'PUT')).toEqual({ url: '/api/employees/7', body: { first_name: 'Anita', password: 'Nueva1234', headwear_exempt: true } });
  });

  it('empleado registrado antes de existir RFC, CURP, NSS y teléfono: se piden al guardar', async () => {
    const { calls } = serve({ ...ana, rfc: null, curp: null, nss: null, phone: null, headwear_exempt: true });
    renderEmployees('/company/employees/7/edit');
    expect(await screen.findByLabelText('RFC')).toHaveValue('');
    expect(screen.getByLabelText('Teléfono celular')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /Excepción de prenda de cabeza/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toHaveAttribute('title', 'Completa correctamente todos los campos obligatorios');
    await userEvent.type(screen.getByLabelText('Apellidos'), ' López');
    submitForm('Guardar cambios');
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa la información' });
    expect(popup).toHaveTextContent('El RFC es obligatorio');
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
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
