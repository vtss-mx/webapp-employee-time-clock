import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { useAuth } from '../hooks/useAuth';
import { setLocale } from '../i18n/core';
import { ApiError, apiRequest, MFA_ENROLLMENT_REQUIRED } from '../services/apiClient';
import { apiOk, envelope, jsonResponse, mockFetch } from '../test/http';
import { tokenResponse } from '../test/render';
import { isHandledGlobally } from '../utils/errorPresentation';
import { MfaGate } from './MfaGate';
import { paths } from './paths';

const MESSAGE = 'Tu cuenta necesita una llave de acceso. Registra una en tu perfil para continuar.';

function required(): Response {
  const error = { code: MFA_ENROLLMENT_REQUIRED, message: MESSAGE, field: null, details: null };
  return jsonResponse(envelope(null, { status: 403, code: MFA_ENROLLMENT_REQUIRED, message: MESSAGE, errors: [error] }), 403);
}

// El hook queda fuera de la compuerta para seguir montado mientras se muestra la pantalla.
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/admin/dashboard']}>
    <FeedbackProvider>
      <AuthProvider>
        {children}
        <MfaGate>
          <Routes>
            <Route path={paths.profilePasskeyNew} element={<p>Registrar llave</p>} />
            <Route path="*" element={<p>La app</p>} />
          </Routes>
        </MfaGate>
      </AuthProvider>
    </FeedbackProvider>
  </MemoryRouter>
);

describe('MfaGate (segundo factor con la gracia vencida)', () => {
  it('un 403 en cualquier pantalla deja de mostrar la app y ofrece registrar la llave, no reintentar', async () => {
    mockFetch((call) => (call.url.endsWith('/auth/login') ? apiOk(tokenResponse()) : required()));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('root@vtss.mx', 'Clave12345678'));
    expect(screen.getByText('La app')).toBeInTheDocument();

    await act(() => apiRequest('/admin/stats').catch(() => undefined));
    const gate = screen.getByRole('alert');
    expect(gate).toHaveTextContent('Segundo factor');
    expect(screen.getByRole('heading', { name: 'Registra tu llave de acceso' })).toBeInTheDocument();
    expect(gate).toHaveTextContent(MESSAGE);
    expect(gate).toHaveTextContent('Tu sesión sigue abierta: al registrarla, todo vuelve a funcionar.');
    expect(screen.queryByText('La app')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    // La sesión NO se cierra: la persona queda dentro, sin poder operar hasta cumplir.
    expect(result.current.isAuthenticated).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Registrar llave de acceso' }));
    expect(await screen.findByText('Registrar llave')).toBeInTheDocument();
    await waitFor(() => expect(result.current.mfaEnrollment).toBeNull());
  });

  it('la ruta de registrar la llave pasa SIEMPRE, aunque el 403 llegue estando en ella', async () => {
    mockFetch((call) => (call.url.endsWith('/auth/login') ? apiOk(tokenResponse()) : required()));
    const passkeyRoute = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[paths.profilePasskeyNew]}>
        <FeedbackProvider>
          <AuthProvider>
            {children}
            <MfaGate>
              <Routes>
                <Route path={paths.profilePasskeyNew} element={<p>Registrar llave</p>} />
              </Routes>
            </MfaGate>
          </AuthProvider>
        </FeedbackProvider>
      </MemoryRouter>
    );
    const { result } = renderHook(() => useAuth(), { wrapper: passkeyRoute });
    await act(() => result.current.login('root@vtss.mx', 'Clave12345678'));
    await act(() => apiRequest('/admin/stats').catch(() => undefined));
    expect(result.current.mfaEnrollment).not.toBeNull();
    expect(screen.getByText('Registrar llave')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('al cerrar la sesión la compuerta se limpia: nada de la persona queda en la página', async () => {
    mockFetch((call) => (call.url.endsWith('/auth/login') ? apiOk(tokenResponse()) : call.url.endsWith('/auth/logout') ? apiOk(null) : required()));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('root@vtss.mx', 'Clave12345678'));
    await act(() => apiRequest('/admin/stats').catch(() => undefined));
    expect(result.current.mfaEnrollment).not.toBeNull();
    await act(() => result.current.logout());
    expect(result.current.mfaEnrollment).toBeNull();
  });

  it('las pantallas no repiten el error: lo presenta la app completa', () => {
    expect(isHandledGlobally(new ApiError({ statusCode: 403, code: MFA_ENROLLMENT_REQUIRED, message: MESSAGE }))).toBe(true);
    // Otro estado con el mismo código no es esta regla.
    expect(isHandledGlobally(new ApiError({ statusCode: 422, code: MFA_ENROLLMENT_REQUIRED, message: MESSAGE }))).toBe(false);
  });

  it('en inglés, la pantalla completa sigue al idioma activo', async () => {
    mockFetch((call) => (call.url.endsWith('/auth/login') ? apiOk(tokenResponse()) : required()));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('root@vtss.mx', 'Clave12345678'));
    await act(() => apiRequest('/admin/stats').catch(() => undefined));
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('heading', { name: 'Register your passkey' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register passkey' })).toBeInTheDocument();
  });
});
