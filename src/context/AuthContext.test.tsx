import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../services/apiClient';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { sampleUser, tokenResponse } from '../test/render';
import { preferenceStore } from '../utils/storage';
import { AuthProvider } from './AuthContext';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const route = (handlers: Record<string, () => Response>) => (call: { url: string }) => {
  const key = Object.keys(handlers).find((path) => call.url.endsWith(path));
  return key ? handlers[key]() : apiFail(404, 'NOT_FOUND');
};

describe('AuthProvider', () => {
  it('inicia anónimo sin indicador de sesión', () => {
    mockFetch(apiFail(500, 'NO_DEBE_LLAMARSE'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe('anonymous');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('login guarda el token SOLO en memoria y marca la sesión', async () => {
    const { calls } = mockFetch(route({ '/auth/login': () => apiOk(tokenResponse()), '/users/me': () => apiOk(sampleUser) }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ANA@empresa.com ', 'Clave123'));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('ana@empresa.com');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ email: 'ana@empresa.com', password: 'Clave123', remember: false });
    expect(preferenceStore.get('tc.signed-in')).toBe('1');
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('token-');

    // El token se inyecta en las peticiones autenticadas.
    await act(() => apiRequest('/users/me'));
    expect((calls[1].init.headers as Record<string, string>).Authorization).toMatch(/^Bearer token-/);
  });

  it('restaura la sesión al recargar usando la cookie (refresh)', async () => {
    preferenceStore.set('tc.signed-in', '1');
    mockFetch(route({ '/auth/refresh': () => apiOk(tokenResponse()) }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe('restoring');
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user?.id).toBe(1);
  });

  it('si la cookie ya no es válida queda anónimo', async () => {
    preferenceStore.set('tc.signed-in', '1');
    mockFetch(route({ '/auth/refresh': () => apiFail(401, 'SESSION_INVALID') }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(preferenceStore.get('tc.signed-in')).toBeNull();
  });

  it('sin red al restaurar: anónimo pero conserva el indicador para reintentar', async () => {
    preferenceStore.set('tc.signed-in', '1');
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(preferenceStore.get('tc.signed-in')).toBe('1');
  });

  it('renueva el token en un 401 TOKEN_EXPIRED y repite la petición', async () => {
    let meCalls = 0;
    mockFetch(
      route({
        '/auth/login': () => apiOk(tokenResponse()),
        '/auth/refresh': () => apiOk(tokenResponse()),
        '/users/me': () => (++meCalls === 1 ? apiFail(401, 'TOKEN_EXPIRED') : apiOk(sampleUser)),
      }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'x'));
    await act(() => result.current.refreshUser());
    expect(meCalls).toBe(2);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('una sesión revocada cierra la sesión con el motivo', async () => {
    mockFetch(route({ '/auth/login': () => apiOk(tokenResponse()), '/users/me': () => apiFail(401, 'SESSION_REVOKED', 'Sesión revocada') }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'x'));
    await act(async () => {
      await result.current.refreshUser().catch(() => undefined);
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.logoutReason).toBe('Sesión revocada');
  });

  it('logout revoca en el servidor y limpia aunque no haya red', async () => {
    const { calls } = mockFetch(route({ '/auth/login': () => apiOk(tokenResponse()), '/auth/logout': () => apiOk(null) }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'x'));
    await act(() => result.current.logout('Adiós'));
    expect(calls.some((c) => c.url.endsWith('/auth/logout'))).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.logoutReason).toBe('Adiós');

    await act(() => result.current.login('ana@empresa.com', 'x'));
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    await act(() => result.current.logout());
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logout en todos los dispositivos: sin aviso en este (el usuario ya lo confirmó)', async () => {
    mockFetch(route({ '/auth/login': () => apiOk(tokenResponse()), '/auth/logout-all': () => apiOk({ revoked: 2 }) }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'x'));
    await act(() => result.current.logoutEverywhere());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.logoutReason).toBeNull();
  });

  it('al vencer la sesión la cierra sola (vuelve al login) sin renovarla', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let refreshes = 0;
    mockFetch(
      route({
        '/auth/login': () => apiOk(tokenResponse(sampleUser, 400)),
        '/auth/refresh': () => {
          refreshes++;
          return apiOk(tokenResponse(sampleUser, 43_200));
        },
      }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'x'));
    await act(() => vi.advanceTimersByTimeAsync(399_000));
    expect(result.current.isAuthenticated).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.logoutReason).toMatch(/expirado/);
    expect(refreshes).toBe(0); // la sesión de 12 h no se extiende
    vi.useRealTimers();
  });

  it('al volver a la pestaña confirma la sesión: si se inició en otro dispositivo, vuelve al login', async () => {
    const replaced = 'Se inició sesión con tu cuenta en otro dispositivo.';
    mockFetch(route({ '/auth/login': () => apiOk(tokenResponse()), '/users/me': () => apiFail(401, 'SESSION_REPLACED', replaced) }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'x'));
    act(() => void window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(result.current.logoutReason).toBe(replaced);
  });

  it('pestaña en segundo plano: al volver con la sesión vencida, cierra al instante', async () => {
    mockFetch(route({ '/auth/login': () => apiOk(tokenResponse(sampleUser, 60)) }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'x'));
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000); // el temporizador quedó en pausa
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('useAuth fuera del provider lanza un error claro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
