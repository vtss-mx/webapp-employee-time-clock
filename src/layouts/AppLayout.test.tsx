import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../test/http';
import { renderWithProviders, tokenResponse, sampleUser } from '../test/render';
import { AppLayout } from './AppLayout';
import { DashboardPage } from '../pages/company/DashboardPage';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';

function SignIn() {
  const { login } = useAuth();
  useEffect(() => void login('ana@empresa.com', 'x'), [login]);
  return null;
}

function renderLayout(page = <p>contenido</p>) {
  return renderWithProviders(
    <>
      <SignIn />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={page} />
        </Route>
      </Routes>
    </>,
    { auth: true },
  );
}

/**
 * Empresa con sesión: la cola de validaciones (contador del menú) responde una página válida. Una
 * respuesta inválida se reintenta en segundo plano (lectura con fallas pasajeras) y esos reintentos
 * caerían en el servidor simulado de la prueba siguiente.
 */
function companyServer(pending = 0, extra: (call: MockCall) => Response | null = () => null) {
  return mockFetch((call) => {
    if (call.url.includes('/enrollments')) return apiOk({ items: [], total: pending, page: 1, size: 1 });
    return extra(call) ?? apiOk(tokenResponse({ ...sampleUser, role: 'COMPANY', employee: null }));
  });
}

const preferenceCalls = (calls: MockCall[]) =>
  calls.filter((c) => c.url.endsWith('/users/me/preferences')).map((c) => JSON.parse(c.init.body as string) as unknown);

