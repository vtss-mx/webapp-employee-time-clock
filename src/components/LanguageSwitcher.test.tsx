import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentLocale } from '../i18n/core';
import { ApiError } from '../services/apiClient';
import * as versionService from '../services/versionService';
import { renderWithProviders } from '../test/render';
import type { UserPreferences } from '../types';
import { deviceStore } from '../utils/deviceStore';
import { LanguageSwitcher } from './LanguageSwitcher';
import type * as CoreModule from '../i18n/core';

/**
 * Selector de idioma: cambio EN CALIENTE (sin recargar), guardado en el dispositivo y, con sesión, en
 * la cuenta; si la cuenta no lo guarda, regresa al idioma anterior y lo avisa.
 */
const session = vi.hoisted(() => ({
  isAuthenticated: false,
  updatePreferences: vi.fn<(changes: Partial<UserPreferences>) => Promise<void>>(),
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => session }));

const core = vi.hoisted(() => ({ failNext: false }));
vi.mock('../i18n/core', async (importOriginal) => {
  const real = await importOriginal<typeof CoreModule>();
  return {
    ...real,
    setLocale: (locale: Parameters<typeof real.setLocale>[0]) => {
      if (!core.failNext) return real.setLocale(locale);
      core.failNext = false;
      return Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
    },
  };
});

const trigger = () => screen.getByRole('button', { name: /Idioma|Language/ });

async function choose(name: RegExp) {
  await userEvent.click(trigger());
  await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name }));
}

beforeEach(() => {
  session.isAuthenticated = false;
  session.updatePreferences.mockResolvedValue(undefined);
  vi.spyOn(deviceStore, 'set').mockResolvedValue();
});

describe('LanguageSwitcher', () => {
  it('nombra cada idioma en sí mismo y en el idioma activo; anónimo: cambia al instante y lo recuerda en el dispositivo', async () => {
    const reload = vi.spyOn(versionService, 'reloadApp'); // único lugar de la app que recarga la página
    renderWithProviders(<LanguageSwitcher variant="compact" tone="dark" />);
    expect(trigger()).toHaveAccessibleName(/Idioma.*Español \(México\)/);
    await userEvent.click(trigger());
    const list = screen.getByRole('listbox');
    expect(within(list).getByRole('option', { name: /English \(United States\).*Inglés de Estados Unidos/ })).toBeInTheDocument();
    await userEvent.click(within(list).getByRole('option', { name: /English/ }));

    await waitFor(() => expect(currentLocale()).toBe('en-US'));
    expect(trigger()).toHaveAccessibleName(/Language.*English \(United States\)/);
    expect(deviceStore.set).toHaveBeenCalledWith('locale', 'en-US');
    expect(session.updatePreferences).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('elegir el idioma que ya está activo no hace nada', async () => {
    renderWithProviders(<LanguageSwitcher variant="compact" />);
    await choose(/Español/);
    expect(deviceStore.set).not.toHaveBeenCalled();
    expect(currentLocale()).toBe('es-MX');
  });

  it('con sesión: campo con etiqueta y ayuda; guarda el idioma en la cuenta', async () => {
    session.isAuthenticated = true;
    renderWithProviders(<LanguageSwitcher />);
    expect(screen.getByText('Idioma')).toBeInTheDocument();
    expect(screen.getByText(/Se aplica en todos tus dispositivos/)).toBeInTheDocument();
    await choose(/English/);
    await waitFor(() => expect(session.updatePreferences).toHaveBeenCalledWith({ locale: 'en-US' }));
    expect(currentLocale()).toBe('en-US');
    expect(await screen.findByText(/Applies on all your devices/)).toBeInTheDocument();
  });

  it('anónimo: la ayuda dice que se recuerda en este dispositivo', () => {
    renderWithProviders(<LanguageSwitcher />);
    expect(screen.getByText('Se recuerda en este dispositivo.')).toBeInTheDocument();
  });

  it('si la cuenta no guarda el idioma, regresa al anterior (también en el dispositivo) y lo avisa', async () => {
    session.isAuthenticated = true;
    session.updatePreferences.mockRejectedValue(new ApiError({ statusCode: 503, code: 'SERVICE_UNAVAILABLE', message: 'Servicio no disponible' }));
    renderWithProviders(<LanguageSwitcher />);
    await choose(/English/);
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('No se pudo guardar tu idioma');
    expect(currentLocale()).toBe('es-MX');
    expect(deviceStore.set).toHaveBeenLastCalledWith('locale', 'es-MX');
  });

  it('si el idioma nuevo no se puede descargar, se queda en el actual y lo avisa', async () => {
    core.failNext = true;
    renderWithProviders(<LanguageSwitcher />);
    await choose(/English/);
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('No se pudo cambiar el idioma');
    expect(currentLocale()).toBe('es-MX');
    expect(deviceStore.set).not.toHaveBeenCalled();
  });

  it('si la pantalla se cierra mientras cambia el idioma, no toca su estado', async () => {
    let finish: () => void = () => undefined;
    session.isAuthenticated = true;
    session.updatePreferences.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const { unmount } = renderWithProviders(<LanguageSwitcher />);
    await choose(/English/);
    await waitFor(() => expect(session.updatePreferences).toHaveBeenCalled());
    expect(trigger()).toBeDisabled(); // mientras se guarda
    unmount();
    finish();
    await waitFor(() => expect(currentLocale()).toBe('en-US'));
  });
});
