import { Building2 } from 'lucide-react';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { companyServerErrors, emptyCompanyForm, useCompanyForm } from '../hooks/useCompanyForm';
import { useSearchList, type ActiveFilter, type ListQuery } from '../hooks/useSearchList';
import { adminService } from '../services/adminService';
import { ApiError } from '../services/apiClient';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { WithCatalogs, renderWithProviders } from '../test/render';
import type { CompanyDetail, CompanyFormValues } from '../types';
import { validateCompanyForm } from '../utils/formRules';
import { validateCompanyRfc, validateMaxEmployees } from '../utils/validation';
import { CompanyAdminModal } from './CompanyAdminModal';
import { CompanyDetailPage } from '../pages/admin/CompanyDetailPage';
import { Route, Routes } from 'react-router-dom';
import { CompanyAdminFields, CompanyDataFields } from './CompanyForm';
import { KpiCard } from './ui/KpiCard';
import { ListToolbar } from './ui/ListControls';
import { ListResults } from './ui/ListResults';

const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;
const company: CompanyDetail = {
  id: 4,
  name: 'Panificadora',
  legal_name: 'Panificadora del Norte SA de CV',
  rfc: 'PNO120315AB1',
  contact_email: 'contacto@pan.com',
  phone: '+526621234567',
  active: true,
  max_employees: 50,
  employee_count: 3,
  admin_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  admins: [{ id: 9, email: 'admin@pan.com', active: true, last_login_at: null, created_at: '2026-01-01T00:00:00Z' }],
};
const validCompany: CompanyFormValues = {
  name: 'Panificadora',
  legal_name: 'Panificadora del Norte',
  rfc: 'PNO120315AB1',
  contact_email: 'contacto@pan.com',
  phone: '+526621234567',
  max_employees: '',
  admin_email: 'admin@pan.com',
  admin_password: 'Empresa1234',
};
const available = () => apiOk({ code: 'AVAILABLE', message: 'Disponible' });

describe('adminService', () => {
  it.each([
    ['stats', () => adminService.stats(), { companies: 1, active_companies: 1, employees: 0, company_admins: 1 }, 'GET', '/api/admin/stats'],
    ['list', () => adminService.list({ search: 'pan', page: 2 }), { items: [company], total: 1 }, 'GET', '/api/admin/companies?search=pan&page=2'],
    ['get', () => adminService.get(4), company, 'GET', '/api/admin/companies/4'],
    ['setStatus', () => adminService.setStatus(4, false), company, 'PATCH', '/api/admin/companies/4/status'],
    ['setAdminStatus', () => adminService.setAdminStatus(4, 9, true), company, 'PATCH', '/api/admin/companies/4/admins/9/status'],
    ['availability', () => adminService.availability('rfc', 'PNO120315AB1', 4), { code: 'AVAILABLE', message: 'ok' }, 'GET', '/api/admin/companies/availability?field=rfc&value=PNO120315AB1&exclude_id=4'],
  ])('%s', async (_name, call, data, method, url) => {
    const { calls } = mockFetch(apiOk(data));
    await call();
    expect(calls[0].init.method ?? 'GET').toBe(method);
    expect(calls[0].url).toBe(url);
  });

  it('envía los datos limpios: sin espacios, límite numérico o null y el primer administrador', async () => {
    const { calls } = mockFetch(apiOk(company));
    await adminService.create({ ...validCompany, name: '  Panificadora ', max_employees: '25', admin_email: ' admin@pan.com ' });
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ name: 'Panificadora', max_employees: 25, admin_email: 'admin@pan.com', admin_password: 'Empresa1234' });
    await adminService.update(4, { max_employees: '', phone: '+526621234567' });
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ max_employees: null, phone: '+526621234567' });
    await adminService.addAdmin(4, ' rh@pan.com ', 'Recursos123');
    expect(calls[2].url).toBe('/api/admin/companies/4/admins');
    expect(JSON.parse(calls[2].init.body as string)).toEqual({ admin_email: 'rh@pan.com', admin_password: 'Recursos123' });
  });
});

