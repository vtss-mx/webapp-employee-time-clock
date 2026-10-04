import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { sampleValidator } from '../test/fixtures';
import { apiFail, apiOk, liveCheck, mockFetch } from '../test/http';
import { renderWithProviders } from '../test/render';
import type { CompanyDetail } from '../types';
import { CompanyAdminFormPage } from './admin/CompanyAdminFormPage';
import { RejectEnrollmentPage } from './company/RejectEnrollmentPage';
import { ReverifyAllPage, ReverifyIdentityPage } from './company/ReverifyIdentityPage';
import { ValidatorPasswordPage } from './company/ValidatorPasswordPage';

/** Todos los formularios son pantallas: al guardar vuelven a la pantalla de origen. */
function renderAt(path: string, route: string, page: ReactElement, back: string) {
  return renderWithProviders(
    <Routes>
      <Route path={path} element={page} />
      <Route path={back} element={<p>Pantalla anterior</p>} />
    </Routes>,
    { route },
  );
}

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
const employee = { id: 7, employee_number: 'EMP-7', first_name: 'Ana', last_name: 'Ruiz', full_name: 'Ana Ruiz', face_status: 'APPROVED' };

describe('administradores de empresa (pantallas)', () => {
  it('agregar: correo disponible y contraseña segura escrita dos veces', async () => {
    const { calls } = mockFetch((call) => (call.url.includes('/validation') ? liveCheck() : apiOk(company)));
    renderAt('/admin/companies/:id/admins/new', '/admin/companies/4/admins/new', <CompanyAdminFormPage />, '/admin/companies/:id');
    const add = await screen.findByRole('button', { name: 'Agregar' });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Correo del administrador'), 'rh@pan.com');
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'corta');
    await userEvent.tab();
    expect(screen.getByText(/Mínimo 8 caracteres|al menos 8/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Contraseña inicial'));
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'Recursos123');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Recursos123');
    await waitFor(() => expect(add).toBeEnabled());
    // Se confirma con qué correo entrará (nunca la contraseña); cancelar no envía nada.
    await userEvent.click(add);
    const dialog = await screen.findByRole('dialog', { name: '¿Agregar a rh@pan.com como administrador?' });
    expect(within(within(dialog).getByRole('region', { name: 'Se registrará' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Correorh@pan.com', 'EmpresaPanificadora']);
    expect(dialog).not.toHaveTextContent('Recursos123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    expect(screen.getByLabelText('Correo del administrador')).toHaveValue('rh@pan.com'); // el formulario sigue igual

    await userEvent.click(add);
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Agregar a rh@pan.com como administrador?' })).getByRole('button', { name: 'Agregar administrador' }));
    expect(await screen.findByText('Pantalla anterior')).toBeInTheDocument();
    expect(await screen.findByText('Administrador agregado')).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === 'POST');
    expect(post?.url).toBe('/api/admin/companies/4/admins');
  });

  it('agregar: un correo ya registrado se marca en el campo', async () => {
    mockFetch((call) => {
      if (call.url.includes('/validation')) return liveCheck();
      return call.init.method === 'POST' ? apiFail(409, 'EMAIL_TAKEN', 'El correo ya está registrado') : apiOk(company);
    });
    renderAt('/admin/companies/:id/admins/new', '/admin/companies/4/admins/new', <CompanyAdminFormPage />, '/admin/companies/:id');
    await userEvent.type(await screen.findByLabelText('Correo del administrador'), 'RH@pan.com');
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'Recursos123');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Recursos123');
    const add = screen.getByRole('button', { name: 'Agregar' });
    await waitFor(() => expect(add).toBeEnabled());
    await userEvent.click(add);
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Agregar a rh@pan.com como administrador?' })).getByRole('button', { name: 'Agregar administrador' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo agregar el administrador' })).toBeInTheDocument();
    expect(screen.getAllByText('El correo ya está registrado').length).toBeGreaterThan(0);
  });

  it('restablecer: solo pide la contraseña nueva del administrador elegido y avisa que cierra sus sesiones', async () => {
    const admin = { id: 9, email: 'admin@pan.com', active: true, last_login_at: null, created_at: '2026-01-01T00:00:00Z' };
    const { calls } = mockFetch((call) => apiOk(call.url.endsWith('/admins/9') ? admin : company));
    renderAt('/admin/companies/:id/admins/:adminId/password', '/admin/companies/4/admins/9/password', <CompanyAdminFormPage />, '/admin/companies/:id');
    expect(await screen.findByText('admin@pan.com · Panificadora')).toBeInTheDocument();
    expect(screen.queryByLabelText('Correo del administrador')).toBeNull();
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'Nueva12345');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Nueva12345');
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Restablecer la contraseña de admin@pan.com?' });
    expect(dialog).toHaveTextContent('Se cerrarán todas sus sesiones abiertas.');
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Administradoradmin@pan.comEmpresaPanificadora');
    expect(dialog).not.toHaveTextContent('Nueva12345');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false); // cancelar no envía nada

    await userEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Restablecer la contraseña de admin@pan.com?' })).getByRole('button', { name: 'Restablecer contraseña' }));
    expect(await screen.findByText('Contraseña restablecida')).toBeInTheDocument();
    const put = calls.find((c) => c.init.method === 'PUT');
    expect(put?.url).toBe('/api/admin/companies/4/admins/9/password');
    expect(JSON.parse(put?.init.body as string)).toEqual({ admin_password: 'Nueva12345' });
  });
});

