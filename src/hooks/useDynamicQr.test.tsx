import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { useDynamicQr } from './useDynamicQr';

const qr = (id: number) => ({ id, employee_number: 'EMP-7', created_at: 'x', expires_at: 'y', lifetime_seconds: 30, image_base64: `data:image/png;base64,${id}` });

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
    expect(result.current).toMatchObject({ phase: 'ready', remaining: 30 });
    expect(result.current.qr?.id).toBe(1);
    expect(result.current.progress).toBeCloseTo(1);

    await tick(15_000);
    expect(result.current.remaining).toBe(15);
    await tick(15_000); // venció: otro
    expect(result.current.qr?.id).toBe(2);

    statuses[2] = 'USED';
    await tick(2_000); // la consulta lo ve usado
    expect(result.current.phase).toBe('used');
    await tick(1_800); // "¡Listo!" y el siguiente
    expect(result.current).toMatchObject({ phase: 'ready' });
    expect(result.current.qr?.id).toBe(3);
    expect(issued(calls)).toBe(3);
  });

  it('reemplazado en otro dispositivo o por la empresa: no pide otro solo; sí bajo demanda', async () => {
    const { calls } = server({ 1: 'REVOKED' });
    const { result } = renderHook(() => useDynamicQr());
    await tick(0);
    await tick(2_000);
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
});
