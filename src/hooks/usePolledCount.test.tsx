import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/core';
import { usePolledCount } from './usePolledCount';

const EVENT = 'tc:test-count-changed';
const OPTIONS = { enabled: true, intervalMs: 10_000, changedEvent: EVENT };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5); // sin variación aleatoria
});
afterEach(() => vi.useRealTimers());

const tick = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
const announce = () => act(() => void window.dispatchEvent(new Event(EVENT)));

describe('usePolledCount', () => {
  it('consulta al abrir y periódicamente', async () => {
    let total = 2;
    const load = vi.fn(() => Promise.resolve(total));
    const { result } = renderHook(() => usePolledCount(load, OPTIONS));
    expect(result.current).toBeNull(); // aún no se sabe
    await tick();
    expect(result.current).toBe(2);
    total = 5;
    await tick(10_000);
    expect(result.current).toBe(5);
  });

  it('otra pantalla avisa que cambió: se vuelve a consultar ya; si esa consulta falla se conserva el número', async () => {
    let total = 1;
    const load = vi.fn(() => Promise.resolve(total));
    const { result } = renderHook(() => usePolledCount(load, OPTIONS));
    await tick();
    total = 0;
    announce();
    await tick();
    expect(result.current).toBe(0);
    load.mockRejectedValueOnce(new Error('sin red'));
    announce();
    await tick();
    expect(result.current).toBe(0);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('una respuesta vieja que llega tarde no regresa el número a un valor anterior', async () => {
    let releaseOld: (value: number) => void = () => undefined;
    const load = vi
      .fn<() => Promise<number>>()
      .mockReturnValueOnce(new Promise((resolve) => (releaseOld = resolve)))
      .mockResolvedValueOnce(7);
    const { result } = renderHook(() => usePolledCount(load, OPTIONS));
    announce();
    await tick();
    expect(result.current).toBe(7);
    await act(() => Promise.resolve().then(() => releaseOld(3)));
    expect(result.current).toBe(7);
  });

  it('inactivo (contador fuera del menú): ni consulta ni escucha avisos', async () => {
    const load = vi.fn(() => Promise.resolve(4));
    const { result } = renderHook(() => usePolledCount(load, { ...OPTIONS, enabled: false }));
    announce();
    await tick(60_000);
    expect(load).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('al cambiar el idioma se consulta de nuevo en ese momento (lo que traiga texto del servidor llega en el nuevo); inactivo, no', async () => {
    const load = vi.fn(() => Promise.resolve(3)).mockResolvedValueOnce(3).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result, rerender } = renderHook(({ enabled }) => usePolledCount(load, { ...OPTIONS, enabled }), { initialProps: { enabled: true } });
    await tick();
    expect(load).toHaveBeenCalledOnce();
    await act(() => setLocale('en-US'));
    await tick();
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(3); // si esa consulta falla, se conserva lo que había
    rerender({ enabled: false });
    await act(() => setLocale('es-MX'));
    await tick();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