describe('solicitar nueva verificación (pantalla)', () => {
  it('envía el motivo elegido o escrito; sin motivo, ninguno', async () => {
    const { calls } = mockFetch(apiOk(employee));
    renderAt('/company/employees/:id/reverify', '/company/employees/7/reverify', <ReverifyIdentityPage />, '/company/employees/:id');
    expect(await screen.findByText(/Ana deberá registrar su rostro/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cambio importante de apariencia' }));
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar verificación' }));
    // La confirmación dice el motivo que verá el empleado.
    const confirm = await screen.findByRole('alertdialog', { name: '¿Solicitar a Ana Ruiz verificar su identidad?' });
    expect(confirm).toHaveTextContent('Motivo que verá');
    expect(confirm).toHaveTextContent('Cambio importante de apariencia');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Solicitar verificación' }));
    expect(await screen.findByText('Verificación solicitada')).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === 'POST');
    expect(post?.url).toBe('/api/employees/7/face/reset');
    expect(JSON.parse(post?.init.body as string)).toEqual({ reason: 'Cambio importante de apariencia' });
    expect(screen.getByText('Pantalla anterior')).toBeInTheDocument();
  });
});

describe('solicitar nueva verificación a todos (pantalla)', () => {
  it('pide confirmar antes de afectar a toda la empresa; cancelar no envía nada', async () => {
    const { calls } = mockFetch(apiOk({ employees: 12 }));
    renderAt('/company/employees/reverify-all', '/company/employees/reverify-all', <ReverifyAllPage />, '/company/employees');
    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar a todos' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Solicitar nueva verificación a todos?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Cambio importante de apariencia' }));
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar a todos' }));
    const again = await screen.findByRole('alertdialog', { name: '¿Solicitar nueva verificación a todos?' });
    expect(again).toHaveTextContent('Esta acción no se puede deshacer.');
    expect(again).toHaveTextContent('Cambio importante de apariencia');
    await userEvent.click(within(again).getByRole('button', { name: 'Sí, solicitar a todos' }));
    expect(await screen.findByText('12 empleados deberán registrar su rostro de nuevo en su próximo acceso.')).toBeInTheDocument();
    const post = calls.find((c) => c.init.method === 'POST');
    expect(post?.url).toBe('/api/employees/face/reset');
    expect(JSON.parse(post?.init.body as string)).toEqual({ reason: 'Cambio importante de apariencia' });
    expect(screen.getByText('Pantalla anterior')).toBeInTheDocument();
  });

  it('sin motivo no envía cuerpo y con un solo empleado lo dice en singular', async () => {
    const { calls } = mockFetch(apiOk({ employees: 1 }));
    renderAt('/company/employees/reverify-all', '/company/employees/reverify-all', <ReverifyAllPage />, '/company/employees');
    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar a todos' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sí, solicitar a todos' }));
    expect(await screen.findByText('1 empleado deberá registrar su rostro de nuevo en su próximo acceso.')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'POST')?.init.body).toBeUndefined();
  });
});

