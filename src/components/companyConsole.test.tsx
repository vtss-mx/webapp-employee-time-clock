import { Building2 } from 'lucide-react';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { companyServerErrors, emptyCompanyForm, useCompanyForm } from '../hooks/useCompanyForm';
import { useSearchList, type ListQuery } from '../hooks/useSearchList';
import { adminService } from '../services/adminService';
import { checkAvailability } from '../services/availabilityService';
import { ApiError } from '../services/apiClient';
import { billingReply } from '../test/billing';
import { apiFail, apiOk, liveCheck, mockFetch } from '../test/http';
import { WithCatalogs, renderWithProviders } from '../test/render';
import type { CompanyAdmin, CompanyDetail, CompanyFormValues, Page } from '../types';
import { validateCompanyForm } from '../utils/formRules';
import { validateCompanyRfc, validateMaxEmployees } from '../utils/validation';
import { CompanyDetailPage } from '../pages/admin/CompanyDetailPage';
import { Route, Routes } from 'react-router-dom';
import { CompanyAdminFields, CompanyDataFields } from './CompanyForm';
import { KpiCard } from './ui/KpiCard';
import { ListToolbar } from './ui/ListControls';
import { ListResults } from './ui/ListResults';

const wrapper = ({ children }: { children: ReactNode }) => (
  <FeedbackProvider>
    <WithCatalogs>{children}</WithCatalogs>
  </FeedbackProvider>
);
const RFC = { tax_country: 'MX', tax_id_type: 'MX_RFC', tax_id: 'PNO120315AB1' };
const admin: CompanyAdmin = { id: 9, email: 'admin@pan.com', active: true, last_login_at: null, created_at: '2026-01-01T00:00:00Z' };
const company: CompanyDetail = {
  id: 4,
  name: 'Panificadora',
  legal_name: 'Panificadora del Norte SA de CV',
  ...RFC,
  phone: '+526621234567',
  active: true,
  max_employees: 50,
  api_enabled: false,
  require_employee_documents: false,
  max_validators: 0,
  active_validators: 0,
  employee_count: 3,
  admin_count: 1,
  billing_status: 'ACTIVE',
  suspension_reason: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
const validCompany: CompanyFormValues = {
  name: 'Panificadora',
  legal_name: 'Panificadora del Norte',
  ...RFC,
  phone: '+526621234567',
  max_employees: '',
  max_validators: '0',
  admin_email: 'admin@pan.com',
  admin_password: 'Empresa123456',
  admin_password_confirm: 'Empresa123456',
};
const available = () => liveCheck();

describe('adminService', () => {
  it.each([
    ['stats', () => adminService.stats(), { companies: 1, active_companies: 1, employees: 0, company_admins: 1 }, 'GET', '/api/admin/stats'],
    ['list', () => adminService.list({ search: 'pan', page: 2 }), { items: [company], total: 1 }, 'GET', '/api/admin/companies?search=pan&page=2'],
    ['get', () => adminService.get(4), company, 'GET', '/api/admin/companies/4'],
    ['setStatus', () => adminService.setStatus(4, false), company, 'PATCH', '/api/admin/companies/4/status'],
    ['setAdminStatus', () => adminService.setAdminStatus(4, 9, true), company, 'PATCH', '/api/admin/companies/4/admins/9/status'],
    ['admins', () => adminService.admins(4, { page: 2, size: 10 }), { items: [admin], total: 11, page: 2, size: 10 }, 'GET', '/api/admin/companies/4/admins?page=2&size=10'],
    ['admin', () => adminService.admin(4, 9), admin, 'GET', '/api/admin/companies/4/admins/9'],
    [
      'validación en vivo (respaldo HTTP del canal), con «país:tipo»',
      () => checkAvailability('company_tax_id', 'PNO120315AB1', 4, 'MX:MX_RFC'),
      { field: 'company_tax_id', valid: true, available: true, code: 'AVAILABLE', message: 'ok' },
      'GET',
      '/api/validation?field=company_tax_id&value=PNO120315AB1&exclude_id=4&related=MX%3AMX_RFC',
    ],
  ])('%s', async (_name, call, data, method, url) => {
    const { calls } = mockFetch(apiOk(data));
    await call();
    expect(calls[0].init.method ?? 'GET').toBe(method);
    expect(calls[0].url).toBe(url);
  });

  it('envía los datos limpios: sin espacios, límite numérico o null y el primer administrador', async () => {
    const { calls } = mockFetch(apiOk(company));
    await adminService.create({ ...validCompany, name: '  Panificadora ', tax_id: ' PNO120315AB1 ', max_employees: '25', admin_email: ' admin@pan.com ' });
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ name: 'Panificadora', ...RFC, max_employees: 25, admin_email: 'admin@pan.com', admin_password: 'Empresa123456' });
    // El identificador fiscal es opcional: el número vacío viaja como null (sin capturar; al editar, lo borra).
    await adminService.update(4, { max_employees: '', phone: '+526621234567', tax_country: 'US', tax_id_type: 'US_EIN', tax_id: '  ' });
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ max_employees: null, phone: '+526621234567', tax_country: 'US', tax_id_type: 'US_EIN', tax_id: null });
    await adminService.addAdmin(4, ' rh@pan.com ', 'Recursos12345');
    expect(calls[2].url).toBe('/api/admin/companies/4/admins');
    expect(JSON.parse(calls[2].init.body as string)).toEqual({ admin_email: 'rh@pan.com', admin_password: 'Recursos12345' });
  });
});

