import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../hooks/useAuth';
import { resolveLazy } from '../i18n';
import { setLocale } from '../i18n/core';
import { apiRequest } from '../services/apiClient';
import { apiFail, apiOk, mockFetch, testSession } from '../test/http';
import { sampleUser, tokenResponse } from '../test/render';
import { acquireAvatar, avatarCacheSize } from '../utils/avatarCache';
import { AuthProvider } from './AuthContext';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const route = (handlers: Record<string, () => Response>) => (call: { url: string }) => {
  const key = Object.keys(handlers).find((path) => call.url.endsWith(path));
  return key ? handlers[key]() : apiFail(404, 'NOT_FOUND');
};

describe('AuthProvider', () => {
  it('sin sesión en el backend queda anónimo sin intentar renovar (nada guardado en el navegador)', async () => {
    const { calls } = mockFetch(apiFail(500, 'NO_DEBE_LLAMARSE'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe('restoring'); // primero pregunta al backend
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(result.current.isAuthenticated).toBe(false);
    expect(calls).toEqual([]); // ni /auth/refresh: no había cookie de sesión
  });

  it('login guarda el token SOLO en memoria y marca la sesión', async () => {
    const { calls } = mockFetch(route({ '/auth/login': () => apiOk(tokenResponse()), '/users/me': () => apiOk(sampleUser) }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ANA@empresa.com ', 'Clave1234569'));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('ana@empresa.com');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ email: 'ana@empresa.com', password: 'Clave1234569', remember: false });
    expect(localStorage.length + sessionStorage.length).toBe(0); // nada en el navegador: ni token ni indicador

    // El token se inyecta en las peticiones autenticadas.
    await act(() => apiRequest('/users/me'));
    expect((calls[1].init.headers as Record<string, string>).Authorization).toMatch(/^Bearer token-/);
  });

  it('un 403 de una pantalla que dejó de estar disponible refresca al usuario UNA sola vez (el menú se recalcula, sin bucles)', async () => {
    const { calls } = mockFetch(route({ '/auth/login': () => apiOk(tokenResponse()), '/users/me': () => apiOk(sampleUser), '/x': () => apiFail(403, 'QR_DISABLED', 'QR deshabilitado') }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'x'));
    // Dos peticiones que responden lo mismo no encadenan dos refrescos (defensa contra bucles).
    await act(async () => {
      await apiRequest('/x').catch(() => undefined);
      await apiRequest('/x').catch(() => undefined);
    });
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/users/me')).length).toBe(1));
  });

  it('restaura la sesión al recargar usando la cookie (refresh)', async () => {
    testSession.signedIn = true;
    mockFetch(route({ '/auth/refresh': () => apiOk(tokenResponse()) }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe('restoring');
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user?.id).toBe(1);
  });

  it('si la cookie ya no es válida queda anónimo', async () => {
    testSession.signedIn = true;
    mockFetch(route({ '/auth/refresh': () => apiFail(401, 'SESSION_INVALID') }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
  });

  it('falla pasajera al restaurar: reintenta con espera creciente y restaura sin pedir la contraseña', async () => {
    vi.useFakeTimers();
    testSession.signedIn = true;
    let refreshes = 0;
    mockFetch(route({ '/auth/refresh': () => (++refreshes < 3 ? apiFail(503, 'SERVICE_UNAVAILABLE') : apiOk(tokenResponse())) }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(refreshes).toBe(1);
    expect(result.current.status).toBe('restoring'); // la sesión puede seguir viva: no manda al login
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(refreshes).toBe(3);
    expect(result.current.status).toBe('authenticated');
    vi.useRealTimers();
  });

  it('el servidor no responde (ni a la consulta de sesión): intenta renovar con reintentos y queda anónimo', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((_url: string) => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(result.current.status).toBe('anonymous');
    const refreshes = fetch.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'));
    expect(refreshes).toHaveLength(6); // sin saber si hay sesión se intenta: el intento y 5 reintentos, no más
    vi.useRealTimers();
  });

  it('sin conexión: espera a recuperarla antes de volver a intentar', async () => {
    vi.useFakeTimers();
    testSession.signedIn = true;
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let refreshes = 0;
    mockFetch(() => (++refreshes === 1 ? Promise.reject(new TypeError('Failed to fetch')) : apiOk(tokenResponse())));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(refreshes).toBe(1); // sin red no gasta reintentos
    expect(result.current.status).toBe('restoring');
    online.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(refreshes).toBe(2);
    expect(result.current.status).toBe('authenticated');
    vi.useRealTimers();
  });

  it('un error que no se arregla reintentando (403) no se reintenta', async () => {
    testSession.signedIn = true;
    const { calls } = mockFetch(route({ '/auth/refresh': () => apiFail(403, 'FORBIDDEN') }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(calls).toHaveLength(1);
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

  it('la foto de perfil nueva se aplica a la sesión y cerrar sesión libera las fotos que la página tenía', async () => {
    mockFetch(route({ '/auth/login': () => apiOk(tokenResponse()), '/auth/logout': () => apiOk(null) }));
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:foto'), revokeObjectURL: vi.fn() });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => result.current.login('ana@empresa.com', 'x'));
    act(() => result.current.updateAvatar('/users/1/avatar?v=nueva'));
    expect(result.current.user?.avatar).toBe('/users/1/avatar?v=nueva');
    await acquireAvatar('/users/1/avatar?v=nueva&size=96', () => Promise.resolve(new Blob(['x'])));
    await act(() => result.current.logout());
    expect(avatarCacheSize()).toBe(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto');
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
    expect(resolveLazy(result.current.logoutReason ?? '')).toMatch(/expiró/);
    expect(refreshes).toBe(0); // la sesión de 12 h no se extiende
    // El motivo lo pone la app: se traduce al mostrarse (sigue al idioma activo).
    await act(() => setLocale('en-US'));
    expect(resolveLazy(result.current.logoutReason ?? '')).toBe('Your session expired. Sign in again.');
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
    expect(() => renderHook(() => useAuth())).toThrow('AUTH_PROVIDER_MISSING');
  });
});
