import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/apiClient';
import { apiOk, mockFetch, type MockCall } from '../test/http';
import { renderWithProviders, sampleUser } from '../test/render';
import { withScreens } from '../test/screens';
import type { User } from '../types';
import { ProfilePage } from './ProfilePage';

const session = vi.hoisted(() => ({
  user: null as User | null,
  refreshUser: vi.fn<() => Promise<void>>(),
  logout: vi.fn<() => Promise<void>>(),
  logoutEverywhere: vi.fn<() => Promise<void>>(),
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => session }));

/** Empleado con todos sus datos capturados. */
const employeeUser: User = {
  ...sampleUser,
  last_login_at: '2026-10-02T15:00:00Z',
  employee: sampleUser.employee && { ...sampleUser.employee, curp: 'RUAA900101MSRZNN09', rfc: 'RUAA900101AB1', nss: '12345678901', phone: '+526621234567' },
};
/** Administrador de empresa: sin datos de empleado. */
const companyUser: User = withScreens({ ...sampleUser, email: 'rh@empresa.com', role: 'COMPANY', employee: null });

const deviceSessions = { items: [{ id: 's1', created_at: '2026-10-01T10:00:00Z', last_used_at: null, expires_at: '2026-10-09T10:00:00Z', ip_address: '10.0.0.1', user_agent: null, current: true }], total: 1, page: 1, size: 10 };
function server() {
  return mockFetch((call: MockCall) => (call.url.includes('/auth/change-password') ? apiOk({ revoked_sessions: 2 }) : apiOk(deviceSessions)));
}
const sessionLoads = (calls: MockCall[]) => calls.filter((c) => c.url.startsWith('/api/auth/sessions')).length;

beforeEach(() => {
  session.user = employeeUser;
  session.refreshUser.mockResolvedValue(undefined);
  session.logout.mockResolvedValue(undefined);
});

describe('ProfilePage (Mi perfil)', () => {
  it('empleado: cuenta, rol, estado de su rostro y sus datos; relee el usuario al entrar', async () => {
    server();
    renderWithProviders(<ProfilePage />);
    expect(screen.getByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.getByText('AR')).toBeInTheDocument();
    expect(screen.getByText('Employee')).toBeInTheDocument(); // nombre del rol (catálogo)
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Validado')).toBeInTheDocument();
    for (const [label, value] of [
      ['Correo electrónico', 'ana@empresa.com'],
      ['Número de empleado', 'EMP-7'],
      ['CURP', 'RUAA900101MSRZNN09'],
      ['RFC', 'RUAA900101AB1'],
      ['NSS', '12345678901'],
      ['Teléfono celular', '662 123 4567'],
    ]) {
      expect(screen.getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(session.refreshUser).toHaveBeenCalledOnce();
    expect(await screen.findByText('Este dispositivo')).toBeInTheDocument(); // sesiones activas
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cuenta sin datos de empleado: su correo como nombre y sin datos del expediente', async () => {
    session.user = companyUser;
    server();
    renderWithProviders(<ProfilePage />);
    expect(screen.getByRole('heading', { name: 'rh@empresa.com' })).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    for (const label of ['Número de empleado', 'CURP', 'RFC', 'NSS', 'Teléfono celular']) expect(screen.queryByText(label)).toBeNull();
    expect(screen.queryByText('Validado')).toBeNull();
    await screen.findByText('Este dispositivo');
  });

  it('si no se pudo actualizar la información, lo avisa en popup y muestra la de la sesión', async () => {
    session.refreshUser.mockRejectedValue(new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'Sin conexión con el servidor' }));
    server();
    renderWithProviders(<ProfilePage />);
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo actualizar tu información' });
    expect(popup).toHaveTextContent('Sin conexión con el servidor');
    expect(screen.getByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
  });

  it('sin sesión (al cerrarla) no dibuja nada', () => {
    session.user = null;
    server();
    const { container } = renderWithProviders(<ProfilePage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('al cambiar la contraseña, la lista de sesiones se vuelve a pedir (las demás se cerraron)', async () => {
    const { calls } = server();
    renderWithProviders(<ProfilePage />);
    await screen.findByText('Este dispositivo');
    expect(sessionLoads(calls)).toBe(1);
    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'Actual1234');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Nueva12345');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Nueva12345');
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Cambiar tu contraseña?' })).getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByRole('dialog', { name: 'Contraseña actualizada' })).toHaveTextContent('Se cerró la sesión en 2 dispositivo(s) más.');
    await waitFor(() => expect(sessionLoads(calls)).toBe(2));
  });

  it('"Cerrar sesión" pide confirmación: seguir aquí no sale; confirmar cierra la sesión', async () => {
    server();
    renderWithProviders(<ProfilePage />);
    const footerLogout = screen.getByRole('button', { name: 'Cerrar sesión' });
    await userEvent.click(footerLogout);
    const ask = await screen.findByRole('alertdialog', { name: '¿Estás seguro de que deseas cerrar sesión?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Seguir aquí' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(session.logout).not.toHaveBeenCalled();

    await userEvent.click(footerLogout);
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(session.logout).toHaveBeenCalledOnce());
  });
});
