import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FeedbackProvider } from '../../context/FeedbackContext';
import { setLocale } from '../../i18n/core';
import { billingReply } from '../../test/billing';
import { apiFail, apiOk, liveCheck, mockFetch, type MockCall } from '../../test/http';
import { WithCatalogs } from '../../test/render';
import type { CompanyAdmin, CompanyDetail } from '../../types';
import { businessToday, formatDate } from '../../utils/format';
import { CompanyAdminFormPage } from './CompanyAdminFormPage';
import { CompanyCreatePage } from './CompanyCreatePage';
import { CompanyDetailPage } from './CompanyDetailPage';
import { CompanyEditPage } from './CompanyEditPage';

const company: CompanyDetail = {
  id: 4,
  name: 'Panificadora',
  legal_name: 'Panificadora del Norte SA de CV',
  tax_country: 'MX',
  tax_id_type: 'MX_RFC',
  tax_id: 'PNO120315AB1',
  phone: '+526621234567',
  active: true,
  max_employees: 50,
  api_enabled: false,
  max_validators: 0,
  active_validators: 0,
  employee_count: 3,
  admin_count: 1,
  billing_status: 'ACTIVE',
  suspension_reason: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
/** Empresa capturada solo con lo mínimo (sin razón social, identificador fiscal, teléfono ni límite). */
const bare: CompanyDetail = { ...company, legal_name: null, tax_country: null, tax_id_type: null, tax_id: null, phone: null, max_employees: null };
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
/** Lo que se envió a la empresa (sin las vistas previas del cobro, que se piden solas mientras se escribe). */
const sent = (calls: MockCall[], method: string) => calls.filter((c) => c.init.method === method && !c.url.endsWith('/billing/preview'));

describe('CompanyCreatePage (alta de empresa con su administrador)', () => {
  async function fillCompany() {
    await userEvent.type(screen.getByLabelText('Nombre comercial'), 'Panificadora');
    await userEvent.type(screen.getByLabelText('Razón social'), 'Panificadora del Norte SA de CV');
    await userEvent.type(screen.getByLabelText('Identificador fiscal'), 'PNO120315AB1');
    await userEvent.type(screen.getByLabelText('Teléfono'), '6621234567');
    await userEvent.type(screen.getByLabelText('Correo del administrador'), 'Admin@Pan.com');
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'Empresa1234');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Empresa1234');
    await userEvent.type(screen.getByLabelText('Precio por empleado activo'), '120');
  }
  const server = (create: () => Response) => mockFetch((call) => (call.url.includes('/validation') ? liveCheck() : (billingReply(call) ?? create())));
  /** Pide registrar y devuelve la confirmación (lo que se registrará, sin la contraseña). */
  async function askToCreate() {
    const submit = screen.getByRole('button', { name: 'Registrar empresa' });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    return screen.findByRole('dialog', { name: '¿Registrar la empresa Panificadora?' });
  }
  const confirmCreate = async () => userEvent.click(within(await askToCreate()).getByRole('button', { name: 'Registrar empresa' }));

  it('registra la empresa, lleva a su detalle y explica cómo entra su administrador', async () => {
    const { calls } = server(() => apiOk(company, { status: 201 }));
    renderFrom('/admin/companies/new', '/admin/companies/new', <CompanyCreatePage />);
    const submit = screen.getByRole('button', { name: 'Registrar empresa' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('title', 'Completa correctamente todos los campos obligatorios');
    await fillCompany();
    await waitFor(() => expect(submit).toBeEnabled());
    expect(submit).not.toHaveAttribute('title');

    // Primero se confirma lo que se registrará (nunca la contraseña); cancelar no envía nada.
    const dialog = await askToCreate();
    expect(within(dialog).getByText('Nuevo registro')).toBeInTheDocument();
    expect(within(within(dialog).getByRole('region', { name: 'Se registrará' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Nombre comercialPanificadora',
      'Razón socialPanificadora del Norte SA de CV',
      'Identificador fiscalRFC · PNO120315AB1 · México',
      'Teléfono+52 662 123 4567',
      'Límite de validadoresSin validadores (módulo apagado)',
      'Correo del administradoradmin@pan.com',
      'Integraciones (API)No',
      'Modalidad de cobroPor empleado activo',
      'MonedaMXN · Peso mexicano',
      'Precio (sin IVA)$120.00\u00a0MXN por mes',
      'CargoCada mes',
      `Inicio del cobro${formatDate(businessToday())}`,
      'Demo sin cobroSin demo',
      'DescuentoSin descuento',
      'IVA16 %',
      'Días de gracia10 días',
    ]);
    expect(dialog).not.toHaveTextContent('Empresa1234');
    expect(dialog).toHaveTextContent('Comparte la contraseña inicial por un medio seguro.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent(calls, 'POST')).toHaveLength(0);
    expect(screen.getByLabelText('Nombre comercial')).toHaveValue('Panificadora'); // el formulario sigue igual

    await confirmCreate();
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    const popup = await screen.findByRole('dialog', { name: 'Empresa registrada' });
    expect(popup).toHaveTextContent('Panificadora ya puede usar Employee Time Clock.');
    expect(popup).toHaveTextContent('Su administrador inicia sesión con admin@pan.com.');
    expect(popup).toHaveTextContent('Sin acceso a Integraciones (API); puedes dárselo desde su ficha.');
    expect(popup).toHaveTextContent('Sin validadores; puedes darle lugares al editar la empresa.');
    const [post] = sent(calls, 'POST');
    expect(post.url).toBe('/api/admin/companies');
    expect(JSON.parse(post.init.body as string)).toMatchObject({
      name: 'Panificadora',
      tax_country: 'MX',
      tax_id_type: 'MX_RFC',
      tax_id: 'PNO120315AB1',
      max_employees: null,
      max_validators: 0,
      api_enabled: false,
      admin_password: 'Empresa1234',
      billing: { pricing_mode: 'PER_USER', unit_price: '120.00', price_period: 'MONTH', interval_months: 1, starts_on: businessToday(), trial_days: 0, discount: null, tax_rate: '16.00', grace_days: 10 },
    });
  });

  it('el ADMIN puede darle Integraciones (API) y un límite desde el alta (por omisión no los tiene)', async () => {
    const { calls } = server(() => apiOk({ ...company, api_enabled: true }, { status: 201 }));
    renderFrom('/admin/companies/new', '/admin/companies/new', <CompanyCreatePage />);
    const api = screen.getByRole('switch', { name: 'Integraciones (API)' });
    expect(api).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(api);
    expect(api).toHaveAttribute('aria-checked', 'true');
    await fillCompany();
    await userEvent.type(screen.getByLabelText('Límite de empleados'), '25');
    const facts = within(await askToCreate()).getByRole('region', { name: 'Se registrará' });
    expect(facts).toHaveTextContent('Límite de empleados25 empleados');
    expect(facts).toHaveTextContent('Integraciones (API)Sí');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Registrar empresa' }));
    const popup = await screen.findByRole('dialog', { name: 'Empresa registrada' });
    expect(popup).toHaveTextContent('Tiene acceso a Integraciones (API): puede crear sus llaves.');
    expect(JSON.parse(sent(calls, 'POST')[0].init.body as string)).toMatchObject({ api_enabled: true, max_employees: 25 });
  });

  it('un identificador fiscal ya registrado se marca en su campo y se avisa en popup; la pantalla sigue disponible', async () => {
    server(() => apiFail(409, 'COMPANY_TAX_ID_TAKEN', 'Ya existe una empresa con ese identificador fiscal'));
    renderFrom('/admin/companies/new', '/admin/companies/new', <CompanyCreatePage />);
    await fillCompany();
    await confirmCreate();
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo registrar la empresa' });
    expect(popup).toHaveTextContent('Ya existe una empresa con ese identificador fiscal');
    expect(screen.getByLabelText('Identificador fiscal')).toHaveAccessibleDescription(/Ya existe una empresa con ese identificador fiscal/);
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
      const billing = billingReply(call);
      if (billing) return billing;
      if (call.init.method === 'PUT') return apiOk({ ...company, max_employees: 80 });
      return loads.length > 1 ? (loads.shift() as Response) : loads[0];
    });

  it('carga la empresa en el formulario; sin cambios avisa y no guarda; confirma y guarda solo el campo cambiado', async () => {
    const { calls } = server(apiOk(company));
    renderFrom('/admin/companies/:id/edit', '/admin/companies/4/edit', <CompanyEditPage />);
    expect(screen.getByLabelText('Cargando')).toBeInTheDocument();
    expect(await screen.findByLabelText('Nombre comercial')).toHaveValue('Panificadora');
    expect(screen.getByLabelText('Límite de empleados')).toHaveValue('50');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    await waitFor(() => expect(save).toHaveAttribute('title', 'No hay cambios por guardar'));
    expect(save).toBeDisabled();
    // Un envío forzado (Enter) sin cambios no pregunta: avisa "Sin cambios" y no envía nada.
    forceSubmit(save);
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Sin cambios' })).getByRole('button', { name: 'Entendido' }));

    await userEvent.clear(screen.getByLabelText('Límite de empleados'));
    await userEvent.type(screen.getByLabelText('Límite de empleados'), '80');
    await waitFor(() => expect(save).toBeEnabled());
    expect(save).not.toHaveAttribute('title');
    await userEvent.click(save);
    const dialog = await screen.findByRole('dialog', { name: '¿Guardar los cambios de Panificadora?' });
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('1 cambioLímite de empleadosAntes: 50 empleadosDespués: 80 empleados');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(sent(calls, 'PUT')).toHaveLength(0); // cancelar no envía nada y el formulario sigue igual
    expect(screen.getByLabelText('Límite de empleados')).toHaveValue('80');

    await userEvent.click(save);
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Guardar los cambios de Panificadora?' })).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Cambios guardados' })).toBeInTheDocument();
    const puts = sent(calls, 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe('/api/admin/companies/4');
    expect(JSON.parse(puts[0].init.body as string)).toEqual({ max_employees: 80 });
  });

  it('quitar el límite y cambiar el teléfono: la confirmación muestra "Sin límite" y el teléfono legible', async () => {
    const { calls } = server(apiOk(company));
    renderFrom('/admin/companies/:id/edit', '/admin/companies/4/edit', <CompanyEditPage />);
    await userEvent.clear(await screen.findByLabelText('Límite de empleados'));
    await userEvent.clear(screen.getByLabelText('Teléfono'));
    await userEvent.type(screen.getByLabelText('Teléfono'), '6629876543');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    const changes = within(await screen.findByRole('dialog', { name: '¿Guardar los cambios de Panificadora?' })).getByRole('region', { name: 'Cambios' });
    expect(within(changes).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'TeléfonoAntes: +52 662 123 4567Después: +52 662 987 6543',
      'Límite de empleadosAntes: 50 empleadosDespués: Sin límite',
    ]);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
    expect(JSON.parse(sent(calls, 'PUT')[0].init.body as string)).toEqual({ phone: '+526629876543', max_employees: null });
  });

  it('una empresa sin datos obligatorios pide completarlos antes de guardar; "Cancelar" regresa', async () => {
    const { calls } = server(apiOk(bare));
    renderFrom('/admin/companies/:id/edit', '/admin/companies/4/edit', <CompanyEditPage />);
    expect(await screen.findByLabelText('Razón social')).toHaveValue('');
    expect(screen.getByLabelText('Identificador fiscal')).toHaveValue('');
    expect(screen.getByLabelText('Límite de empleados')).toHaveValue('');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(save).toHaveAttribute('title', 'Completa correctamente todos los campos obligatorios');
    // Incompleto, un envío forzado ni pregunta ni llega a la API.
    forceSubmit(save);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent(calls, 'PUT')).toHaveLength(0);
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
      const billing = billingReply(call);
      if (billing) return billing;
      if (call.url.includes('/admins')) return call.init.method === 'PATCH' ? apiOk(detail) : admins();
      if (call.init.method === 'PATCH') return apiOk({ ...detail, active: JSON.parse(call.init.body as string).active as boolean });
      if (call.init.method === 'PUT') return apiOk({ ...detail, ...(JSON.parse(call.init.body as string) as Partial<CompanyDetail>) });
      return apiOk(detail);
    });
    renderFrom('/admin/companies/:id', '/admin/companies/4', <CompanyDetailPage />);
    return mock.calls;
  }

  it('desactivada y sin datos opcionales: "Sin capturar", sin límite; activarla también se confirma', async () => {
    const calls = renderDetail({ ...bare, active: false });
    expect(await screen.findByRole('heading', { name: 'Panificadora' })).toBeInTheDocument();
    expect(screen.getAllByText('Sin capturar')).toHaveLength(3); // razón social, identificador fiscal y teléfono
    expect(screen.getByText(/Sin identificador fiscal · desde/)).toBeInTheDocument();
    expect(screen.getByText('empleados · sin límite')).toBeInTheDocument();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByText('Sin el módulo: la pantalla no aparece en el menú de la empresa.')).toBeInTheDocument(); // validadores en 0
    expect(screen.getByText('Desactivada: su personal no puede iniciar sesión')).toBeInTheDocument();
    expect(await screen.findByText('Sin administradores')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    let dialog = await screen.findByRole('dialog', { name: '¿Activar Panificadora?' });
    expect(dialog).toHaveTextContent('podrá volver a iniciar sesión de inmediato');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: InactivaDespués: Activa');
    expect(within(dialog).getByRole('region', { name: 'Personal que recupera el acceso' })).toHaveTextContent('Administradores1Empleados3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(sent(calls, 'PATCH')).toHaveLength(0); // cancelar no envía nada
    expect(screen.getByRole('button', { name: 'Activar' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    dialog = await screen.findByRole('dialog', { name: '¿Activar Panificadora?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Activar empresa' }));
    expect(await screen.findByRole('dialog', { name: 'Empresa activada' })).toHaveTextContent('Su personal ya puede iniciar sesión.');
    expect(JSON.parse(sent(calls, 'PATCH')[0].init.body as string)).toEqual({ active: true });
    expect(screen.getByText('Operando')).toBeInTheDocument();
  });

  it('desactivar pide confirmación: cancelar no envía nada; confirmar la desactiva', async () => {
    const calls = renderDetail({ ...company, employee_count: 46, max_validators: 4, active_validators: 4 });
    const meter = await screen.findByRole('meter', { name: 'Uso del límite de empleados' });
    expect(meter).toHaveAttribute('aria-valuenow', '92');
    expect(meter).toHaveClass('is-high'); // cerca del límite
    expect(screen.getByText('de 50 empleados')).toBeInTheDocument();
    // Sus validadores frente a su límite (se cobran como empleados).
    expect(screen.getByText('4 de 4 activos')).toBeInTheDocument();
    expect(screen.getByText(/Cada validador activo se cobra como un empleado/)).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Uso del límite de validadores' })).toHaveAttribute('aria-valuenow', '100');

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Desactivar Panificadora?' });
    expect(dialog).toHaveTextContent('Se cerrará de inmediato la sesión de todo su personal');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: ActivaDespués: Inactiva');
    expect(within(dialog).getByRole('region', { name: 'Personal afectado' })).toHaveTextContent('Administradores1Empleados46');
    expect(dialog).toHaveTextContent('Sus datos se conservan');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(sent(calls, 'PATCH')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Desactivar empresa' }));
    expect(await screen.findByRole('dialog', { name: 'Empresa desactivada' })).toHaveTextContent('Su personal ya no puede iniciar sesión.');
    expect(sent(calls, 'PATCH')[0].url).toBe('/api/admin/companies/4/status');
    expect(screen.getByRole('button', { name: 'Activar' })).toBeInTheDocument();
  });

  it('Integraciones (API): darla y quitarla se confirman; cancelar deja el interruptor como estaba', async () => {
    const calls = renderDetail(company);
    const api = await screen.findByRole('switch', { name: 'Integraciones (API)' });
    expect(api).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Sin acceso: la pantalla no aparece en su menú y sus llaves no funcionan.')).toBeInTheDocument();

    await userEvent.click(api);
    let dialog = await screen.findByRole('dialog', { name: '¿Dar Integraciones a Panificadora?' });
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Integraciones (API)Antes: Sin accesoDespués: Con acceso');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(sent(calls, 'PUT')).toHaveLength(0);
    expect(api).toHaveAttribute('aria-checked', 'false'); // sin confirmar, nada cambia

    await userEvent.click(api);
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Dar Integraciones a Panificadora?' })).getByRole('button', { name: 'Dar acceso' }));
    expect(await screen.findByRole('dialog', { name: 'Integraciones activadas' })).toHaveTextContent('sus llaves funcionan');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    const [enable] = sent(calls, 'PUT');
    expect(enable.url).toBe('/api/admin/companies/4');
    expect(JSON.parse(enable.init.body as string)).toEqual({ api_enabled: true });
    expect(api).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Desactivar' })).not.toHaveAttribute('aria-busy', 'true'); // solo el interruptor estuvo ocupado

    await userEvent.click(api);
    dialog = await screen.findByRole('alertdialog', { name: '¿Quitar Integraciones a Panificadora?' });
    expect(dialog).toHaveTextContent('Sus sistemas conectados dejarán de recibir información de inmediato');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Antes: Con accesoDespués: Sin acceso');
    expect(dialog).toHaveTextContent('Las llaves se conservan');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(sent(calls, 'PUT')).toHaveLength(1);
    expect(api).toHaveAttribute('aria-checked', 'true'); // sin confirmar, nada cambia

    await userEvent.click(api);
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Quitar acceso' }));
    expect(await screen.findByRole('dialog', { name: 'Integraciones desactivadas' })).toHaveTextContent('Sus llaves ya no funcionan');
    expect(JSON.parse(sent(calls, 'PUT')[1].init.body as string)).toEqual({ api_enabled: false });
    expect(api).toHaveAttribute('aria-checked', 'false');
  });

  it('"Ver empleados" y "Política de verificación" llevan a sus pantallas de la empresa', async () => {
    renderDetail(company);
    expect(await screen.findByRole('link', { name: 'Ver empleados' })).toHaveAttribute('href', '/admin/companies/4/employees');
    expect(screen.getByRole('link', { name: 'Política de verificación' })).toHaveAttribute('href', '/admin/companies/4/policy');
  });

  it('mientras se vuelve a pedir la página de administradores, la lista se atenúa', async () => {
    let release: (response: Response) => void = () => undefined;
    let requests = 0;
    renderDetail(company, () => (requests++ === 0 ? adminsPage([admin]) : new Promise<Response>((resolve) => (release = resolve))));
    await userEvent.click(await screen.findByRole('button', { name: 'Activar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Activar a admin@pan.com?' })).getByRole('button', { name: 'Activar administrador' }));
    await waitFor(() => expect(screen.getByText('admin@pan.com').closest('ul')).toHaveClass('is-loading'));
    release(adminsPage([{ ...admin, active: true }]));
    await waitFor(() => expect(screen.getByText('admin@pan.com').closest('ul')).not.toHaveClass('is-loading'));
    expect(within(screen.getByText('admin@pan.com').closest('li') as HTMLElement).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
  });

  it('si la empresa no carga, ofrece reintentar con el regreso al listado', async () => {
    let attempts = 0;
    mockFetch((call) => {
      if (call.url.includes('/admins')) return adminsPage([]);
      if (call.url.includes('/admin/billing/')) return billingReply(call) as Response;
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

describe('consola de empresas en inglés (en-US)', () => {
  it('agregar un administrador: formulario y confirmación en inglés; la confirmación abierta cambia de idioma en caliente', async () => {
    await setLocale('en-US');
    const { calls } = mockFetch((call) => (call.url.includes('/validation') ? liveCheck() : apiOk(company)));
    renderFrom('/admin/companies/:id/admins/new', '/admin/companies/4/admins/new', <CompanyAdminFormPage />);
    const add = await screen.findByRole('button', { name: 'Add' });
    expect(screen.getByRole('heading', { name: 'Add admin' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Admin email'), 'rh@pan.com');
    await userEvent.type(screen.getByLabelText('Initial password'), 'Recursos123');
    await userEvent.type(screen.getByLabelText(/Confirm password/), 'Recursos123');
    await waitFor(() => expect(add).toBeEnabled());
    await userEvent.click(add);
    const dialog = await screen.findByRole('dialog', { name: 'Add rh@pan.com as an admin?' });
    expect(dialog).toHaveTextContent('Share the initial password through a secure channel.');
    expect(within(dialog).getByRole('region', { name: 'To be registered' })).toHaveTextContent('Emailrh@pan.comCompanyPanificadora');
    // Cambiar el idioma con la confirmación abierta la vuelve a armar en español.
    await act(() => setLocale('es-MX'));
    const spanish = await screen.findByRole('dialog', { name: '¿Agregar a rh@pan.com como administrador?' });
    expect(within(spanish).getByRole('region', { name: 'Se registrará' })).toHaveTextContent('Correorh@pan.comEmpresaPanificadora');
    await act(() => setLocale('en-US'));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Add rh@pan.com as an admin?' })).getByRole('button', { name: 'Add admin' }));
    expect(await screen.findByText('Admin added')).toBeInTheDocument();
    expect(screen.getByText('rh@pan.com can now sign in.')).toBeInTheDocument();
    expect(sent(calls, 'POST').at(-1)?.url).toBe('/api/admin/companies/4/admins');
  });

  it('restablecer la contraseña en inglés: aviso de seguridad y popup de éxito', async () => {
    await setLocale('en-US');
    const admin9 = { ...admin, active: true };
    mockFetch((call) => apiOk(call.url.endsWith('/admins/9') ? admin9 : company));
    renderFrom('/admin/companies/:id/admins/:adminId/password', '/admin/companies/4/admins/9/password', <CompanyAdminFormPage />);
    expect(await screen.findByRole('heading', { name: 'Reset password' })).toBeInTheDocument();
    expect(screen.getByText('Assign a new password and share it through a secure channel. Their open sessions will end.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('New password'), 'Nueva12345');
    await userEvent.type(screen.getByLabelText(/Confirm password/), 'Nueva12345');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Reset the password for admin@pan.com?' });
    expect(dialog).toHaveTextContent('Account security');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Password reset')).toBeInTheDocument();
  });

  it('detalle de la empresa en inglés: datos, uso del plan y la confirmación de desactivar', async () => {
    await setLocale('en-US');
    mockFetch((call) => (call.url.includes('/admins') ? adminsPage([{ ...admin, active: true }]) : (billingReply(call) ?? apiOk(company))));
    renderFrom('/admin/companies/:id', '/admin/companies/4', <CompanyDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Panificadora' })).toBeInTheDocument();
    // El tipo y el país, como los manda el backend (los catálogos de prueba vienen en español).
    expect(screen.getByText(/RFC · PNO120315AB1 · México · since/)).toBeInTheDocument();
    expect(screen.getByText('of 50 employees')).toBeInTheDocument();
    expect(screen.getByText('Operating')).toBeInTheDocument();
    expect(await screen.findByText("Hasn't signed in yet")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0]);
    const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Panificadora?' });
    expect(within(dialog).getByRole('region', { name: 'Changes' })).toHaveTextContent(/Status.*Active.*Inactive/);
    expect(dialog).toHaveTextContent('Affected staff');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  });
});