describe('validación de empresas', () => {
  it('RFC de persona moral (12) o física (13), límite opcional y administrador solo en el alta', () => {
    expect(validateCompanyRfc('pno-120315-ab1')).toBeUndefined();
    expect(validateCompanyRfc('')).toBe('El RFC es obligatorio');
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
  it('el botón se habilita solo con todo correcto y el RFC/correo verificados como disponibles', async () => {
    mockFetch(available());
    const { result } = renderHook(() => useCompanyForm({ withAdmin: true }), { wrapper });
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.touch('rfc'));
    expect(result.current.errors.rfc).toBe('El RFC es obligatorio');
    act(() => result.current.setValues(validCompany));
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
  });

  it('un RFC ya registrado bloquea el envío y se muestra en el campo', async () => {
    mockFetch((call) => (call.url.includes('field=rfc') ? apiOk({ code: 'TAKEN', message: 'RFC ya registrado' }) : available()));
    const { result } = renderHook(() => useCompanyForm({ withAdmin: true }), { wrapper });
    act(() => result.current.setValues(validCompany));
    await waitFor(() => expect(result.current.errors.rfc).toBe('RFC ya registrado'));
    expect(result.current.canSubmit).toBe(false);
  });

  it('errores del servidor por campo; cambiar el campo los descarta; la edición marca lo cargado', async () => {
    const { result } = renderHook(() => useCompanyForm({ withAdmin: false, excludeId: 4, originalRfc: 'PNO120315AB1' }), { wrapper });
    act(() => result.current.loadValues({ ...validCompany, legal_name: '' }));
    expect(result.current.errors.legal_name).toBe('La razón social es obligatorio');
    await act(() => result.current.save(() => Promise.reject(new ApiError({ statusCode: 409, code: 'COMPANY_RFC_TAKEN', message: 'RFC en uso' }))));
    expect(result.current.errors.rfc).toBe('RFC en uso');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo guardar' })).toBeInTheDocument();
    act(() => result.current.setValues({ ...result.current.values, rfc: 'ACM010101AB2' }));
    expect(result.current.errors.rfc).toBeUndefined();
    expect(companyServerErrors(new Error('x'))).toEqual({});
    expect(companyServerErrors(new ApiError({ statusCode: 409, code: 'EMAIL_TAKEN', message: 'en uso' }))).toEqual({ admin_email: 'en uso' });
  });
});

describe('CompanyForm', () => {
  function Harness() {
    const [values, setValues] = useState<CompanyFormValues>(emptyCompanyForm);
    const idle = { status: 'idle' as const };
    const props = { values, errors: {}, onChange: setValues, onTouch: vi.fn(), live: { rfc: { status: 'taken' as const, message: 'RFC en uso' }, admin_email: idle } };
    return (
      <>
        <CompanyDataFields {...props} />
        <CompanyAdminFields {...props} />
        <output>{JSON.stringify(values)}</output>
      </>
    );
  }

  it('normaliza RFC, teléfono y límite mientras se escribe; el límite es opcional', async () => {
    render(<Harness />, { wrapper: WithCatalogs });
    await userEvent.type(screen.getByLabelText('RFC de la empresa'), 'pno-120315-ab1');
    await userEvent.type(screen.getByLabelText('Teléfono'), '(662) 123-4567');
    await userEvent.type(screen.getByLabelText('Límite de empleados'), '1a5');
    await userEvent.type(screen.getByLabelText('Correo del administrador'), 'a@b.com');
    const values = JSON.parse(document.querySelector('output')?.textContent ?? '{}') as CompanyFormValues;
    expect(values).toMatchObject({ rfc: 'PNO120315AB1', phone: '+526621234567', max_employees: '15', admin_email: 'a@b.com' });
    expect(screen.getByLabelText('Teléfono')).toHaveValue('662 123 4567');
    expect(screen.getByText('RFC en uso')).toBeInTheDocument(); // validación en vivo
    expect(screen.getByText('Límite de empleados').closest('label')).not.toHaveClass('is-required');
    expect(screen.getByText('Razón social').closest('label')).toHaveClass('is-required');
  });
});

describe('useSearchList + ListControls', () => {
  type Row = { id: number; name: string };
  type RowPage = { items: Row[]; total: number };
  function Listado({ fetchPage, onOpen = vi.fn() }: { fetchPage: (query: ListQuery, signal: AbortSignal) => Promise<RowPage>; onOpen?: (row: Row) => void }) {
    const list = useSearchList(fetchPage, { pageSize: 2, errorTitle: 'No se pudo cargar' });
    return (
      <>
        <ListToolbar search={list.search} onSearch={list.setSearch} placeholder="Buscar" label="Buscar empresas" filter={list.filter} onFilter={list.setFilter} labels={{ active: 'Activas', inactive: 'Inactivas' }} />
        <ListResults
          list={list}
          columns={['Empresa']}
          onOpen={onOpen}
          empty={{ icon: null, title: 'No se encontraron empresas', action: !list.filtered && <button>Registrar la primera</button> }}
          renderCells={(row) => <td>{row.name}</td>}
        />
        <span data-testid="state">{`${list.loading ? 'cargando' : 'listo'}|${String(list.filtered)}|${list.data?.total ?? '-'}`}</span>
      </>
    );
  }

  it('busca con pausa, filtra, pagina y vuelve a la página 1 al cambiar el filtro', async () => {
    const fetchPage = vi.fn((query: ListQuery) => Promise.resolve({ items: [{ id: query.page, name: `Empresa ${query.page}` }], total: 5 }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(screen.getByText('Página 2 de 3')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por estado'), 'inactive' satisfies ActiveFilter);
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ active: false, page: 1 }), expect.any(AbortSignal)));
    await userEvent.type(screen.getByLabelText('Buscar empresas'), ' pan ');
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'pan' }), expect.any(AbortSignal)));
    expect(screen.getByTestId('state')).toHaveTextContent('true');
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
  });

  it('un error se muestra en popup con "Reintentar"', async () => {
    const fetchPage = vi.fn().mockRejectedValueOnce(new Error('caído')).mockResolvedValue({ items: [], total: 0 });
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
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull(); // una sola página
  });

  it('KpiCard: esqueleto mientras carga y luego el valor', () => {
    const { rerender, container } = render(<KpiCard label="Empresas" icon={Building2} value={undefined} />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    rerender(<KpiCard label="Empresas" icon={Building2} value={0} tile="icon-tile--success" />);
    expect(screen.getByText('Empresas')).toBeInTheDocument();
    expect(container.querySelector('.icon-tile--success')).not.toBeNull();
  });
});

