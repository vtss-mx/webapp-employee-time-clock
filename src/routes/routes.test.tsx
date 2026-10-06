import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SessionsPanel } from '../components/SessionsPanel';
import { AuthProvider } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { apiFail, apiOk, mockFetch, testSession } from '../test/http';
import { sampleUser, tokenResponse } from '../test/render';
import { withScreens } from '../test/screens';
import type { FaceStatus, User } from '../types';
import { AppRouter } from './AppRouter';
import { homeForUser, paths } from './paths';

// Cada pantalla se dibuja como su nombre (aquí importa a qué ruta lleva, no su contenido); el
// menú y los catálogos no intervienen. El perfil usa el panel de sesiones real.
vi.mock('./lazyPages', async (importOriginal) => {
  const pages = await importOriginal<Record<string, unknown>>();
  const named = (name: string): ComponentType => () => <span>{name}</span>;
  return Object.fromEntries(Object.keys(pages).map((name) => [name, name === 'ProfilePage' ? SessionsPanel : named(name)]));
});
vi.mock('./CatalogGate', () => ({ CatalogGate: () => <Outlet /> }));
vi.mock('../layouts/AppLayout', () => ({ AppLayout: () => <Outlet /> }));

function renderApp(route: string, user: Omit<User, 'screens' | 'home'> = sampleUser, extra: Record<string, () => Response> = {}) {
  testSession.signedIn = true;
  mockFetch((call) => {
    const key = Object.keys(extra).find((p) => call.url.includes(p));
    if (key) return extra[key]();
    return call.url.endsWith('/auth/refresh') ? apiOk(tokenResponse(user)) : apiFail(404, 'NOT_FOUND');
  });
  return render(
    <MemoryRouter initialEntries={[route]}>
      <FeedbackProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </FeedbackProvider>
    </MemoryRouter>,
  );
}

const withFace = (face_status: FaceStatus): User => ({ ...sampleUser, employee: sampleUser.employee && { ...sampleUser.employee, face_status } });
const company = { ...sampleUser, role: 'COMPANY' as const, employee: null };

describe('rutas (armadas con las pantallas que envía el backend)', () => {
  it('helpers de rutas: el inicio lo decide el backend', () => {
    expect(homeForUser(withScreens(company))).toBe(paths.company.dashboard);
    expect(homeForUser(sampleUser)).toBe(paths.employee.attendance); // aprobado: su primera pantalla es "Mi asistencia"
    expect(homeForUser({ home: null })).toBe(paths.profile);
    expect(paths.company.employee(3)).toBe('/company/employees/3');
    expect(paths.company.editEmployee(3)).toBe('/company/employees/3/edit');
    expect(paths.company.validation(4)).toBe('/company/validations/4');
  });

  it('la raíz lleva al inicio del usuario tras restaurar la sesión', async () => {
    renderApp('/');
    expect(screen.getByText('Cargando…')).toBeInTheDocument(); // restaurando la sesión
    expect(await screen.findByText('MyAttendancePage')).toBeInTheDocument();
  });

  it.each([
    ['NOT_ENROLLED', 'EnrollmentPage'],
    ['PENDING_REVIEW', 'PendingValidationPage'],
    ['APPROVED', 'VerificationMenuPage'],
  ] as const)('el empleado en estado %s va a la pantalla que le corresponde', async (status, page) => {
    renderApp(paths.employee.dashboard, withFace(status));
    expect(await screen.findByText(page)).toBeInTheDocument();
  });

  it('un empleado aprobado no vuelve al registro', async () => {
    renderApp(paths.employee.enroll, withFace('APPROVED'));
    expect(await screen.findByText('MyAttendancePage')).toBeInTheDocument();
  });

  it('una pantalla que el backend no le da lleva a su inicio; una ruta inexistente, a "no encontrada"', async () => {
    renderApp(paths.company.dashboard);
    expect(await screen.findByText('MyAttendancePage')).toBeInTheDocument();
    expect(screen.queryByText('DashboardPage')).toBeNull();
  });

  it('una ruta que no existe muestra "no encontrada"', async () => {
    renderApp('/no-existe');
    expect(await screen.findByText('NotFoundPage')).toBeInTheDocument();
  });

  it('las subpantallas de una pantalla también se arman (detalle de empleado)', async () => {
    renderApp(paths.company.employee(3), company);
    expect(await screen.findByText('EmployeeDetailPage')).toBeInTheDocument();
  });

  it('SessionsPanel lista sesiones y revoca otra', async () => {
    let revoked = false;
    const sessions = () => [
      { id: 'a', created_at: new Date().toISOString(), last_used_at: null, expires_at: 'x', ip_address: '1.1.1.1', user_agent: 'Mozilla (iPhone) Mobile Safari/1', current: true },
      ...(revoked ? [] : [{ id: 'b', created_at: new Date().toISOString(), last_used_at: null, expires_at: 'x', ip_address: null, user_agent: null, current: false }]),
    ];
    renderApp(paths.profile, sampleUser, {
      '/auth/sessions/b': () => {
        revoked = true;
        return apiOk(null);
      },
      '/auth/sessions': () => apiOk({ items: sessions(), total: sessions().length, page: 1, size: 10 }),
    });
    expect(await screen.findByText('Este dispositivo')).toBeInTheDocument();
    expect(screen.getByText('Dispositivo desconocido')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toHaveTextContent('Mostrando 1–2 de 2 sesiones'); // paginadas
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Cerrar la sesión de Dispositivo desconocido?' })).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(screen.queryByText('Dispositivo desconocido')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: /todos los dispositivos/ }));
    expect(await screen.findByRole('alertdialog', { name: '¿Cerrar la sesión en todos tus dispositivos?' })).toBeInTheDocument();
  });
});
