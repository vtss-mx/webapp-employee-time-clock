import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { useDynamicQr } from './useDynamicQr';

const qr = (id: number, lifetime = 30) => ({ id, employee_number: 'EMP-7', created_at: 'x', expires_at: 'y', lifetime_seconds: lifetime, content: `TCQR2:token-${id}` });

/** Servidor de prueba: cada POST emite el siguiente código; el estado de cada uno se cambia en `statuses`. */
function server(statuses: Record<number, string> = {}) {
  let next = 0;
  return mockFetch((call) => {
    if (call.init.method === 'POST') {
      next += 1;
      return apiOk(qr(next));
    }
    const id = Number(call.url.split('/').pop());
    return apiOk({ id, status: statuses[id] ?? 'ACTIVE', expires_at: null, used_at: null });
  });
}

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const issued = (calls: { init: RequestInit }[]) => calls.filter((c) => c.init.method === 'POST').length;

let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5); // consultas sin variación aleatoria
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useDynamicQr', () => {
  it('pide un código al abrir, lo renueva al vencer y muestra otro en cuanto se usa', async () => {
    const statuses: Record<number, string> = {};
    const { calls } = server(statuses);
    const { result } = renderHook(() => useDynamicQr());
    await tick(0);
    expect(result.current.phase).toBe('ready');
    expect(result.current.qr?.id).toBe(1);
    expect(result.current.deadline - Date.now()).toBe(30_000); // vence con la vigencia, en el reloj del teléfono

    await tick(15_000);
    expect(result.current.qr?.id).toBe(1);
    await tick(15_000); // venció: otro
    expect(result.current.qr?.id).toBe(2);

    statuses[2] = 'USED';
    await tick(3_000); // la consulta lo ve usado
    expect(result.current.phase).toBe('used');
    await tick(1_800); // "Código usado" y el siguiente
    expect(result.current).toMatchObject({ phase: 'ready' });
    expect(result.current.qr?.id).toBe(3);
    expect(issued(calls)).toBe(3);
  });

  it('reemplazado en otro dispositivo o por la empresa: no pide otro solo; sí bajo demanda', async () => {
    const { calls } = server({ 1: 'REVOKED' });
    const { result } = renderHook(() => useDynamicQr());
    await tick(0);
    await tick(3_000);
    expect(result.current.phase).toBe('replaced');
    await tick(60_000);
    expect(issued(calls)).toBe(1); // sin reemplazos en cadena entre dos teléfonos
    await act(() => result.current.renew());
    expect(result.current.qr?.id).toBe(2);
  });

  it('con la pantalla oculta se pausa al vencer y se renueva al volver', async () => {
    const { calls } = server();
    const { result } = renderHook(() => useDynamicQr());
    await tick(0);
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await tick(31_000);
    expect(result.current.phase).toBe('paused');
    expect(issued(calls)).toBe(1);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await tick(0);
    expect(result.current.phase).toBe('ready');
    expect(result.current.qr?.id).toBe(2);
  });

  it('informa si no se pudo generar', async () => {
    mockFetch(apiFail(403, 'QR_DISABLED', 'QR deshabilitado'));
    const { result } = renderHook(() => useDynamicQr());
    await tick(0);
    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBeTruthy();
  });

  it('mantiene la pantalla encendida mientras se muestra', async () => {
    server();
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    const { unmount } = renderHook(() => useDynamicQr());
    await tick(0);
    expect(request).toHaveBeenCalledWith('screen');
    unmount();
    expect(release).toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('pedir otro mientras se genera uno no duplica la petición', async () => {
    const { calls } = server();
    const { result } = renderHook(() => useDynamicQr());
    await act(() => result.current.renew()); // la del inicio sigue en curso
    await tick(0);
    expect(issued(calls)).toBe(1);
    expect(result.current.qr?.id).toBe(1);
  });

  it('al salir mientras se genera (o falla) no actualiza la pantalla', async () => {
    server();
    const ok = renderHook(() => useDynamicQr());
    ok.unmount();
    await tick(0);
    expect(ok.result.current).toMatchObject({ phase: 'loading', qr: null });

    mockFetch(apiFail(503, 'SERVER_BUSY', 'Ocupado'));
    const failing = renderHook(() => useDynamicQr());
    failing.unmount();
    await tick(0);
    expect(failing.result.current).toMatchObject({ phase: 'loading', error: null });
  });

  /** Servidor cuya respuesta de estado ("ya lo usaron") llega cuando la prueba la libera. */
  function slowStatusServer(lifetime = 30) {
    let next = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { calls } = mockFetch(async (call) => {
      if (call.init.method === 'POST') return apiOk(qr(++next, lifetime));
      await gate;
      return apiOk({ id: Number(call.url.split('/').pop()), status: 'USED', expires_at: null, used_at: null });
    });
    return { calls, release: () => act(() => Promise.resolve().then(() => release())) };
  }

  it('la respuesta de un código que ya se reemplazó no afecta al nuevo', async () => {
    const { release } = slowStatusServer();
    const { result } = renderHook(() => useDynamicQr());
    await tick(0);
    await tick(3_000); // consulta el código 1 (lenta)
    await act(() => result.current.renew());
    expect(result.current.qr?.id).toBe(2);
    await release(); // "el 1 ya se usó": llega tarde
    expect(result.current.phase).toBe('ready');
    expect(result.current.qr?.id).toBe(2);
  });

  it('si mientras se consultaba el código se pausó (pantalla oculta) o se salió, la respuesta se ignora', async () => {
    const paused = slowStatusServer(4);
    const view = renderHook(() => useDynamicQr());
    await tick(0);
    await tick(3_000); // consulta en curso
    visibility = 'hidden';
    await tick(1_000); // vence con la pantalla oculta
    expect(view.result.current.phase).toBe('paused');
    await paused.release();
    expect(view.result.current.phase).toBe('paused');

    const left = slowStatusServer();
    const other = renderHook(() => useDynamicQr());
    visibility = 'visible';
    await tick(0);
    await tick(3_000);
    other.unmount();
    await left.release();
    expect(other.result.current.phase).toBe('ready');
  });

  describe('pantalla encendida (Wake Lock)', () => {
    afterEach(() => Reflect.deleteProperty(navigator, 'wakeLock'));
    const install = (request: () => Promise<unknown>) => Object.defineProperty(navigator, 'wakeLock', { value: { request: vi.fn(request) }, configurable: true });

    it('con la pantalla oculta espera a que vuelva para pedirlo', async () => {
      server();
      const release = vi.fn(() => Promise.resolve());
      install(() => Promise.resolve({ release }));
      visibility = 'hidden';
      renderHook(() => useDynamicQr());
      await tick(0);
      expect(navigator.wakeLock.request).not.toHaveBeenCalled();
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    });

    it('si se sale antes de obtenerlo, se suelta en cuanto llega', async () => {
      server();
      const release = vi.fn(() => Promise.resolve());
      install(() => Promise.resolve({ release }));
      const { unmount } = renderHook(() => useDynamicQr());
      unmount();
      await tick(0);
      expect(release).toHaveBeenCalledOnce();
    });

    it('batería baja o sin permiso: el código se muestra igual', async () => {
      server();
      install(() => Promise.reject(new DOMException('Batería baja', 'NotAllowedError')));
      const { result } = renderHook(() => useDynamicQr());
      await tick(0);
      expect(result.current.phase).toBe('ready');
    });
  });
});
