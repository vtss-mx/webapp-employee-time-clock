import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Company, PlatformStats } from '../../types';
import { AdminDashboardPage } from './AdminDashboardPage';
import { CompaniesListPage } from './CompaniesListPage';

const panificadora: Company = {
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
  require_employee_documents: false,
  max_validators: 0,
  active_validators: 0,
  employee_count: 3,
  admin_count: 2,
  billing_status: 'ACTIVE',
  suspension_reason: null,
  created_at: '2026-01-15T18:00:00Z',
  updated_at: '2026-01-15T18:00:00Z',
};
/** Empresa desactivada, sin identificador fiscal ni límite de empleados. */
const logistica: Company = { ...panificadora, id: 5, name: 'logística sonora', tax_country: null, tax_id_type: null, tax_id: null, max_employees: null, employee_count: 0, admin_count: 1, active: false };
const stats: PlatformStats = { companies: 2, active_companies: 1, employees: 3, company_admins: 3 };
const page = (items: Company[]) => ({ items, total: items.length, page: 1, size: 10 });

/** La pantalla en su ruta y el detalle de empresa a donde lleva cada una. */
function renderAt(route: string, ui: ReactElement) {
  return renderWithProviders(
    <Routes>
      <Route path={route} element={ui} />
      <Route path="/admin/companies/:id" element={<p>Detalle de empresa</p>} />
    </Routes>,
    { route },
  );
}

