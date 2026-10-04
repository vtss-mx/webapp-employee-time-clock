import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { Company, PlatformStats } from '../../types';
import { AdminDashboardPage } from './AdminDashboardPage';
import { CompaniesListPage } from './CompaniesListPage';

const panificadora: Company = {
  id: 4,
  name: 'Panificadora',
  legal_name: 'Panificadora del Norte SA de CV',
  rfc: 'PNO120315AB1',
  phone: '+526621234567',
  active: true,
  max_employees: 50,
  api_enabled: false,
  employee_count: 3,
  admin_count: 2,
  created_at: '2026-01-15T18:00:00Z',
  updated_at: '2026-01-15T18:00:00Z',
};
/** Empresa desactivada, sin RFC ni límite de empleados. */
const logistica: Company = { ...panificadora, id: 5, name: 'logística sonora', rfc: null, max_employees: null, employee_count: 0, admin_count: 1, active: false };
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
    expect(screen.getByText(/^3 empleado\(s\) · desde/)).toBeInTheDocument();
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
    expect(await screen.findByText('Aún no hay empresas registradas')).toBeInTheDocument();
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
  it('tabla con RFC, uso del plan, administradores y estado; abrir una fila lleva al detalle', async () => {
    const { calls } = mockFetch(apiOk({ ...page([panificadora, logistica]), total: 2 }));
    renderAt('/admin/companies', <CompaniesListPage />);
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(await screen.findByText('2 registradas en la plataforma')).toBeInTheDocument();
    for (const column of ['Empresa', 'Empleados', 'Administradores', 'Alta', 'Estado']) expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument();
    const [first, second] = screen.getAllByRole('row').slice(1);
    expect(first).toHaveTextContent('PNO120315AB1');
    expect(within(first).getByText('/ 50')).toBeInTheDocument(); // con límite: usados / límite
    expect(within(first).getByText('Activo')).toBeInTheDocument();
    expect(second).toHaveTextContent('Sin RFC');
    expect(within(second).queryByText(/\//)).toBeNull(); // sin límite
    expect(within(second).getByText('Inactivo')).toBeInTheDocument();
    expect(calls[0].url).toContain('/api/admin/companies');

    await userEvent.click(within(second).getByText('logística sonora'));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
  });

  it('sin empresas invita a registrar la primera; con búsqueda dice que nada coincide', async () => {
    const { calls } = mockFetch(apiOk(page([])));
    renderAt('/admin/companies', <CompaniesListPage />);
    expect(await screen.findByText('No hay empresas registradas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Registrar la primera/ })).toHaveAttribute('href', '/admin/companies/new');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar empresas' }), 'pan');
    expect(await screen.findByText('Ninguna empresa coincide con la búsqueda')).toBeInTheDocument();
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
