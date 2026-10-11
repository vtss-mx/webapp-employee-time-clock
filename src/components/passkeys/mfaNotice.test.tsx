import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../context/AuthContext';
import { setLocale } from '../../i18n/core';
import { renderWithProviders, sampleUser } from '../../test/render';
import type { User } from '../../types';
import { MfaNotice, graceDaysLeft } from './MfaNotice';

const NOW = Date.parse('2026-10-06T12:00:00Z');

function session(user: Partial<User>): AuthContextValue {
  return {
    user: { ...sampleUser, ...user },
    status: 'authenticated',
    isAuthenticated: true,
    logoutReason: null,
    deviceBlock: null,
    dismissDeviceBlock: vi.fn(),
    suspension: null,
    dismissSuspension: vi.fn(),
    mfaEnrollment: null,
    dismissMfaEnrollment: vi.fn(),
    login: vi.fn(),
    loginWithPasskey: vi.fn(),
    logout: vi.fn(),
    logoutEverywhere: vi.fn(),
    refreshUser: vi.fn(),
    selectCompany: vi.fn(),
    updatePreferences: vi.fn(),
    updateAvatar: vi.fn(),
  } as unknown as AuthContextValue;
}

const render = (user: Partial<User>) =>
  renderWithProviders(
    <AuthContext.Provider value={session(user)}>
      <MfaNotice />
    </AuthContext.Provider>,
  );

describe('días que quedan para registrar la llave de acceso', () => {
  it('se cuentan en días completos hacia arriba; sin fecha o ya vencido, 0', () => {
    expect(graceDaysLeft('2026-10-20T12:00:00Z', NOW)).toBe(14);
    // 30 horas son «2 días», nunca «1»: nadie pierde medio día de plazo por un redondeo.
    expect(graceDaysLeft('2026-10-07T18:00:00Z', NOW)).toBe(2);
    expect(graceDaysLeft('2026-10-06T12:00:00Z', NOW)).toBe(0);
    expect(graceDaysLeft('2026-10-05T12:00:00Z', NOW)).toBe(0);
    expect(graceDaysLeft(null, NOW)).toBe(0);
    expect(graceDaysLeft(undefined, NOW)).toBe(0);
    expect(graceDaysLeft('no es una fecha', NOW)).toBe(0);
  });
});

describe('MfaNotice (aviso del segundo factor obligatorio)', () => {
  it('sin la marca del servidor no se muestra: la app no lo deduce del rol', () => {
    const { container } = render({ role: 'ADMIN', mfa_pending: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('con plazo, insiste con los días que quedan y lleva a registrar la llave', () => {
    const until = new Date(Date.now() + 3 * 86_400_000).toISOString();
    render({ mfa_pending: true, mfa_grace_until: until });
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Tu cuenta necesita una llave de acceso');
    expect(notice).toHaveTextContent('Te quedan 3 días para registrarla.');
    expect(notice).not.toHaveClass('mfa-notice--expired');
    expect(screen.getByRole('link', { name: 'Registrar llave' })).toHaveAttribute('href', '/profile/passkeys/new');
  });

  it('con un día, en singular; con el plazo vencido, dice que ninguna pantalla responde', () => {
    const { unmount } = render({ mfa_pending: true, mfa_grace_until: new Date(Date.now() + 3_600_000).toISOString() });
    expect(screen.getByRole('status')).toHaveTextContent('Te queda 1 día para registrarla.');
    unmount();
    render({ mfa_pending: true, mfa_grace_until: null });
    const expired = screen.getByRole('status');
    expect(expired).toHaveClass('mfa-notice--expired');
    expect(expired).toHaveTextContent('Registra tu llave de acceso para continuar');
    expect(expired).toHaveTextContent('El plazo venció: ninguna pantalla responde hasta que la registres.');
  });

  it('la variante de sección existe para Mi perfil (junto a sus llaves)', () => {
    renderWithProviders(
      <AuthContext.Provider value={session({ mfa_pending: true, mfa_grace_until: null })}>
        <MfaNotice variant="section" />
      </AuthContext.Provider>,
    );
    expect(screen.getByRole('status')).toHaveClass('mfa-notice--section');
  });

  it('en inglés, el aviso sigue al idioma activo', async () => {
    await setLocale('en-US');
    render({ mfa_pending: true, mfa_grace_until: new Date(Date.now() + 2 * 86_400_000).toISOString() });
    expect(screen.getByRole('status')).toHaveTextContent('Your account needs a passkey');
    expect(screen.getByRole('status')).toHaveTextContent('You have 2 days left to register it.');
  });
});