describe('AdminDashboardPage (panel de la plataforma)', () => {
  const platform = (companies: Company[]) => (call: MockCall) => (call.url.includes('/admin/stats') ? apiOk(stats) : apiOk(page(companies)));

  it('muestra los indicadores y las 5 empresas más recientes; cada una abre su detalle', async () => {
    const { calls } = mockFetch(platform([panificadora, logistica]));
    const { container } = renderAt('/admin/dashboard', <AdminDashboardPage />);
    expect(screen.getByLabelText('Cargando')).toBeInTheDocument(); // la lista mientras carga
    expect(await screen.findByText('Panificadora')).toBeInTheDocument();
    expect(calls.find((c) => c.url.startsWith('/api/admin/companies'))?.url).toBe('/api/admin/companies?size=5');
    expect(screen.getByText('PA')).toBeInTheDocument();
    expect(screen.getByText('LO')).toBeInTheDocument(); // iniciales en mayúsculas
    expect(screen.getByText(/^3 empleados · desde/)).toBeInTheDocument();
    expect(screen.getByText(/^0 empleados · desde/)).toBeInTheDocument(); // el plural sigue al número
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect([...container.querySelectorAll('.kpi__label')].map((kpi) => kpi.textContent)).toEqual(['Empresas', 'Empresas activas', 'Empleados', 'Administradores']);
    await waitFor(() => expect(container.querySelectorAll('.kpi__value')[3]).toHaveTextContent('3'));
    expect(screen.getByRole('link', { name: /Registrar empresa/ })).toHaveAttribute('href', '/admin/companies/new');
    expect(screen.getByRole('link', { name: /Ver todas/ })).toHaveAttribute('href', '/admin/companies');

    await userEvent.click(screen.getByRole('link', { name: /Panificadora/ }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
  });

  it('sin empresas: explica qué aparecerá ahí', async () => {
    mockFetch(platform([]));
    renderAt('/admin/dashboard', <AdminDashboardPage />);
    expect(await screen.findByText('Sin empresas')).toBeInTheDocument();
    expect(screen.getByText('Aquí verás las empresas más recientes.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('si no carga: popup y "Volver a cargar" en lugar de los indicadores', async () => {
    let attempts = 0;
    mockFetch((call) => {
      if (call.url.includes('/admin/stats') && attempts++ === 0) return apiFail(500, 'INTERNAL_ERROR', 'Falló el servidor');
      return platform([panificadora])(call);
    });
    renderAt('/admin/dashboard', <AdminDashboardPage />);
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cargar el panel' });
    expect(popup).toHaveTextContent('Falló el servidor');
    expect(screen.queryByLabelText('Cargando')).toBeNull(); // con error no queda el esqueleto de la lista
    await userEvent.click(within(popup).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    expect(await screen.findByText('Panificadora')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Volver a cargar' })).toBeNull();
  });
});

describe('CompaniesListPage (empresas de la plataforma)', () => {
  it('tabla con identificador fiscal, uso del plan, administradores y estado; abrir una fila lleva al detalle', async () => {
    const { calls } = mockFetch(apiOk({ ...page([panificadora, logistica]), total: 2 }));
    renderAt('/admin/companies', <CompaniesListPage />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    expect(await screen.findByText('2 registradas en la plataforma')).toBeInTheDocument();
    for (const column of ['Empresa', 'Empleados', 'Administradores', 'Alta', 'Estado']) expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument();
    const [first, second] = screen.getAllByRole('row').slice(1);
    expect(first).toHaveTextContent('RFC · PNO120315AB1 · México');
    expect(within(first).getByText('/ 50')).toBeInTheDocument(); // con límite: usados / límite
    expect(within(first).getByText('Activo')).toBeInTheDocument();
    expect(second).toHaveTextContent('Sin identificador fiscal');
    expect(within(second).queryByText(/\//)).toBeNull(); // sin límite
    expect(within(second).getByText('Inactivo')).toBeInTheDocument();
    expect(calls[0].url).toContain('/api/admin/companies');

    await userEvent.click(within(second).getByText('logística sonora'));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
  });

  it('sin empresas invita a registrar la primera; con búsqueda dice que nada coincide', async () => {
    const { calls } = mockFetch(apiOk(page([])));
    renderAt('/admin/companies', <CompaniesListPage />);
    expect(await screen.findByText('Sin empresas')).toBeInTheDocument();
    expect(screen.getByText('Registra la primera empresa para empezar.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Registrar la primera/ })).toHaveAttribute('href', '/admin/companies/new');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar empresas' }), 'pan');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    expect(screen.getByText('Prueba con otra búsqueda o filtro.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Registrar la primera/ })).toBeNull();
    // El vacío "nada coincide" se dibuja en cuanto cambia la búsqueda; la petición sale justo después.
    await waitFor(() => expect(calls.at(-1)?.url).toContain('search=pan'));
  });

  it('filtra por estado (activas o inactivas)', async () => {
    const { calls } = mockFetch(apiOk(page([panificadora])));
    renderAt('/admin/companies', <CompaniesListPage />);
    await screen.findByText('Panificadora');
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(await screen.findByRole('option', { name: /^Inactivas/ }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain('active=false'));
  });
});

describe('consola de la plataforma en inglés (en-US)', () => {
  it('panel: indicadores, empresas recientes con su plural y acciones en inglés', async () => {
    await setLocale('en-US');
    const one = { ...panificadora, employee_count: 1 };
    mockFetch((call) => (call.url.includes('/admin/stats') ? apiOk(stats) : apiOk(page([one, logistica]))));
    const { container } = renderAt('/admin/dashboard', <AdminDashboardPage />);
    expect(await screen.findByText(/^1 employee · since/)).toBeInTheDocument();
    expect(screen.getByText(/^0 employees · since/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Platform dashboard' })).toBeInTheDocument();
    expect([...container.querySelectorAll('.kpi__label')].map((kpi) => kpi.textContent)).toEqual(['Companies', 'Active companies', 'Employees', 'Admins']);
    expect(screen.getByRole('link', { name: /Register company/ })).toHaveAttribute('href', '/admin/companies/new');
    expect(screen.getByRole('link', { name: /View all/ })).toBeInTheDocument();
  });

  it('panel sin empresas y error de carga en inglés', async () => {
    await setLocale('en-US');
    mockFetch((call) => (call.url.includes('/admin/stats') ? apiFail(500, 'INTERNAL_ERROR', 'Server failed') : apiOk(page([]))));
    renderAt('/admin/dashboard', <AdminDashboardPage />);
    expect(await screen.findByRole('alertdialog', { name: "Couldn't load the dashboard" })).toBeInTheDocument();
  });

  it('empresas: subtítulo con su plural, columnas, filtro y vacíos en inglés', async () => {
    await setLocale('en-US');
    const { calls } = mockFetch(apiOk({ ...page([logistica]), total: 1 }));
    renderAt('/admin/companies', <CompaniesListPage />);
    expect(await screen.findByText('1 registered on the platform')).toBeInTheDocument();
    for (const column of ['Company', 'Employees', 'Admins', 'Registered', 'Status']) expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument();
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('No tax ID');
    await userEvent.click(screen.getByRole('button', { name: /Filter by status/ }));
    await userEvent.click(await screen.findByRole('option', { name: /^Inactive/ }));
    await waitFor(() => expect(calls.at(-1)?.url).toContain('active=false'));
    mockFetch(apiOk(page([])));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search companies' }), 'zz');
    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try another search or filter.')).toBeInTheDocument();
  });

  it('empresas sin registros en inglés: ícono, título, descripción y la acción', async () => {
    await setLocale('en-US');
    mockFetch(apiOk(page([])));
    renderAt('/admin/companies', <CompaniesListPage />);
    expect(await screen.findByText('No companies')).toBeInTheDocument();
    expect(screen.getByText('Register the first company to get started.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Register the first one/ })).toHaveAttribute('href', '/admin/companies/new');
  });
});
