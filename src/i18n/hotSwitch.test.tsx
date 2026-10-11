import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from '../pages/ProfilePage';
import * as versionService from '../services/versionService';
import { apiOk, mockFetch, type MockCall } from '../test/http';
import { renderWithProviders, sampleUser } from '../test/render';
import type { User, UserPreferences } from '../types';
import { deviceStore } from '../utils/deviceStore';
import { currentLocale, setLocale } from './core';

/**
 * Cambio de idioma EN CALIENTE (regla 16) sobre una pantalla real (Mi perfil): con el formulario de la
 * contraseña lleno y con una confirmación y un aviso abiertos, el idioma cambia al instante en toda la
 * pantalla, nada se reinicia (los mismos campos con lo escrito, el mismo popup abierto, nada enviado
 * de más) y la página nunca se recarga.
 */
const session = vi.hoisted(() => ({
  user: null as User | null,
  isAuthenticated: true,
  refreshUser: vi.fn<() => Promise<void>>(),
  logout: vi.fn<() => Promise<void>>(),
  logoutEverywhere: vi.fn<() => Promise<void>>(),
  updatePreferences: vi.fn<(changes: Partial<UserPreferences>) => Promise<void>>(),
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => session }));

const sessions = { items: [], total: 0, page: 1, size: 10 };
const passwordChanges = (calls: MockCall[]) => calls.filter((call) => call.url.includes('/auth/change-password'));

beforeEach(() => {
  session.user = sampleUser;
  session.refreshUser.mockResolvedValue(undefined);
  session.updatePreferences.mockResolvedValue(undefined);
  vi.spyOn(deviceStore, 'set').mockResolvedValue();
});

describe('cambio de idioma en caliente', () => {
  it('formulario lleno y popups abiertos: se traduce todo sin reiniciar nada ni recargar la página', async () => {
    const reload = vi.spyOn(versionService, 'reloadApp'); // la única recarga de la app (versión nueva)
    const { calls } = mockFetch((call) => (call.url.includes('/auth/change-password') ? apiOk({ revoked_sessions: 2 }) : apiOk(sessions)));
    renderWithProviders(<ProfilePage />);
    expect(screen.getByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();

    // 1) Formulario lleno.
    const current = screen.getByLabelText('Contraseña actual');
    const next = screen.getByLabelText('Nueva contraseña');
    const confirm = screen.getByLabelText('Confirmar nueva contraseña');
    await userEvent.type(current, 'Anterior12345');
    await userEvent.type(next, 'Nueva1234567');
    await userEvent.type(confirm, 'Nueva1234567');

    // 2) Cambia el idioma con el selector de la pantalla.
    const language = screen.getByRole('heading', { name: 'Idioma' }).closest('section') as HTMLElement;
    await userEvent.click(within(language).getByRole('button', { name: /Idioma/ }));
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /English/ }));
    expect(await screen.findByRole('heading', { name: 'My profile' })).toBeInTheDocument();
    expect(currentLocale()).toBe('en-US');
    expect(session.updatePreferences).toHaveBeenCalledWith({ locale: 'en-US' });
    // Los mismos campos (no se volvieron a montar), con su etiqueta nueva y lo escrito intacto.
    expect(screen.getByLabelText('Current password')).toBe(current);
    expect(current).toHaveValue('Anterior12345');
    expect(next).toHaveValue('Nueva1234567');
    expect(confirm).toHaveValue('Nueva1234567');

    // 3) Confirmación abierta: cambia de idioma sin cerrarse y sin enviar nada.
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    const dialog = await screen.findByRole('alertdialog'); // tono de advertencia
    expect(dialog).toHaveTextContent('Change your password?');
    await act(() => setLocale('es-MX'));
    expect(screen.getByRole('alertdialog')).toBe(dialog);
    expect(dialog).toHaveTextContent('¿Cambiar tu contraseña?');
    expect(screen.getByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
    expect(current).toHaveValue('Anterior12345'); // detrás del popup, el formulario sigue lleno
    expect(passwordChanges(calls)).toHaveLength(0);

    // 4) Se confirma: se envía una sola vez; el aviso de éxito abierto también sigue al idioma.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cambiar contraseña' }));
    const notice = await screen.findByRole('dialog', { name: 'Contraseña actualizada' });
    expect(notice).toHaveTextContent('Se cerró la sesión en 2 dispositivos más.');
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('dialog', { name: 'Password updated' })).toBe(notice);
    expect(notice).toHaveTextContent('You were signed out of 2 other devices.');
    expect(passwordChanges(calls)).toHaveLength(1);

    expect(reload).not.toHaveBeenCalled();
  });

  it('las fechas y horas de la pantalla abierta cambian de formato al instante', async () => {
    session.user = { ...sampleUser, last_login_at: '2026-10-02T19:55:00Z' };
    mockFetch(apiOk(sessions));
    renderWithProviders(<ProfilePage />);
    const lastLogin = screen.getByText('Último inicio de sesión').nextElementSibling as HTMLElement;
    expect(lastLogin).toHaveTextContent(/2 oct 2026, 1:55\sp\.\s?m\./);
    await act(() => setLocale('en-US'));
    await waitFor(() => expect(lastLogin).toHaveTextContent(/Oct 2, 2026, 1:55\sPM/));
    expect(screen.getByText('Last sign-in').nextElementSibling).toBe(lastLogin);
  });
});
