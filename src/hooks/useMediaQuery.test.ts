import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

/** Consulta de medios con redibujo al cambiar; sin `matchMedia` es falsa. */
describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sigue a matchMedia y se redibuja cuando cambia', () => {
    const listeners = new Set<() => void>();
    const media = {
      matches: false,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => media));
    const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 520px)'));
    expect(result.current).toBe(false);
    media.matches = true;
    act(() => listeners.forEach((listener) => listener()));
    expect(result.current).toBe(true);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it('sin matchMedia (entorno sin ventana completa) es falsa', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery('(max-width: 520px)'));
    expect(result.current).toBe(false);
  });
});
