import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, sampleUser } from '../test/render';
import type { User } from '../types';
import { deviceStore } from '../utils/deviceStore';
import { currentLocale, setLocale } from './core';
import { LocaleSync } from './LocaleSync';
import type * as CoreModule from './core';

/**
 * El idioma de la cuenta manda al iniciar sesión (y si cambia desde otro dispositivo); cada cambio de
 * idioma con sesión vuelve a pedir el usuario (nombres del menú del backend) sin recargar nada.
 */
const session = vi.hoisted(() => ({ user: null as User | null, refreshUser: vi.fn<() => Promise<void>>() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => session }));

const core = vi.hoisted(() => ({ fail: false }));
vi.mock('./core', async (importOriginal) => {
  const real = await importOriginal<typeof CoreModule>();
  return {
    ...real,
    setLocale: (locale: Parameters<typeof real.setLocale>[0]) =>
      core.fail ? Promise.reject(new TypeError('Failed to fetch dynamically imported module')) : real.setLocale(locale),
  };
});

const withLocale = (locale: unknown): User => ({ ...sampleUser, preferences: { sidebar_collapsed: false, locale } as User['preferences'] });

beforeEach(() => {
  session.user = null;
  core.fail = false;
  session.refreshUser.mockResolvedValue(undefined);
  vi.spyOn(deviceStore, 'set').mockResolvedValue();
});

describe('LocaleSync', () => {
  it('aplica el idioma guardado en la cuenta, lo recuerda en el dispositivo y vuelve a pedir el usuario', async () => {
    session.user = withLocale('en-US');
    renderWithProviders(<LocaleSync />);
    await waitFor(() => expect(currentLocale()).toBe('en-US'));
    await waitFor(() => expect(deviceStore.set).toHaveBeenCalledWith('locale', 'en-US'));
    await waitFor(() => expect(session.refreshUser).toHaveBeenCalledOnce());
  });

  it('sin idioma en la cuenta (o uno desconocido) conserva el del dispositivo y no pide nada', async () => {
    for (const locale of [null, 'fr-FR', 'es-MX']) {
      session.user = withLocale(locale); // 'es-MX': el mismo que ya se ve
      renderWithProviders(<LocaleSync />).unmount();
    }
    await act(() => Promise.resolve());
    expect(currentLocale()).toBe('es-MX');
    expect(session.refreshUser).not.toHaveBeenCalled();
    expect(deviceStore.set).not.toHaveBeenCalled();
  });

  it('un cambio de idioma con sesión vuelve a pedir el usuario; si falla, la pantalla sigue igual', async () => {
    session.user = sampleUser;
    session.refreshUser.mockRejectedValue(new Error('sin red'));
    renderWithProviders(<LocaleSync />);
    await act(() => setLocale('en-US'));
    expect(session.refreshUser).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(); // accesorio: sin popup
  });

  it('sin sesión, cambiar el idioma no pide el usuario', async () => {
    renderWithProviders(<LocaleSync />);
    await act(() => setLocale('en-US'));
    expect(session.refreshUser).not.toHaveBeenCalled();
  });

  it('si el idioma de la cuenta no se puede descargar, lo avisa y sigue en el actual', async () => {
    core.fail = true;
    session.user = withLocale('en-US');
    renderWithProviders(<LocaleSync />);
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('No se pudo cambiar el idioma');
    expect(currentLocale()).toBe('es-MX');
  });
});
