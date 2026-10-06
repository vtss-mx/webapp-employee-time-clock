import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { renderWithProviders, sampleUser } from '../../test/render';
import { withScreens } from '../../test/screens';
import type { User } from '../../types';
import { useConfirmLogout } from './logoutConfirm';

const auth = { user: null as User | null, logout: vi.fn(() => Promise.resolve()), logoutEverywhere: vi.fn(() => Promise.resolve()) };
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));

function LogoutButton() {
  const confirmLogout = useConfirmLogout();
  return (
    <button type="button" onClick={() => void confirmLogout()}>
      salir
    </button>
  );
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

async function open(user: User) {
  auth.user = user;
  renderWithProviders(<LogoutButton />);
  await userEvent.click(screen.getByRole('button', { name: 'salir' }));
  return screen.getByRole('alertdialog', { name: '¿Cerrar sesión?' });
}

beforeEach(() => {
  auth.logout.mockClear();
  auth.logoutEverywhere.mockClear();
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE);
});

describe('confirmación de cierre de sesión', () => {
  it('muestra la cuenta, este dispositivo y qué implica salir; "Seguir aquí" no cierra nada', async () => {
    const employee = { ...sampleUser, last_login_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), company: { id: 1, name: 'Mi empresa', active: true } };
    const dialog = await open(employee);
    expect(within(dialog).getByText('Ana Ruiz')).toBeInTheDocument();
    expect(within(dialog).getByText('ana@empresa.com')).toBeInTheDocument();
    expect(within(dialog).getByText('Empleado · Mi empresa')).toBeInTheDocument(); // nombre del rol: catálogo
    expect(within(dialog).getByText('Safari · iOS')).toBeInTheDocument();
    expect(within(dialog).getByText('hace 2 horas')).toBeInTheDocument();
    expect(within(dialog).getByText(/Deberás iniciar sesión de nuevo para identificarte o mostrar tu código QR/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Seguir aquí' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(auth.logout).not.toHaveBeenCalled();
    expect(auth.logoutEverywhere).not.toHaveBeenCalled();
  });

  it('"Cerrar sesión" cierra solo este dispositivo', async () => {
    const dialog = await open(withScreens({ ...sampleUser, role: 'VALIDATOR', employee: null, email: 'recepcion@empresa.com' }));
    expect(within(dialog).getByText(/punto de control dejará de identificar al personal/)).toBeInTheDocument();
    expect(within(dialog).getAllByText('recepcion@empresa.com')).toHaveLength(1); // sin nombre: el correo una sola vez
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1));
    expect(auth.logoutEverywhere).not.toHaveBeenCalled();
  });

  it('"Salir de todos mis dispositivos" cierra todas; si falla lo explica', async () => {
    let dialog = await open(withScreens({ ...sampleUser, role: 'COMPANY', employee: null }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salir de todos mis dispositivos' }));
    await waitFor(() => expect(auth.logoutEverywhere).toHaveBeenCalledTimes(1));
    expect(auth.logout).not.toHaveBeenCalled();

    auth.logoutEverywhere.mockImplementationOnce(() => Promise.reject(new Error('Sin conexión')));
    await userEvent.click(screen.getByRole('button', { name: 'salir' }));
    dialog = screen.getByRole('alertdialog', { name: '¿Cerrar sesión?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salir de todos mis dispositivos' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cerrar sesión en todos los dispositivos' })).toBeInTheDocument();
  });

  it('con el popup abierto, un cambio de idioma lo traduce (la consecuencia del rol, la tarjeta y los botones)', async () => {
    const dialog = await open({ ...sampleUser, last_login_at: new Date(Date.now() - 2 * 3_600_000).toISOString() });
    expect(dialog).toHaveTextContent('hace 2 horas');
    await act(() => setLocale('en-US'));
    const english = screen.getByRole('alertdialog', { name: 'Sign out?' });
    expect(english).toHaveTextContent("You'll need to sign in again to identify yourself or show your QR code.");
    expect(within(english).getByText('This device')).toBeInTheDocument();
    expect(within(english).getByText('Last sign-in')).toBeInTheDocument();
    expect(within(english).getByText('2 hours ago')).toBeInTheDocument();
    await userEvent.click(within(english).getByRole('button', { name: 'Sign out of all my devices' }));
    await waitFor(() => expect(auth.logoutEverywhere).toHaveBeenCalledTimes(1));
  });

  it('sin usuario (la sesión ya se cerró por otro lado) no pide confirmación ni cierra nada', async () => {
    auth.user = null;
    renderWithProviders(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: 'salir' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