describe('CompanyAdminModal', () => {
  const renderModal = (onAdded = vi.fn(), onClose = vi.fn()) =>
    render(
      <FeedbackProvider>
        <CompanyAdminModal open company={company} onClose={onClose} onSaved={onAdded} />
      </FeedbackProvider>,
    );

  it('agrega el administrador solo con correo disponible y contraseña segura', async () => {
    const onAdded = vi.fn();
    const onClose = vi.fn();
    mockFetch((call) => (call.url.includes('availability') ? available() : apiOk({ ...company, admin_count: 2 })));
    renderModal(onAdded, onClose);
    const add = screen.getByRole('button', { name: 'Agregar' });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Correo del administrador'), 'rh@pan.com');
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'corta');
    await userEvent.tab();
    expect(screen.getByText(/Mínimo 8 caracteres|al menos 8/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Contraseña inicial'));
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'Recursos123');
    await waitFor(() => expect(add).toBeEnabled());
    await userEvent.click(add);
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ admin_count: 2 })));
    expect(onClose).toHaveBeenCalled();
  });

  it('un correo ya registrado se marca en el campo y se explica en popup', async () => {
    mockFetch((call) => (call.url.includes('availability') ? available() : apiFail(409, 'EMAIL_TAKEN', 'El correo ya está registrado')));
    renderModal();
    await userEvent.type(screen.getByLabelText('Correo del administrador'), 'rh@pan.com');
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'Recursos123');
    const add = screen.getByRole('button', { name: 'Agregar' });
    await waitFor(() => expect(add).toBeEnabled());
    await userEvent.click(add);
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo agregar el administrador' })).toBeInTheDocument();
    expect(screen.getAllByText('El correo ya está registrado').length).toBeGreaterThan(0);
  });

  it('restablece la contraseña de un administrador (solo pide la contraseña nueva)', async () => {
    const onSaved = vi.fn();
    const { calls } = mockFetch(apiOk(company));
    render(
      <FeedbackProvider>
        <CompanyAdminModal open company={company} admin={company.admins[0]} onClose={vi.fn()} onSaved={onSaved} />
      </FeedbackProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Restablecer contraseña' })).toHaveTextContent('admin@pan.com');
    expect(screen.queryByLabelText('Correo del administrador')).toBeNull();
    const reset = screen.getByRole('button', { name: 'Restablecer' });
    expect(reset).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'Nueva12345');
    await userEvent.click(reset);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls[0].url).toBe('/api/admin/companies/4/admins/9/password');
    expect(calls[0].init.method).toBe('PUT');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ admin_password: 'Nueva12345' });
    expect(await screen.findByText('Contraseña restablecida')).toBeInTheDocument();
  });
});

describe('CompanyDetailPage: eliminar empresa', () => {
  const renderDetail = (detail: CompanyDetail) => {
    const mock = mockFetch((call) => (call.init.method === 'DELETE' ? apiOk(null) : apiOk(detail)));
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

  it('sin empleados se elimina escribiendo su nombre para confirmar', async () => {
    const calls = renderDetail({ ...company, employee_count: 0 });
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Eliminar Panificadora' });
    const confirm = within(dialog).getByRole('button', { name: 'Eliminar empresa' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Escribe «Panificadora»/), 'Panificadora');
    await userEvent.click(confirm);
    expect(await screen.findByText('Listado de empresas')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'DELETE')?.url).toBe('/api/admin/companies/4');
  });
});
