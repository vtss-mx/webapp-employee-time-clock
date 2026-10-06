import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAutoRefresh } from './useAutoRefresh';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useAutoRefresh', () => {
  it('vuelve a pedir cada intervalo (no al montar) con la función más reciente; con la pestaña oculta se pausa', async () => {
    vi.useFakeTimers();
    // Jitter en el centro (±20 % del intervalo): con uno al azar, dos esperas cortas seguidas caben en una
    // ventana de 1300 ms y la prueba fallaba de vez en cuando.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ refresh }) => useAutoRefresh(refresh, 1000), { initialProps: { refresh: first } });
    expect(first).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ refresh: second });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('apagado no consulta; sin intervalo usa el de la configuración', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, 1000, false));
    renderHook(() => useAutoRefresh(refresh));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(refresh).not.toHaveBeenCalled(); // la configuración por omisión es de un minuto
  });
});