describe('AppLayout: menú lateral contraíble', () => {
  it('contrae y expande (botón y Ctrl/⌘ + B); la preferencia se guarda en la BD, no en el navegador', async () => {
    const { calls } = mockFetch((call) =>
      call.url.endsWith('/users/me/preferences')
        ? apiOk(JSON.parse(call.init.body as string))
        : apiOk(tokenResponse({ ...sampleUser, preferences: { sidebar_collapsed: false } })),
    );
    renderLayout();
    const toggle = await screen.findByRole('button', { name: 'Contraer menú' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(document.querySelector('.shell')).toHaveClass('is-collapsed');
    // El nombre de cada opción sigue disponible (lector de pantalla y globo informativo).
    const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' });
    expect(within(sidebar).getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('data-tooltip', 'Mi perfil');

    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true })));
    await waitFor(() => expect(document.querySelector('.shell')).not.toHaveClass('is-collapsed'));
    expect(screen.getByRole('button', { name: 'Contraer menú' })).toBeInTheDocument();
    expect(preferenceCalls(calls)).toEqual([{ sidebar_collapsed: true }, { sidebar_collapsed: false }]);
    expect(window.localStorage.getItem('tc.sidebar.collapsed')).toBeNull();
  });

  it('respeta la preferencia guardada y la revierte si el servidor no la guarda', async () => {
    mockFetch((call) =>
      call.url.endsWith('/users/me/preferences')
        ? apiFail(503, 'SERVICE_UNAVAILABLE')
        : apiOk(tokenResponse({ ...sampleUser, preferences: { sidebar_collapsed: true } })),
    );
    renderLayout();
    const expand = await screen.findByRole('button', { name: 'Expandir menú' });
    expect(document.querySelector('.shell')).toHaveClass('is-collapsed');
    await userEvent.click(expand);
    await waitFor(() => expect(document.querySelector('.shell')).toHaveClass('is-collapsed'));
  });

  it('muestra el rol con su nombre oficial', async () => {
    companyServer();
    renderLayout();
    expect(await screen.findByText('Company', { selector: '.sidebar__section' })).toBeInTheDocument();
  });

  it('teléfonos: el menú hamburguesa abre el menú lateral, se cierra con Escape, con "Cerrar" o al tocar fuera', async () => {
    companyServer();
    renderLayout();
    const toggle = await screen.findByRole('button', { name: 'Abrir menú' });
    const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(sidebar).toHaveClass('is-open');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.body).toHaveClass('no-scroll');
    expect(within(sidebar).getAllByRole('link').filter((l) => l.classList.contains('nav-item'))[0]).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(sidebar).not.toHaveClass('is-open');
    expect(document.body).not.toHaveClass('no-scroll');
    expect(toggle).toHaveFocus();

    await userEvent.click(toggle);
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Cerrar menú' }));
    expect(sidebar).not.toHaveClass('is-open');
    await userEvent.click(toggle);
    await userEvent.click(document.querySelector('.sidebar-overlay') as HTMLElement);
    expect(sidebar).not.toHaveClass('is-open');
  });

  it('la barra muestra la pantalla actual y la suma de pendientes en el botón del menú', async () => {
    companyServer(3);
    renderLayout();
    const bar = await screen.findByRole('banner');
    await waitFor(() => expect(within(bar).getByRole('button', { name: 'Abrir menú' })).toHaveTextContent('3'));
    expect(within(bar).getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/company/dashboard');
  });

  it('el dashboard muestra los pendientes de la misma consulta del menú (una sola consulta periódica)', async () => {
    const { calls } = companyServer(2, (call) => {
      if (call.url.includes('/face/learning')) return apiOk({ enabled: true, employees_learning: 0, learned_samples: 0 });
      return call.url.includes('/employees') ? apiOk({ items: [], total: 5, page: 1, size: 1 }) : null;
    });
    renderLayout(<DashboardPage />);
    expect(await screen.findByText(/2 registros faciales esperan/)).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/enrollments'))).toHaveLength(1);
  });

  it('el menú son las pantallas que envía el backend (orden, nombres y contadores)', async () => {
    companyServer(4);
    renderLayout();
    const sidebar = await screen.findByRole('complementary', { name: 'Navegación principal' });
    const links = () => within(sidebar).getAllByRole('link').filter((l) => l.classList.contains('nav-item'));
    expect(links().map((l) => l.getAttribute('href'))).toEqual([
      '/company/dashboard',
      '/company/employees',
      '/company/departments',
      '/company/validations',
      '/company/validators',
      '/company/reports',
      '/company/settings',
      '/company/integrations',
      '/profile',
    ]);
    await waitFor(() => expect(within(sidebar).getByRole('link', { name: /Validaciones/ })).toHaveTextContent('4'));
  });

  it('administrador de la plataforma: panel, empresas, errores del sistema (con pendientes) y perfil', async () => {
    mockFetch((call) =>
      call.url.includes('/admin/errors/summary')
        ? apiOk({ by_status: { PENDING: 3 }, open_by_severity: {}, pending: 3, last_seen_at: null })
        : apiOk(tokenResponse({ ...sampleUser, role: 'ADMIN', employee: null })),
    );
    renderLayout();
    const sidebar = await screen.findByRole('complementary', { name: 'Navegación principal' });
    const labels = () =>
      within(sidebar)
        .getAllByRole('link')
        .filter((l) => l.classList.contains('nav-item'))
        .map((l) => l.textContent);
    await waitFor(() => expect(labels()).toEqual(['Panel', 'Empresas', 'Errores del sistema3', 'Mi perfil']));
    // Sin empresa ni empleos (dato del backend, no el rol): la consola de la plataforma.
    expect(within(sidebar).getByText('Consola de la plataforma', { selector: '.brand-name small' })).toBeInTheDocument();
  });

  it('empresa: administra sus validadores desde el menú', async () => {
    companyServer();
    renderLayout();
    const sidebar = await screen.findByRole('complementary', { name: 'Navegación principal' });
    expect(within(sidebar).getByRole('link', { name: /Validadores/ })).toHaveAttribute('href', '/company/validators');
  });

  it('validador: solo identificar empleados y su perfil', async () => {
    const company = { id: 1, name: 'Mi empresa', active: true };
    mockFetch(() => apiOk(tokenResponse({ ...sampleUser, role: 'VALIDATOR', employee: null, company })));
    renderLayout();
    const sidebar = await screen.findByRole('complementary', { name: 'Navegación principal' });
    const links = within(sidebar)
      .getAllByRole('link')
      .filter((l) => l.classList.contains('nav-item'));
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Identificar empleados', '/validator/checkpoint'],
      ['Mi perfil', '/profile'],
    ]);
    expect(screen.getByText('Validator', { selector: '.sidebar__section' })).toBeInTheDocument();
    expect(within(sidebar).getByText('Mi empresa', { selector: '.brand-name small' })).toBeInTheDocument();
  });
});

describe('AppLayout: cerrar sesión', () => {
  it('pregunta antes de salir y solo cierra la sesión si se confirma', async () => {
    const { calls } = mockFetch((call) => (call.url.endsWith('/auth/logout') ? apiOk(null) : apiOk(tokenResponse(sampleUser))));
    renderLayout();
    const sidebar = await screen.findByRole('complementary', { name: 'Navegación principal' });
    const logoutCalls = () => calls.filter((c) => c.url.endsWith('/auth/logout'));

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Cerrar sesión' }));
    expect(screen.getByRole('alertdialog', { name: '¿Estás seguro de que deseas cerrar sesión?' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}'); // cerrar el popup = seguir en la sesión
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(logoutCalls()).toHaveLength(0);
    expect(screen.getByText('contenido')).toBeInTheDocument();

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Cerrar sesión' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Estás seguro de que deseas cerrar sesión?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(logoutCalls()).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('contenido')).toBeNull()); // sin sesión, sin el área de trabajo
  });
});