describe('validación de empresas', () => {
  it('RFC de persona moral (12) o física (13), límite opcional y administrador solo en el alta', () => {
    expect(validateCompanyRfc('pno-120315-ab1')).toBeUndefined();
    expect(validateCompanyRfc('')).toBeUndefined(); // opcional: vacío = sin capturar
    expect(validateCompanyRfc('ABC')).toMatch(/12 caracteres/);
    expect(validateCompanyRfc('PNO121335AB1')).toMatch(/fecha/);
    expect(validateCompanyRfc('XAXX010101000')).toMatch(/genérico/);
    expect(validateCompanyRfc('PEGJ900515AB1')).toBeUndefined();
    expect(validateMaxEmployees('')).toBeUndefined();
    expect(validateMaxEmployees('0')).toMatch(/mayor a 0/);
    expect(validateCompanyForm(validCompany)).toEqual({});
    expect(Object.keys(validateCompanyForm(emptyCompanyForm, { withAdmin: false }))).not.toContain('admin_email');
    expect(validateCompanyForm({ ...validCompany, name: 'x'.repeat(201) }).name).toBe('Máximo 200 caracteres');
  });
});

describe('useCompanyForm', () => {
  it('el botón se habilita solo con todo correcto y el identificador fiscal y el correo verificados como disponibles', async () => {
    mockFetch(available());
    const { result } = renderHook(() => useCompanyForm({ withAdmin: true }), { wrapper });
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.touch('name'));
    expect(result.current.errors.name).toBe('El nombre comercial es obligatorio');
    act(() => result.current.setValues(validCompany));
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
  });

  it('el identificador fiscal es opcional: vacío no marca error, no se consulta en vivo y no impide guardar', async () => {
    const { calls } = mockFetch(available());
    const { result } = renderHook(() => useCompanyForm({ withAdmin: true }), { wrapper });
    act(() => result.current.setValues({ ...validCompany, tax_id: '' }));
    act(() => result.current.touch('tax_id'));
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    expect(result.current.errors.tax_id).toBeUndefined();
    expect(result.current.live.tax_id.status).toBe('idle');
    expect(calls.some((c) => c.url.includes('field=company_tax_id'))).toBe(false);
  });

  it('uno ya registrado bloquea el envío y se muestra en el campo; viaja con su país y su tipo', async () => {
    const { calls } = mockFetch((call) =>
      call.url.includes('field=company_tax_id') ? liveCheck('TAKEN', 'Ya existe una empresa con ese identificador fiscal', 'company_tax_id') : available(),
    );
    const { result } = renderHook(() => useCompanyForm({ withAdmin: true }), { wrapper });
    act(() => result.current.setValues(validCompany));
    await waitFor(() => expect(result.current.errors.tax_id).toBe('Ya existe una empresa con ese identificador fiscal'));
    expect(result.current.canSubmit).toBe(false);
    expect(calls.find((c) => c.url.includes('field=company_tax_id'))?.url).toContain('related=MX%3AMX_RFC');
  });

  it('un formato que no cumple se marca en el cliente y no se consulta; al editar, el mismo no se vuelve a consultar', async () => {
    const { calls } = mockFetch(available());
    const original = { tax_country: 'US', tax_id_type: 'US_EIN', tax_id: '123456789' };
    const { result } = renderHook(() => useCompanyForm({ withAdmin: false, excludeId: 4, original }), { wrapper });
    act(() => result.current.loadValues({ ...validCompany, ...original, tax_id: '1234' }));
    expect(result.current.errors.tax_id).toBe('El número de EIN debe tener 9 caracteres');
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.setValues({ ...result.current.values, tax_id: '123456789' }));
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
    expect(result.current.live.tax_id.status).toBe('idle'); // el que ya tenía: no se consulta
    act(() => result.current.setValues({ ...result.current.values, tax_country: 'FR', tax_id_type: 'FR_SIREN' }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('related=FR%3AFR_SIREN'))).toBe(true)); // otro tipo: sí
  });

  it('el teléfono de la empresa también se valida en vivo; la empresa tiene un solo correo', async () => {
    const { calls } = mockFetch((call) =>
      call.url.includes('field=company_phone') ? liveCheck('INVALID_FORMAT', 'Número inválido para México', 'company_phone') : available(),
    );
    const { result } = renderHook(() => useCompanyForm({ withAdmin: true }), { wrapper });
    act(() => result.current.setValues(validCompany));
    await waitFor(() => expect(result.current.errors.phone).toBe('Número inválido para México'));
    expect(result.current.canSubmit).toBe(false);
    // Un solo correo: el del administrador (no hay correo de contacto aparte).
    expect(calls.filter((c) => c.url.includes('@')).every((c) => c.url.includes('field=company_admin_email'))).toBe(true);
  });

  it('alta: la contraseña del administrador se repite y deben coincidir', () => {
    expect(validateCompanyForm({ ...validCompany, admin_password_confirm: 'Otra12345678' }).admin_password_confirm).toBe('Las contraseñas no coinciden');
    expect(validateCompanyForm({ ...validCompany, admin_password_confirm: '' }).admin_password_confirm).toBe('Repite la contraseña');
  });

  it('errores del servidor por campo; cambiar el campo los descarta; la edición marca lo cargado', async () => {
    const { result } = renderHook(() => useCompanyForm({ withAdmin: false, excludeId: 4, original: RFC }), { wrapper });
    act(() => result.current.loadValues({ ...validCompany, legal_name: '' }));
    expect(result.current.errors.legal_name).toBe('La razón social es obligatoria'); // concordancia de género corregida
    let saved: Promise<void> = Promise.resolve();
    act(() => {
      saved = result.current.save(() => Promise.reject(new ApiError({ statusCode: 409, code: 'COMPANY_TAX_ID_TAKEN', message: 'Identificador en uso' })), 'No se pudo guardar', {
        kind: 'edit',
        title: '¿Guardar los cambios?',
        changes: [{ label: 'Identificador fiscal', before: 'PNO120315AB1', after: 'ACM010101AB1' }],
      });
    });
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Guardar los cambios?' })).getByRole('button', { name: 'Guardar cambios' }));
    await act(() => saved);
    expect(result.current.errors.tax_id).toBe('Identificador en uso');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo guardar' })).toBeInTheDocument();
    act(() => result.current.setValues({ ...result.current.values, tax_id: 'ACM010101AB2' }));
    expect(result.current.errors.tax_id).toBeUndefined();
    expect(companyServerErrors(new Error('x'))).toEqual({});
    expect(companyServerErrors(new ApiError({ statusCode: 409, code: 'EMAIL_TAKEN', message: 'en uso' }))).toEqual({ admin_email: 'en uso' });
  });
});

