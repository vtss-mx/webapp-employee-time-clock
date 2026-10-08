import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../test/http';
import { renderWithProviders, tokenResponse, sampleUser } from '../test/render';
import { withScreens } from '../test/screens';
import { AppLayout } from './AppLayout';
import { DashboardPage } from '../pages/company/DashboardPage';
import { useAuth } from '../hooks/useAuth';
import { notifyAbsenceRequestsChanged } from '../hooks/usePendingAbsenceRequests';
import { notifyShiftRequestsChanged } from '../hooks/usePendingShiftRequests';
import { notifyAttendanceReviewsChanged } from '../hooks/usePendingAttendanceReviews';
import { notifyFraudCasesChanged } from '../hooks/usePendingFraudCases';
import { useEffect } from 'react';
import { setLocale } from '../i18n/core';

function SignIn() {
  const { login } = useAuth();
  useEffect(() => void login('ana@empresa.com', 'x'), [login]);
  return null;
}

function renderLayout(page = <p>contenido</p>, route = '/') {
  return renderWithProviders(
    <>
      <SignIn />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="*" element={page} />
        </Route>
      </Routes>
    </>,
    { auth: true, route },
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
    const answered = extra(call);
    if (answered) return answered;
    if (call.url.endsWith('/attendance/reviews/count')) return apiOk({ pending: 0 });
    return apiOk(tokenResponse({ ...sampleUser, role: 'COMPANY', employee: null }));
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
    expect(await screen.findByText('Empresa', { selector: '.sidebar__section' })).toBeInTheDocument();
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

  it('la barra muestra la pantalla actual; los pendientes van en el menú, no sobre el botón', async () => {
    companyServer(3);
    renderLayout();
    const bar = await screen.findByRole('banner');
    const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' });
    expect(await within(sidebar).findByText('3')).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Abrir menú' }).querySelector('.mobilebar__badge')).toBeNull();
    expect(within(bar).getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/company/dashboard');
  });

  it('el dashboard muestra los pendientes de la misma consulta del menú (una sola consulta periódica)', async () => {
    const { calls } = companyServer(2, (call) => (call.url.includes('/employees') ? apiOk({ items: [], total: 5, page: 1, size: 1 }) : null));
    renderLayout(<DashboardPage />);
    expect(await screen.findByText(/2 registros faciales esperan/)).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/enrollments'))).toHaveLength(1);
  });

  it('el menú son las pantallas que envía el backend, en menús y submenús (orden, nombres y contadores)', async () => {
    const { calls } = companyServer(4, (call) => {
      if (call.url.endsWith('/shift-requests/summary')) return apiOk({ pending: 2 });
      if (call.url.endsWith('/attendance/reviews/count')) return apiOk({ pending: 1 });
      return call.url.endsWith('/calendar/absences/summary') ? apiOk({ pending: 3 }) : null;
    });
    renderLayout();
    const sidebar = await screen.findByRole('complementary', { name: 'Navegación principal' });
    // Lo más simple: un módulo con una sola pantalla es una opción directa; con varias, un submenú (cerrado).
    const top = () => [...sidebar.querySelectorAll('.sidebar__nav > * > .nav-item')].map((item) => item.textContent);
    await waitFor(() => expect(top()).toEqual(['Panel', 'Personal4', 'Asistencia6', 'Validadores', 'Integraciones (API)', 'Cuenta']));
    // «Cuenta» reúne los documentos de la empresa y Mi perfil (módulo ACCOUNT del backend).
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Cuenta' }));
    expect(within(sidebar).getByRole('link', { name: 'Documentos' })).toHaveAttribute('href', '/company/documents');
    expect(within(sidebar).getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/profile');
    const people = within(sidebar).getByRole('button', { name: /Personal/ });
    expect(people).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(people);
    expect(within(sidebar).getByRole('link', { name: /Validaciones/ })).toHaveTextContent('4');
    expect(within(sidebar).getByRole('link', { name: 'Empleados' })).toHaveAttribute('href', '/company/employees');
    expect(people).not.toHaveTextContent('4'); // abierto, el pendiente está en su opción
    // Solo un submenú abierto a la vez.
    await userEvent.click(within(sidebar).getByRole('button', { name: /Asistencia/ }));
    expect(within(sidebar).queryByRole('link', { name: 'Empleados' })).toBeNull();
    expect(within(sidebar).getByRole('link', { name: /Turnos/ })).toHaveTextContent('2');
    expect(within(sidebar).getByRole('link', { name: /Calendario/ })).toHaveTextContent('3');
    // Registros "en revisión" que la empresa confirma o rechaza (contador del tablero).
    expect(within(sidebar).getByRole('link', { name: /Tablero del día/ })).toHaveTextContent('1');
    await userEvent.click(within(sidebar).getByRole('button', { name: /Asistencia/ }));
    expect(within(sidebar).queryByRole('link', { name: /Turnos/ })).toBeNull();
    // Solicitudes de cambio de turno pendientes: una consulta periódica, que se repite al avisar un cambio.
    const asked = calls.filter((c) => c.url.endsWith('/shift-requests/summary')).length;
    act(() => notifyShiftRequestsChanged());
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/shift-requests/summary')).length).toBe(asked + 1));
    // Igual las solicitudes de vacaciones o permisos (contador de Calendario).
    const absences = calls.filter((c) => c.url.endsWith('/calendar/absences/summary')).length;
    act(() => notifyAbsenceRequestsChanged());
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/calendar/absences/summary')).length).toBe(absences + 1));
    const reviews = calls.filter((c) => c.url.endsWith('/attendance/reviews/count')).length;
    act(() => notifyAttendanceReviewsChanged());
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/attendance/reviews/count')).length).toBe(reviews + 1));
  });

  it('el submenú de la pantalla actual se abre solo; con el menú contraído (solo íconos) se ven todas las pantallas', async () => {
    companyServer();
    renderLayout(<p>contenido</p>, '/company/shifts/new');
    const sidebar = await screen.findByRole('complementary', { name: 'Navegación principal' });
    expect(await within(sidebar).findByRole('button', { name: /Asistencia/ })).toHaveAttribute('aria-expanded', 'true');
    expect(within(sidebar).getByRole('link', { name: 'Turnos' })).toBeInTheDocument();
    expect(within(sidebar).queryByRole('link', { name: 'Empleados' })).toBeNull();
    // Al ir a una pantalla de otro submenú, se abre ese y se cierra el anterior.
    await userEvent.click(within(sidebar).getByRole('button', { name: /Personal/ }));
    await userEvent.click(within(sidebar).getByRole('link', { name: 'Empleados' }));
    expect(within(sidebar).getByRole('button', { name: /Personal/ })).toHaveAttribute('aria-expanded', 'true');
    expect(within(sidebar).getByRole('button', { name: /Asistencia/ })).toHaveAttribute('aria-expanded', 'false');

    const user = { ...sampleUser, role: 'COMPANY' as const, employee: null, preferences: { sidebar_collapsed: true } };
    mockFetch((call) => (call.url.includes('/enrollments') ? apiOk({ items: [], total: 0, page: 1, size: 1 }) : apiOk(tokenResponse(user))));
    cleanup();
    renderLayout();
    const compact = await screen.findByRole('complementary', { name: 'Navegación principal' });
    expect(await within(compact).findByRole('link', { name: 'Empleados' })).toBeInTheDocument();
    expect(within(compact).getByRole('link', { name: 'Turnos' })).toBeInTheDocument();
    expect(within(compact).queryByRole('button', { name: /Personal/ })).toBeNull();
  });

  it('sin módulos (un backend anterior) el menú es una sola lista, sin submenús', async () => {
    const admin = { ...sampleUser, role: 'ADMIN' as const, employee: null };
    const legacy = { ...tokenResponse(admin), user: { ...withScreens(admin), modules: [] } };
    mockFetch((call) => (call.url.includes('/admin/errors/summary') ? apiOk({ by_status: {}, open_by_severity: {}, pending: 0, last_seen_at: null }) : apiOk(legacy)));
    renderLayout();
    const sidebar = await screen.findByRole('complementary', { name: 'Navegación principal' });
    expect(within(sidebar).getByRole('link', { name: 'Empresas' })).toBeInTheDocument();
    expect(sidebar.querySelector('.nav-menu')).toBeNull();
  });

  it('administrador de la plataforma: panel, empresas, errores del sistema (con pendientes), seguridad facial, casos de fraude (por revisar), rendimiento (alertas abiertas) y perfil', async () => {
    const mocked = mockFetch((call) => {
      if (call.url.includes('/admin/errors/summary')) return apiOk({ by_status: { PENDING: 3 }, open_by_severity: {}, pending: 3, last_seen_at: null });
      if (call.url.includes('/admin/performance/alerts/summary')) return apiOk({ open: 2, acknowledged: 0, latest: null });
      if (call.url.includes('/admin/fraud-cases/count')) return apiOk({ active: 4 });
      return apiOk(tokenResponse({ ...sampleUser, role: 'ADMIN', employee: null }));
    });
    renderLayout(<p>contenido</p>, '/admin/dashboard');
    const sidebar = await screen.findByRole('complementary', { name: 'Navegación principal' });
    const labels = () =>
      within(sidebar)
        .getAllByRole('link')
        .filter((l) => l.classList.contains('nav-item'))
        .map((l) => l.textContent);
    // "Plataforma" abre su submenú porque la pantalla actual (Panel) es suya.
    await waitFor(() => expect(labels()).toEqual(['Panel', 'Empresas', 'Mi perfil']));
    expect(within(sidebar).getByRole('button', { name: 'Plataforma' })).toHaveAttribute('aria-expanded', 'true');
    // "Operación" (errores del sistema, seguridad facial, casos de fraude y rendimiento) se abre a demanda; un submenú a la vez.
    await userEvent.click(within(sidebar).getByRole('button', { name: /Operación/ }));
    await waitFor(() => expect(labels()).toEqual(['Errores del sistema3', 'Seguridad facial', 'Casos de fraude4', 'Rendimiento2', 'Deriva de señales', 'Mi perfil']));
    // Casos de fraude por revisar: una consulta periódica, que se repite al avisar una revisión.
    const fraud = () => mocked.calls.filter((c) => c.url.endsWith('/admin/fraud-cases/count')).length;
    const asked = fraud();
    act(() => notifyFraudCasesChanged());
    await waitFor(() => expect(fraud()).toBe(asked + 1));
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
    expect(screen.getByText('Validador', { selector: '.sidebar__section' })).toBeInTheDocument();
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
    expect(screen.getByRole('alertdialog', { name: '¿Cerrar sesión?' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}'); // cerrar el popup = seguir en la sesión
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(logoutCalls()).toHaveLength(0);
    expect(screen.getByText('contenido')).toBeInTheDocument();

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Cerrar sesión' }));
    const dialog = screen.getByRole('alertdialog', { name: '¿Cerrar sesión?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(logoutCalls()).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('contenido')).toBeNull()); // sin sesión, sin el área de trabajo
  });
});

describe('AppLayout en inglés (en-US)', () => {
  it('los textos propios del marco en inglés; los nombres del menú son los que envía el backend', async () => {
    mockFetch((call) =>
      call.url.includes('/admin/errors/summary')
        ? apiOk({ by_status: {}, open_by_severity: {}, pending: 0, last_seen_at: null })
        : apiOk(tokenResponse({ ...sampleUser, role: 'ADMIN', employee: null })),
    );
    await setLocale('en-US');
    renderLayout();
    const sidebar = await screen.findByRole('complementary', { name: 'Main navigation' });
    expect(within(sidebar).getByRole('navigation', { name: 'Menu' })).toBeInTheDocument();
    expect(within(sidebar).getByText('Platform console', { selector: '.brand-name small' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Collapse menu' })).toHaveAttribute('title', 'Collapse menu (Ctrl/⌘ + B)');
    expect(within(sidebar).getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Mi perfil' })).toBeInTheDocument(); // nombre del backend (sin traducir aquí)
    const bar = screen.getByRole('banner');
    expect(within(bar).getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    expect(within(bar).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent('Offline. Retrying automatically.');
    act(() => void window.dispatchEvent(new Event('online')));
    // Cerrar sesión: su popup en inglés.
    await userEvent.click(within(sidebar).getByRole('button', { name: 'Sign out' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Sign out?' });
    expect(dialog).toHaveTextContent("Your work is saved. You'll need to sign in again to manage the platform.");
    expect(within(dialog).getByRole('button', { name: 'Stay here' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sign out of all my devices' })).toBeInTheDocument();
  });

  it('el menú contraído y su popup de error siguen al idioma al cambiarlo en caliente', async () => {
    mockFetch((call) =>
      call.url.endsWith('/users/me/preferences') ? apiFail(503, 'SERVICE_UNAVAILABLE') : apiOk(tokenResponse({ ...sampleUser, preferences: { sidebar_collapsed: true } })),
    );
    renderLayout();
    await userEvent.click(await screen.findByRole('button', { name: 'Expandir menú' }));
    await screen.findByRole('alertdialog', { name: 'No se pudo guardar la preferencia del menú' });
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('alertdialog', { name: "Couldn't save the menu preference" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand menu' })).toHaveAttribute('title', 'Expand menu (Ctrl/⌘ + B)');
  });
});
