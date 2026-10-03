import { renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useMountedRef } from './useMountedRef';

describe('useMountedRef', () => {
  it('sigue en true tras el doble montaje de StrictMode (el escáner no ignora las respuestas)', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result, unmount } = renderHook(() => useMountedRef(), { wrapper });
    expect(result.current.current).toBe(true);
    const ref = result.current;
    unmount();
    expect(ref.current).toBe(false); // al cerrar la pantalla, las tareas pendientes ya no actualizan nada
  });
});
