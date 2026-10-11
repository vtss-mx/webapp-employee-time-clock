import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentLocale, setLocale } from '../i18n/core';
import { ApiError } from '../services/apiClient';
import { consentList, grantedConsent } from '../test/consents';
import { apiOk, mockFetch, type MockCall } from '../test/http';
import { renderWithProviders, sampleUser } from '../test/render';
import { withScreens } from '../test/screens';
import type { User, UserPreferences } from '../types';
import { deviceStore } from '../utils/deviceStore';
import { ProfilePage } from './ProfilePage';

const session = vi.hoisted(() => ({
  user: null as User | null,
  refreshUser: vi.fn<() => Promise<void>>(),
  logout: vi.fn<() => Promise<void>>(),
  logoutEverywhere: vi.fn<() => Promise<void>>(),
  isAuthenticated: true,
  updatePreferences: vi.fn<(changes: Partial<UserPreferences>) => Promise<void>>(),
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
/** Mis dispositivos (antifraude 1b): desde dónde checa el empleado (solo lectura). */
const myDevices = {
  items: [{ id: 3, name: 'iPhone · Safari', status: 'APPROVED', first_seen_at: '2026-10-01T15:00:00Z', last_seen_at: '2026-10-02T15:00:00Z', uses: 4, stepped_up_at: null, reviewed_at: null, reviewed_by: null }],
  total: 1,
  page: 1,
  size: 10,
};
function server() {
  return mockFetch((call: MockCall) => {
    if (call.url.includes('/auth/change-password')) return apiOk({ revoked_sessions: 2 });
    // Datos biométricos: su sección pide el estado de los consentimientos al abrir Mi perfil.
    if (call.url.includes('/me/consents')) return apiOk(consentList([grantedConsent]));
    return apiOk(call.url.includes('/users/me/devices') ? myDevices : deviceSessions);
  });
}
const sessionLoads = (calls: MockCall[]) => calls.filter((c) => c.url.startsWith('/api/auth/sessions')).length;

beforeEach(() => {
  session.user = employeeUser;
  session.refreshUser.mockResolvedValue(undefined);
  session.logout.mockResolvedValue(undefined);
  session.updatePreferences.mockResolvedValue(undefined);
  vi.spyOn(deviceStore, 'set').mockResolvedValue();
});

describe('ProfilePage (Mi perfil)', () => {
  it('empleado: cuenta, rol, estado de su rostro y sus datos; relee el usuario al entrar', async () => {
    server();
    renderWithProviders(<ProfilePage />);
    expect(screen.getByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.getAllByText('AR')).toHaveLength(2); // la cuenta y su foto de perfil (sin foto: iniciales)
    expect(screen.getByText('Empleado')).toBeInTheDocument(); // nombre del rol (catálogo)
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
    expect(screen.getByRole('heading', { name: 'Mis dispositivos' })).toBeInTheDocument();
    expect(await screen.findByText('iPhone · Safari')).toBeInTheDocument();
    const devices = screen.getByRole('heading', { name: 'Mis dispositivos' }).closest('section');
    expect(within(devices as HTMLElement).queryByRole('button', { name: /Revocar/ })).toBeNull(); // los decide su empresa
    // Datos biométricos (regla 22): su consentimiento, con el camino para leerlo y revocarlo.
    expect(screen.getByRole('heading', { name: 'Datos biométricos' })).toBeInTheDocument();
    expect(screen.getByText(/Otorgado el 1 oct 2026/)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('empleado sin número, RFC, CURP ni NSS (opcionales): no los muestra', async () => {
    session.user = { ...sampleUser, employee: sampleUser.employee && { ...sampleUser.employee, employee_number: null, rfc: null, curp: null, nss: null } };
    server();
    renderWithProviders(<ProfilePage />);
    expect(screen.getByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    for (const label of ['Número de empleado', 'CURP', 'RFC', 'NSS']) expect(screen.queryByText(label)).toBeNull();
    expect(screen.getByText('Correo electrónico').nextElementSibling).toHaveTextContent('ana@empresa.com');
    expect(await screen.findByText('Este dispositivo')).toBeInTheDocument();
  });

  it('cuenta sin datos de empleado: su correo como nombre y sin datos del expediente', async () => {
    session.user = companyUser;
    server();
    renderWithProviders(<ProfilePage />);
    expect(screen.getByRole('heading', { name: 'rh@empresa.com' })).toBeInTheDocument();
    expect(screen.getByText('Empresa')).toBeInTheDocument();
    for (const label of ['Número de empleado', 'CURP', 'RFC', 'NSS', 'Teléfono celular']) expect(screen.queryByText(label)).toBeNull();
    expect(screen.queryByText('Validado')).toBeNull();
    await screen.findByText('Este dispositivo');
    expect(screen.queryByRole('heading', { name: 'Mis dispositivos' })).toBeNull(); // sin empleo, sin dispositivos
    expect(screen.queryByRole('heading', { name: 'Datos biométricos' })).toBeNull(); // ni datos biométricos
  });

  it('con una empresa en la sesión ofrece llevarse sus datos (derecho de acceso); sin ella, no', async () => {
    session.user = { ...employeeUser, company: { id: 4, name: 'Panificadora', active: true } };
    server();
    const { unmount } = renderWithProviders(<ProfilePage />);
    expect(await screen.findByRole('heading', { name: 'Mis datos' })).toBeInTheDocument();
    unmount();
    // Una cuenta sin empresa no tiene expediente que exportar (el servidor responde 403 COMPANY_REQUIRED).
    session.user = employeeUser;
    server();
    renderWithProviders(<ProfilePage />);
    await screen.findByText('Este dispositivo');
    expect(screen.queryByRole('heading', { name: 'Mis datos' })).toBeNull();
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
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Nueva1234567');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Nueva1234567');
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Cambiar tu contraseña?' })).getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByRole('dialog', { name: 'Contraseña actualizada' })).toHaveTextContent('Se cerró la sesión en 2 dispositivos más.');
    await waitFor(() => expect(sessionLoads(calls)).toBe(2));
  });

  it('"Cerrar sesión" pide confirmación: seguir aquí no sale; confirmar cierra la sesión', async () => {
    server();
    renderWithProviders(<ProfilePage />);
    const footerLogout = screen.getByRole('button', { name: 'Cerrar sesión' });
    await userEvent.click(footerLogout);
    const ask = await screen.findByRole('alertdialog', { name: '¿Cerrar sesión?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Seguir aquí' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(session.logout).not.toHaveBeenCalled();

    await userEvent.click(footerLogout);
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(session.logout).toHaveBeenCalledOnce());
  });
});

describe('ProfilePage: idioma', () => {
  it('sección "Idioma" con el selector: cambia en caliente, se guarda en la cuenta y la pantalla queda en inglés', async () => {
    server();
    renderWithProviders(<ProfilePage />);
    const section = screen.getByRole('heading', { name: 'Idioma' }).closest('section') as HTMLElement;
    expect(within(section).getByText(/Se aplica en todos tus dispositivos/)).toBeInTheDocument();
    await userEvent.click(within(section).getByRole('button', { name: /Idioma/ }));
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /English/ }));
    await waitFor(() => expect(currentLocale()).toBe('en-US'));
    expect(session.updatePreferences).toHaveBeenCalledWith({ locale: 'en-US' });
    expect(screen.getByRole('heading', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My profile' })).toBeInTheDocument();
  });

  it('en inglés (en-US): encabezado, datos de la cuenta, secciones y cerrar sesión', async () => {
    server();
    await setLocale('en-US');
    renderWithProviders(<ProfilePage />);
    expect(screen.getByText('Your account, password and active sessions')).toBeInTheDocument();
    for (const heading of ['Account', 'Change password', 'Language', 'Active sessions']) expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    for (const label of ['Email', 'Employee number', 'Mobile phone', 'Last sign-in', 'Account created']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(await screen.findByText('This device')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
