import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../hooks/useAuth';
import { resolveLazy } from '../i18n';
import { currentAccessToken, renewAccessToken } from '../services/apiClient';
import { authService } from '../services/authService';
import { apiFail, apiOk, envelope, jsonResponse, type MockCall, mockFetch, testSession } from '../test/http';
import { sampleUser, tokenResponse } from '../test/render';
import { AuthProvider } from './AuthContext';

/**
 * Casos límite de la sesión: errores que no vienen de la API al iniciar sesión, retos sin datos,
 * renovaciones que fallan sin motivo, respuestas que llegan después de cerrar la sesión y la
 * restauración interrumpida al salir de la app.
 */
const deviceKey = vi.hoisted(() => ({ deviceProof: vi.fn() }));
vi.mock('../utils/deviceKey', async (importOriginal) => ({ ...(await importOriginal<object>()), deviceProof: deviceKey.deviceProof }));

const Providers = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const renderAuth = () => renderHook(() => useAuth(), { wrapper: Providers });

/** Servidor por ruta (la última parte de la URL); lo no previsto responde 404. */
const serve = (routes: Record<string, (call: MockCall) => Response | Promise<Response>>) =>
  mockFetch((call) => {
    const path = Object.keys(routes).find((key) => call.url.endsWith(key));
    return path ? routes[path](call) : apiFail(404, 'NOT_FOUND');
  });

afterEach(() => vi.useRealTimers());

describe('AuthProvider: inicio de sesión', () => {
  it('un error inesperado (no de la API) sube tal cual sin pedir pruebas del dispositivo', async () => {
    const crash = new TypeError('Fallo inesperado');
    vi.spyOn(authService, 'login').mockRejectedValue(crash);
    const { result } = renderAuth();
    await expect(act(() => result.current.login('ana@empresa.com', 'Clave123'))).rejects.toBe(crash);
    expect(deviceKey.deviceProof).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('reto del dispositivo sin nonce: firma un reto vacío (el backend lo rechazará con su mensaje)', async () => {
    const proof = { public_key: 'PUB', nonce: '', signature: 'FIRMA', name: 'Chrome' };
    deviceKey.deviceProof.mockResolvedValue(proof);
    const challenge = jsonResponse(envelope(null, { status: 403, code: 'DEVICE_PROOF_REQUIRED', message: 'Verificando' }), 403);
    const answers = [challenge, apiOk(tokenResponse())];
    const { calls } = serve({ '/auth/login': () => answers.shift() ?? apiFail(500, 'EXTRA') });
    const { result } = renderAuth();
    await act(() => result.current.login('ana@empresa.com', 'Clave123'));
    expect(deviceKey.deviceProof).toHaveBeenCalledWith('', expect.any(String));
    expect(JSON.parse(calls[1].init.body as string)).toMatchObject({ device: proof });
    expect(result.current.isAuthenticated).toBe(true);
  });
});

describe('AuthProvider: renovación y restauración', () => {
  it('sin sesión no hay token para las peticiones', () => {
    mockFetch(apiFail(500, 'NO_DEBE_LLAMARSE'));
    renderAuth();
    expect(currentAccessToken()).toBeNull();
  });

  it('renovación pedida por el canal en vivo con la cookie ya inválida (401): vuelve al login con el aviso de sesión expirada', async () => {
    serve({ '/auth/login': () => apiOk(tokenResponse()), '/auth/refresh': () => apiFail(401, 'SESSION_EXPIRED') });
    const { result } = renderAuth();
    await act(() => result.current.login('ana@empresa.com', 'Clave123'));
    await act(async () => {
      await expect(renewAccessToken()).resolves.toBe(false);
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(resolveLazy(result.current.logoutReason ?? '')).toBe('Tu sesión expiró. Inicia sesión de nuevo.');
  });

  it('una renovación que falla sin motivo no se toma como éxito: queda anónimo', async () => {
    testSession.signedIn = true;
    vi.spyOn(authService, 'refresh').mockRejectedValue(undefined);
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(result.current.user).toBeNull();
  });

  it('al salir de la app mientras espera para reintentar la restauración, ya no vuelve a intentar', async () => {
    vi.useFakeTimers();
    testSession.signedIn = true;
    const { calls } = serve({ '/auth/refresh': () => apiFail(503, 'SERVICE_UNAVAILABLE') });
    const { unmount } = renderAuth();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(calls).toHaveLength(1);
    unmount();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls).toHaveLength(1);
  });
});

describe('AuthProvider: datos del usuario sin sesión', () => {
  it('actualizar el usuario sin sesión no consulta al servidor', async () => {
    const { calls } = mockFetch(apiOk(sampleUser));
    const { result } = renderAuth();
    await act(() => result.current.refreshUser());
    expect(calls).toHaveLength(0);
    expect(result.current.user).toBeNull();
  });

  it('la empresa elegida que llega después de cerrar la sesión no la vuelve a abrir', async () => {
    let answer: (response: Response) => void = () => undefined;
    serve({
      '/auth/login': () => apiOk(tokenResponse()),
      '/auth/logout': () => apiOk(null),
      '/auth/company': () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    const { result } = renderAuth();
    await act(() => result.current.login('ana@empresa.com', 'Clave123'));
    let selected: Promise<unknown> = Promise.resolve();
    act(() => {
      selected = result.current.selectCompany(2);
    });
    await act(() => result.current.logout());
    await act(async () => {
      answer(apiOk(sampleUser));
      await selected;
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
