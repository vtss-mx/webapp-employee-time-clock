import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FaceBurstRecorder } from '../utils/faceBurstRecorder';
import { useFaceBurst } from './useFaceBurst';

describe('useFaceBurst', () => {
  it('un solo recolector por pantalla, que se descarta al salir', () => {
    const reset = vi.spyOn(FaceBurstRecorder.prototype, 'reset');
    const videoRef = { current: null };
    const { result, rerender, unmount } = renderHook(() => useFaceBurst(videoRef));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    unmount();
    expect(reset).toHaveBeenCalled();
  });
});
