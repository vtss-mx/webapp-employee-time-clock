import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FeedbackProvider } from '../../context/FeedbackContext';
import { apiFail, apiOk, liveCheck, mockFetch, type MockCall } from '../../test/http';
import { WithCatalogs } from '../../test/render';
import type { CompanyAdmin, CompanyDetail } from '../../types';
import { CompanyAdminFormPage } from './CompanyAdminFormPage';
import { CompanyCreatePage } from './CompanyCreatePage';
import { CompanyDetailPage } from './CompanyDetailPage';
import { CompanyEditPage } from './CompanyEditPage';

const company: CompanyDetail = {
  id: 4,
  name: 'Panificadora',
  legal_name: 'Panificadora del Norte SA de CV',
  rfc: 'PNO120315AB1',
  phone: '+526621234567',
  active: true,
  max_employees: 50,
  api_enabled: false,
  employee_count: 3,
  admin_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
/** Empresa capturada solo con lo mínimo (sin razón social, RFC, teléfono ni límite). */
const bare: CompanyDetail = { ...company, legal_name: null, rfc: null, phone: null, max_employees: null };
const admin: CompanyAdmin = { id: 9, email: 'admin@pan.com', active: false, last_login_at: null, created_at: '2026-01-01T00:00:00Z' };
const adminsPage = (items: CompanyAdmin[]) => apiOk({ items, total: items.length, page: 1, size: 10 });

/**
 * La pantalla con historial (de dónde se llegó, para "Cancelar") y las pantallas a las que lleva.
 * El listado de empresas es la pantalla anterior.
 */
function renderFrom(path: string, route: string, page: ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/admin/companies', route]} initialIndex={1}>
      <FeedbackProvider>
        <WithCatalogs>
          <Routes>
            <Route path={path} element={page} />
            <Route path="/admin/companies" element={<p>Listado de empresas</p>} />
            {path !== '/admin/companies/:id' && <Route path="/admin/companies/:id" element={<p>Detalle de empresa</p>} />}
          </Routes>
        </WithCatalogs>
      </FeedbackProvider>
    </MemoryRouter>,
  );
}
/** Envío del formulario sin pasar por el botón (Enter de un gestor de contraseñas, requestSubmit...). */
const forceSubmit = (button: HTMLElement) => fireEvent.submit(button.closest('form') as HTMLFormElement);
const sent = (calls: MockCall[], method: string) => calls.filter((c) => c.init.method === method);

