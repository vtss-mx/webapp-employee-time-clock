import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopy } from './useCopy';

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  vi.useFakeTimers();
  writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('useCopy', () => {
  it('copia el texto, dice "Copiado" unos segundos y vuelve solo', async () => {
    const { result } = renderHook(() => useCopy(1000));
    await act(() => Promise.resolve().then(() => result.current.copy('tc_live_123')));
    expect(writeText).toHaveBeenCalledWith('tc_live_123');
    expect(result.current.copied).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(result.current.copied).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current.copied).toBe(false);
  });

  it('sin permiso del navegador no marca "Copiado" ni falla', async () => {
    writeText.mockRejectedValue(new DOMException('Permiso denegado', 'NotAllowedError'));
    const { result } = renderHook(() => useCopy());
    await act(() => Promise.resolve().then(() => result.current.copy('secreto')));
    expect(result.current.copied).toBe(false);
  });

  it('sin portapapeles (conexión no segura) no hace nada', async () => {
    Reflect.deleteProperty(navigator, 'clipboard');
    const { result } = renderHook(() => useCopy());
    await act(() => Promise.resolve().then(() => result.current.copy('secreto')));
    expect(result.current.copied).toBe(false);
  });

  it('al salir antes de que vuelva, se cancela la espera', async () => {
    const { result, unmount } = renderHook(() => useCopy());
    await act(() => Promise.resolve().then(() => result.current.copy('x')));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