describe('CompanyForm', () => {
  function Harness() {
    const [values, setValues] = useState<CompanyFormValues>(emptyCompanyForm);
    const idle = { status: 'idle' as const };
    const props = { values, errors: {}, onChange: setValues, onTouch: vi.fn(), live: { tax_id: { status: 'taken' as const, message: 'Identificador en uso' }, admin_email: idle } };
    return (
      <>
        <CompanyDataFields {...props} />
        <CompanyAdminFields {...props} />
        <output>{JSON.stringify(values)}</output>
      </>
    );
  }

  it('normaliza el identificador fiscal, el teléfono y el límite mientras se escribe; el límite es opcional', async () => {
    render(<Harness />, { wrapper: WithCatalogs });
    await userEvent.type(screen.getByLabelText('Identificador fiscal'), 'pno-120315-ab1');
    await userEvent.type(screen.getByLabelText('Teléfono'), '(662) 123-4567');
    await userEvent.type(screen.getByLabelText('Límite de empleados'), '1a5');
    await userEvent.type(screen.getByLabelText('Correo del administrador'), 'a@b.com');
    const values = JSON.parse(document.querySelector('output')?.textContent ?? '{}') as CompanyFormValues;
    expect(values).toMatchObject({ ...RFC, phone: '+526621234567', max_employees: '15', admin_email: 'a@b.com' });
    expect(screen.getByLabelText('Teléfono')).toHaveValue('662 123 4567');
    expect(screen.getByText('Identificador en uso')).toBeInTheDocument(); // validación en vivo
    expect(screen.getByText('Límite de empleados').closest('label')).not.toHaveClass('is-required');
    expect(screen.getByText('Razón social').closest('label')).toHaveClass('is-required');
  });
});