describe('rechazar un registro facial (pantalla)', () => {
  it('exige el motivo y lo envía', async () => {
    const detail = { id: 5, status: 'PENDING', employee_id: 7, full_name: 'Ana Ruiz', employee_number: 'EMP-7' };
    const { calls } = mockFetch((call) => apiOk(call.init.method === 'POST' ? { ...detail, status: 'REJECTED' } : detail));
    renderAt('/company/validations/:id/reject', '/company/validations/5/reject', <RejectEnrollmentPage />, '/company/validations');
    const reject = await screen.findByRole('button', { name: 'Rechazar' });
    await userEvent.click(reject);
    expect(screen.getByText('Escribe o elige el motivo del rechazo')).toBeInTheDocument();
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    await userEvent.type(screen.getByLabelText(/Motivo/), 'La foto está borrosa');
    await userEvent.click(reject);
    // Antes de enviar se confirma: a quién y con qué motivo; cancelar no envía nada.
    const confirm = await screen.findByRole('alertdialog', { name: '¿Rechazar el registro de Ana Ruiz?' });
    expect(confirm).toHaveTextContent('EmpleadoAna Ruiz · EMP-7');
    expect(confirm).toHaveTextContent('Motivo que veráLa foto está borrosa');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    expect(screen.getByLabelText(/Motivo/)).toHaveValue('La foto está borrosa');
    await userEvent.click(reject);
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Rechazar el registro de Ana Ruiz?' })).getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByText('Usuario rechazado')).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.init.method === 'POST')?.init.body as string)).toEqual({ reason: 'La foto está borrosa' });
  });
});

describe('contraseña del validador (pantalla)', () => {
  it('contraseña nueva escrita dos veces; confirma (cancelar no envía nada) y cierra sus sesiones', async () => {
    const { calls } = mockFetch(apiOk(sampleValidator));
    renderAt('/company/validators/:id/password', '/company/validators/3/password', <ValidatorPasswordPage />, '/company/validators');
    const reset = await screen.findByRole('button', { name: 'Restablecer' });
    expect(reset).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Contraseña nueva/), 'Nueva1234');
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'Nueva12');
    await userEvent.tab();
    expect(reset).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), '34');
    await userEvent.click(reset);
    let confirm = await screen.findByRole('alertdialog', { name: '¿Restablecer la contraseña de Recepción planta 1?' });
    expect(confirm).toHaveTextContent('Sus sesiones abiertas se cerrarán de inmediato.');
    expect(within(confirm).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Cuentarecepcion@empresa.com');
    expect(confirm).not.toHaveTextContent('Nueva1234'); // la contraseña nunca se muestra
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
    expect(screen.getByLabelText(/Contraseña nueva/)).toHaveValue('Nueva1234');

    await userEvent.click(reset);
    confirm = await screen.findByRole('alertdialog', { name: '¿Restablecer la contraseña de Recepción planta 1?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Restablecer contraseña' }));
    const popup = await screen.findByRole('dialog', { name: 'Contraseña restablecida' });
    expect(within(popup).getByText(/sus sesiones abiertas se cerraron/)).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'PUT')?.url).toBe('/api/validators/3/password');
  });
});