describe('CompanyCreatePage (alta de empresa con su administrador)', () => {
  async function fillCompany() {
    await userEvent.type(screen.getByLabelText('Nombre comercial'), 'Panificadora');
    await userEvent.type(screen.getByLabelText('Razón social'), 'Panificadora del Norte SA de CV');
    await userEvent.type(screen.getByLabelText('RFC de la empresa'), 'PNO120315AB1');
    await userEvent.type(screen.getByLabelText('Teléfono'), '6621234567');
    await userEvent.type(screen.getByLabelText('Correo del administrador'), 'Admin@Pan.com');
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'Empresa1234');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Empresa1234');
  }
  const server = (create: () => Response) => mockFetch((call) => (call.url.includes('/validation') ? liveCheck() : create()));

  it('registra la empresa, lleva a su detalle y explica cómo entra su administrador', async () => {
    const { calls } = server(() => apiOk(company, { status: 201 }));
    renderFrom('/admin/companies/new', '/admin/companies/new', <CompanyCreatePage />);
    const submit = screen.getByRole('button', { name: 'Registrar empresa' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('title', 'Completa correctamente todos los campos obligatorios');
    await fillCompany();
    await waitFor(() => expect(submit).toBeEnabled());
    expect(submit).not.toHaveAttribute('title');
    await userEvent.click(submit);
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    const popup = await screen.findByRole('dialog', { name: 'Empresa registrada' });
    expect(popup).toHaveTextContent('Panificadora ya puede usar Employee Time Clock.');
    expect(popup).toHaveTextContent('Su administrador inicia sesión con admin@pan.com.');
    expect(popup).toHaveTextContent('Sin acceso a Integraciones (API); puedes dárselo desde su ficha.');
    const [post] = sent(calls, 'POST');
    expect(post.url).toBe('/api/admin/companies');
    expect(JSON.parse(post.init.body as string)).toMatchObject({ name: 'Panificadora', rfc: 'PNO120315AB1', max_employees: null, api_enabled: false, admin_password: 'Empresa1234' });
  });

  it('el ADMIN puede darle Integraciones (API) desde el alta (por omisión no la tiene)', async () => {
    const { calls } = server(() => apiOk({ ...company, api_enabled: true }, { status: 201 }));
    renderFrom('/admin/companies/new', '/admin/companies/new', <CompanyCreatePage />);
    const api = screen.getByRole('switch', { name: 'Integraciones (API)' });
    expect(api).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(api);
    expect(api).toHaveAttribute('aria-checked', 'true');
    await fillCompany();
    const submit = screen.getByRole('button', { name: 'Registrar empresa' });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    const popup = await screen.findByRole('dialog', { name: 'Empresa registrada' });
    expect(popup).toHaveTextContent('Tiene acceso a Integraciones (API): puede crear sus llaves.');
    expect(JSON.parse(sent(calls, 'POST')[0].init.body as string)).toMatchObject({ api_enabled: true });
  });

  it('un RFC ya registrado se marca en su campo y se avisa en popup; la pantalla sigue disponible', async () => {
    server(() => apiFail(409, 'COMPANY_RFC_TAKEN', 'El RFC ya está registrado'));
    renderFrom('/admin/companies/new', '/admin/companies/new', <CompanyCreatePage />);
    await fillCompany();
    const submit = screen.getByRole('button', { name: 'Registrar empresa' });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo registrar la empresa' });
    expect(popup).toHaveTextContent('El RFC ya está registrado');
    expect(screen.getByLabelText('RFC de la empresa')).toHaveAccessibleDescription(/El RFC ya está registrado/);
    expect(screen.queryByText('Detalle de empresa')).toBeNull();
  });

  it('incompleto: un envío forzado no llega a la API; "Cancelar" vuelve a donde estaba', async () => {
    const { calls } = server(() => apiOk(company));
    renderFrom('/admin/companies/new', '/admin/companies/new', <CompanyCreatePage />);
    await userEvent.type(screen.getByLabelText('Nombre comercial'), 'Panificadora');
    forceSubmit(screen.getByRole('button', { name: 'Registrar empresa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Listado de empresas')).toBeInTheDocument();
    expect(sent(calls, 'POST')).toHaveLength(0);
  });
});

describe('CompanyEditPage (solo se envía lo que cambió)', () => {
  const server = (...loads: Response[]) =>
    mockFetch((call) => {
      if (call.url.includes('/validation')) return liveCheck();
      if (call.init.method === 'PUT') return apiOk({ ...company, max_employees: 80 });
      return loads.length > 1 ? (loads.shift() as Response) : loads[0];
    });

  it('carga la empresa en el formulario; sin cambios no guarda; guarda solo el campo cambiado', async () => {
    const { calls } = server(apiOk(company));
    renderFrom('/admin/companies/:id/edit', '/admin/companies/4/edit', <CompanyEditPage />);
    expect(screen.getByLabelText('Cargando')).toBeInTheDocument();
    expect(await screen.findByLabelText('Nombre comercial')).toHaveValue('Panificadora');
    expect(screen.getByLabelText('Límite de empleados')).toHaveValue('50');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    await waitFor(() => expect(save).toHaveAttribute('title', 'No hay cambios por guardar'));
    expect(save).toBeDisabled();
    forceSubmit(save);

    await userEvent.clear(screen.getByLabelText('Límite de empleados'));
    await userEvent.type(screen.getByLabelText('Límite de empleados'), '80');
    await waitFor(() => expect(save).toBeEnabled());
    expect(save).not.toHaveAttribute('title');
    await userEvent.click(save);
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Cambios guardados' })).toBeInTheDocument();
    const puts = sent(calls, 'PUT');
    expect(puts).toHaveLength(1); // el envío forzado sin cambios no llegó a la API
    expect(puts[0].url).toBe('/api/admin/companies/4');
    expect(JSON.parse(puts[0].init.body as string)).toEqual({ max_employees: 80 });
  });

  it('una empresa sin datos obligatorios pide completarlos antes de guardar; "Cancelar" regresa', async () => {
    server(apiOk(bare));
    renderFrom('/admin/companies/:id/edit', '/admin/companies/4/edit', <CompanyEditPage />);
    expect(await screen.findByLabelText('Razón social')).toHaveValue('');
    expect(screen.getByLabelText('RFC de la empresa')).toHaveValue('');
    expect(screen.getByLabelText('Límite de empleados')).toHaveValue('');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(save).toHaveAttribute('title', 'Completa correctamente todos los campos obligatorios');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Listado de empresas')).toBeInTheDocument();
  });

  it('si la empresa no carga: popup y "Volver a cargar" dentro del panel', async () => {
    server(apiFail(500, 'INTERNAL_ERROR', 'Falló el servidor'), apiOk(company));
    renderFrom('/admin/companies/:id/edit', '/admin/companies/4/edit', <CompanyEditPage />);
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar la empresa' });
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    expect(screen.getByRole('heading', { name: 'Editar empresa' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByLabelText('Nombre comercial')).toHaveValue('Panificadora');
  });
});

describe('CompanyDetailPage (estado de la empresa y datos sin capturar)', () => {
  function renderDetail(detail: CompanyDetail, admins: () => Response | Promise<Response> = () => adminsPage([])) {
    const mock = mockFetch((call) => {
      if (call.url.includes('/admins')) return call.init.method === 'PATCH' ? apiOk(detail) : admins();
      if (call.init.method === 'PATCH') return apiOk({ ...detail, active: JSON.parse(call.init.body as string).active as boolean });
      if (call.init.method === 'PUT') return apiOk({ ...detail, ...(JSON.parse(call.init.body as string) as Partial<CompanyDetail>) });
      return apiOk(detail);
    });
    renderFrom('/admin/companies/:id', '/admin/companies/4', <CompanyDetailPage />);
    return mock.calls;
  }

  it('desactivada y sin datos opcionales: "Sin capturar", sin límite; activarla no pide confirmación', async () => {
    const calls = renderDetail({ ...bare, active: false });
    expect(await screen.findByRole('heading', { name: 'Panificadora' })).toBeInTheDocument();
    expect(screen.getAllByText('Sin capturar')).toHaveLength(3); // razón social, RFC y teléfono
    expect(screen.getByText(/Sin RFC · desde/)).toBeInTheDocument();
    expect(screen.getByText('empleados · sin límite')).toBeInTheDocument();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByText('Desactivada: su personal no puede iniciar sesión')).toBeInTheDocument();
    expect(await screen.findByText('No hay administradores registrados')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    expect(await screen.findByRole('dialog', { name: 'Empresa activada' })).toHaveTextContent('Su personal ya puede iniciar sesión.');
    expect(screen.queryByRole('alertdialog')).toBeNull(); // sin confirmación previa
    expect(JSON.parse(sent(calls, 'PATCH')[0].init.body as string)).toEqual({ active: true });
    expect(screen.getByText('Operando')).toBeInTheDocument();
  });

  it('desactivar pide confirmación: cancelar no envía nada; confirmar la desactiva', async () => {
    const calls = renderDetail({ ...company, employee_count: 46 });
    const meter = await screen.findByRole('meter', { name: 'Uso del límite de empleados' });
    expect(meter).toHaveAttribute('aria-valuenow', '92');
    expect(meter).toHaveClass('is-high'); // cerca del límite
    expect(screen.getByText('de 50 empleados')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Desactivar Panificadora' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(sent(calls, 'PATCH')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Desactivar empresa' }));
    expect(await screen.findByRole('dialog', { name: 'Empresa desactivada' })).toHaveTextContent('Su personal ya no puede iniciar sesión.');
    expect(sent(calls, 'PATCH')[0].url).toBe('/api/admin/companies/4/status');
    expect(screen.getByRole('button', { name: 'Activar' })).toBeInTheDocument();
  });

  it('Integraciones (API): darla no pide confirmación; quitarla sí (sus sistemas dejan de recibir datos)', async () => {
    const calls = renderDetail(company);
    const api = await screen.findByRole('switch', { name: 'Integraciones (API)' });
    expect(api).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Sin acceso: la pantalla no aparece en su menú y sus llaves no funcionan.')).toBeInTheDocument();

    await userEvent.click(api);
    expect(await screen.findByRole('dialog', { name: 'Integraciones activadas' })).toHaveTextContent('sus llaves funcionan');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    const [enable] = sent(calls, 'PUT');
    expect(enable.url).toBe('/api/admin/companies/4');
    expect(JSON.parse(enable.init.body as string)).toEqual({ api_enabled: true });
    expect(api).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Desactivar' })).not.toHaveAttribute('aria-busy', 'true'); // solo el interruptor estuvo ocupado

    await userEvent.click(api);
    const dialog = screen.getByRole('alertdialog', { name: 'Quitar Integraciones a Panificadora' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(sent(calls, 'PUT')).toHaveLength(1);
    expect(api).toHaveAttribute('aria-checked', 'true'); // sin confirmar, nada cambia

    await userEvent.click(api);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar acceso' }));
    expect(await screen.findByRole('dialog', { name: 'Integraciones desactivadas' })).toHaveTextContent('Sus llaves ya no funcionan');
    expect(JSON.parse(sent(calls, 'PUT')[1].init.body as string)).toEqual({ api_enabled: false });
    expect(api).toHaveAttribute('aria-checked', 'false');
  });

  it('"Ver empleados" lleva a la lista de solo consulta de la empresa', async () => {
    renderDetail(company);
    expect(await screen.findByRole('link', { name: 'Ver empleados' })).toHaveAttribute('href', '/admin/companies/4/employees');
  });

  it('mientras se vuelve a pedir la página de administradores, la lista se atenúa', async () => {
    let release: (response: Response) => void = () => undefined;
    let requests = 0;
    renderDetail(company, () => (requests++ === 0 ? adminsPage([admin]) : new Promise<Response>((resolve) => (release = resolve))));
    await userEvent.click(await screen.findByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(screen.getByText('admin@pan.com').closest('ul')).toHaveClass('is-loading'));
    release(adminsPage([{ ...admin, active: true }]));
    await waitFor(() => expect(screen.getByText('admin@pan.com').closest('ul')).not.toHaveClass('is-loading'));
    expect(within(screen.getByText('admin@pan.com').closest('li') as HTMLElement).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
  });

  it('si la empresa no carga, ofrece reintentar con el regreso al listado', async () => {
    let attempts = 0;
    mockFetch((call) => {
      if (call.url.includes('/admins')) return adminsPage([]);
      return attempts++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló el servidor') : apiOk(company);
    });
    renderFrom('/admin/companies/:id', '/admin/companies/4', <CompanyDetailPage />);
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar la empresa' });
    expect(screen.getByRole('heading', { name: 'Empresa' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByRole('heading', { name: 'Panificadora' })).toBeInTheDocument();
  });
});

describe('CompanyAdminFormPage (estados de carga y envío)', () => {
  it('si la empresa no carga ofrece reintentar; un envío forzado incompleto no llega a la API', async () => {
    let attempts = 0;
    const { calls } = mockFetch((call) => {
      if (call.url.includes('/validation')) return liveCheck();
      return attempts++ === 0 ? apiFail(500, 'INTERNAL_ERROR', 'Falló el servidor') : apiOk(company);
    });
    renderFrom('/admin/companies/:id/admins/new', '/admin/companies/4/admins/new', <CompanyAdminFormPage />);
    await screen.findByRole('alertdialog', { name: 'No se pudo cargar la empresa' });
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    const add = await screen.findByRole('button', { name: 'Agregar' });
    await userEvent.type(screen.getByLabelText('Correo del administrador'), 'rh@pan.com');
    forceSubmit(add);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(sent(calls, 'POST')).toHaveLength(0);
  });
});