describe('useSearchList + ListControls', () => {
  type Row = { id: number; name: string };
  type RowPage = Page<Row>;
  function Listado({ fetchPage, onOpen = vi.fn() }: { fetchPage: (query: ListQuery, signal: AbortSignal) => Promise<RowPage>; onOpen?: (row: Row) => void }) {
    const list = useSearchList(fetchPage, { pageSize: 2, errorTitle: 'No se pudo cargar' });
    return (
      <>
        <ListToolbar search={list.search} onSearch={list.setSearch} placeholder="Buscar" label="Buscar empresas" filter={list.filter} onFilter={list.setFilter} labels={{ active: 'Activas', inactive: 'Inactivas' }} />
        <ListResults
          list={list}
          columns={['Empresa']}
          onOpen={onOpen}
          empty={{ icon: null, title: 'No se encontraron empresas', description: 'Registra la primera empresa para empezar.', action: !list.filtered && <button>Registrar la primera</button> }}
          renderCells={(row) => <td>{row.name}</td>}
        />
        <span data-testid="state">{`${list.loading ? 'cargando' : 'listo'}|${String(list.filtered)}|${list.data?.total ?? '-'}`}</span>
      </>
    );
  }

  it('busca con pausa, filtra, pagina y vuelve a la página 1 al cambiar el filtro', async () => {
    const fetchPage = vi.fn((query: ListQuery) => Promise.resolve({ items: [{ id: query.page, name: `Empresa ${query.page}` }], total: 5, page: query.page, size: query.size }));
    const onOpen = vi.fn();
    render(
      <FeedbackProvider>
        <Listado fetchPage={fetchPage} onOpen={onOpen} />
      </FeedbackProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('listo|false|5'));
    expect(screen.getByRole('columnheader', { name: 'Empresa' })).toBeInTheDocument();
    await userEvent.click(screen.getByText('Empresa 1'));
    screen.getByText('Empresa 1').closest('tr')?.focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Mostrando', { exact: false })).toHaveTextContent('Mostrando 1–2 de 5 resultados');
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page'));
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: /^Inactiv/ }));
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ active: false, page: 1 }), expect.any(AbortSignal)));
    await userEvent.type(screen.getByLabelText('Buscar empresas'), ' pan ');
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'pan' }), expect.any(AbortSignal)));
    expect(screen.getByTestId('state')).toHaveTextContent('true');
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
  });

  it('un error se muestra en popup con "Reintentar"', async () => {
    const fetchPage = vi.fn().mockRejectedValueOnce(new Error('caído')).mockResolvedValue({ items: [], total: 0, page: 1, size: 2 });
    render(
      <FeedbackProvider>
        <Listado fetchPage={fetchPage} />
      </FeedbackProvider>,
    );
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar' });
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No se encontraron empresas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar la primera' })).toBeInTheDocument(); // sin filtros
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull(); // sin resultados no hay paginador
  });

  it('KpiCard: esqueleto mientras carga y luego el valor', () => {
    const { rerender, container } = render(<KpiCard label="Empresas" icon={Building2} value={undefined} />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    rerender(<KpiCard label="Empresas" icon={Building2} value={0} tile="icon-tile--success" />);
    expect(screen.getByText('Empresas')).toBeInTheDocument();
    expect(container.querySelector('.icon-tile--success')).not.toBeNull();
  });
});

describe('CompanyDetailPage: eliminar empresa', () => {
  const renderDetail = (detail: CompanyDetail, admins: CompanyAdmin[] = [admin], remove: () => Response = () => apiOk(null)) => {
    const mock = mockFetch((call) => {
      const billing = billingReply(call);
      if (billing) return billing;
      if (call.init.method === 'DELETE') return remove();
      if (call.url.includes('/admins?')) return apiOk({ items: admins, total: admins.length, page: 1, size: 10 });
      return apiOk(detail);
    });
    renderWithProviders(
      <Routes>
        <Route path="/admin/companies/:id" element={<CompanyDetailPage />} />
        <Route path="/admin/companies" element={<p>Listado de empresas</p>} />
      </Routes>,
      { route: `/admin/companies/${detail.id}` },
    );
    return mock.calls;
  };

  it('con empleados no se puede eliminar (se desactiva)', async () => {
    renderDetail(company);
    const remove = await screen.findByRole('button', { name: 'Eliminar' });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute('title', expect.stringMatching(/desactívala/));
  });

  it('sin empleados se elimina escribiendo su nombre para confirmar; cancelar o un rechazo del servidor la conservan', async () => {
    let attempts = 0;
    const calls = renderDetail({ ...company, employee_count: 0 }, [admin], () => (attempts++ === 0 ? apiFail(409, 'COMPANY_IN_USE', 'La empresa tiene registros') : apiOk(null)));
    const remove = await screen.findByRole('button', { name: 'Eliminar' });
    /** Pide eliminar y escribe su nombre para habilitar el botón. */
    const askToRemove = async () => {
      await userEvent.click(remove);
      const dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar Panificadora?' });
      const confirm = within(dialog).getByRole('button', { name: 'Eliminar empresa' });
      expect(confirm).toBeDisabled();
      await userEvent.type(within(dialog).getByLabelText(/Escribe «Panificadora»/), 'Panificadora');
      return { dialog, confirm };
    };
    const first = await askToRemove();
    expect(within(first.dialog).getByRole('region', { name: 'Se eliminará' })).toHaveTextContent('Razón socialPanificadora del Norte SA de CVIdentificador fiscalRFC · PNO120315AB1 · MéxicoAdministradores1');
    expect(first.dialog).toHaveTextContent('Pasará a «Eliminadas»: podrás restaurarla durante 1 año. Sus datos faciales y fotos se borran para siempre.');
    await userEvent.click(within(first.dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false); // cancelar no envía nada

    await userEvent.click((await askToRemove()).confirm);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar la empresa' })).toHaveTextContent('La empresa tiene registros');
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(remove).toBeEnabled(); // la pantalla sigue disponible

    await userEvent.click((await askToRemove()).confirm);
    expect(await screen.findByText('Listado de empresas')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'DELETE').map((c) => c.url)).toEqual(['/api/admin/companies/4', '/api/admin/companies/4']);
  });

  it('un rechazo porque sigue en uso (COMPANY_HAS_BILLING) sugiere desactivarla en su lugar, no el error genérico', async () => {
    renderDetail({ ...company, employee_count: 0 }, [admin], () => apiFail(409, 'COMPANY_HAS_BILLING', 'La empresa tiene cargos o pagos'));
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Eliminar Panificadora?' });
    await userEvent.type(within(dialog).getByLabelText(/Escribe «Panificadora»/), 'Panificadora');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar empresa' }));
    const popup = await screen.findByRole('alertdialog', { name: 'La empresa está en uso: desactívala' });
    expect(popup).toHaveTextContent('La empresa tiene cargos o pagos');
  });

  it('administradores paginados: desactivar pide confirmación (cancelar no envía nada) y vuelve a cargar la página', async () => {
    const calls = renderDetail(company);
    expect(await screen.findByText('admin@pan.com')).toBeInTheDocument();
    expect(screen.getByText('Aún no inicia sesión')).toBeInTheDocument();
    const deactivate = within(screen.getByText('admin@pan.com').closest('li')!).getByRole('button', { name: 'Desactivar' });
    await userEvent.click(deactivate);
    let dialog = await screen.findByRole('alertdialog', { name: '¿Desactivar a admin@pan.com?' });
    expect(dialog).toHaveTextContent('Ya no podrá iniciar sesión en Panificadora y su sesión actual se cerrará.');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: ActivoDespués: Inactivo');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
    expect(calls.filter((c) => c.url.includes('/admins?'))).toHaveLength(1); // ni siquiera se vuelve a pedir la página

    await userEvent.click(deactivate);
    dialog = await screen.findByRole('alertdialog', { name: '¿Desactivar a admin@pan.com?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar administrador' }));
    expect(await screen.findByText('Administrador desactivado')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'PATCH')?.url).toBe('/api/admin/companies/4/admins/9/status');
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/admins?'))).toHaveLength(2));
  });

  it('activar un administrador inactivo también se confirma', async () => {
    const calls = renderDetail(company, [{ ...admin, active: false, last_login_at: '2026-02-01T10:00:00Z' }]);
    expect(await screen.findByText(/Último acceso/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Activar a admin@pan.com?' });
    expect(dialog).toHaveTextContent('Podrá volver a iniciar sesión en Panificadora');
    expect(within(dialog).getByRole('region', { name: 'Cambios' })).toHaveTextContent('EstadoAntes: InactivoDespués: Activo');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Activar administrador' }));
    expect(await screen.findByText('Administrador activado')).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.init.method === 'PATCH')?.init.body as string)).toEqual({ active: true });
  });

  it('sin administradores: estado vacío y sin paginador', async () => {
    renderDetail(company, []);
    expect(await screen.findByText('Sin administradores')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });
});
