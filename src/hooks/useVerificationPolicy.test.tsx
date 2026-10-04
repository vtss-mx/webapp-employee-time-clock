import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settingsService } from '../services/settingsService';
import { samplePolicy } from '../test/fixtures';
import { publishPolicy, resetPolicyCache, STRICT_RULES, useVerificationPolicy } from './useVerificationPolicy';

afterEach(() => resetPolicyCache());

describe('useVerificationPolicy', () => {
  it('mientras carga usa lo más estricto; después, la política de la empresa (una sola petición compartida)', async () => {
    const load = vi.spyOn(settingsService, 'getVerificationPolicy').mockResolvedValue(samplePolicy);
    const first = renderHook(() => useVerificationPolicy());
    const second = renderHook(() => useVerificationPolicy());
    expect(first.result.current).toEqual({ policy: STRICT_RULES, loaded: false });
    await waitFor(() => expect(first.result.current).toEqual({ policy: samplePolicy, loaded: true }));
    expect(second.result.current.loaded).toBe(true);
    expect(load).toHaveBeenCalledOnce();
    // Otra pantalla que se abre después ya la tiene desde el inicio.
    expect(renderHook(() => useVerificationPolicy()).result.current.loaded).toBe(true);
  });

  it('sin red se queda con los valores estrictos (el backend valida igual)', async () => {
    const load = vi.spyOn(settingsService, 'getVerificationPolicy').mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useVerificationPolicy());
    await waitFor(() => expect(load).toHaveBeenCalled());
    await act(() => Promise.resolve());
    expect(result.current).toEqual({ policy: STRICT_RULES, loaded: false });
  });

  it('una política recién guardada llega a todas las pantallas abiertas', async () => {
    vi.spyOn(settingsService, 'getVerificationPolicy').mockResolvedValue(samplePolicy);
    const { result } = renderHook(() => useVerificationPolicy());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const saved = { ...samplePolicy, liveness_challenge: false };
    act(() => publishPolicy(saved));
    expect(result.current.policy).toEqual(saved);
  });

  it('al salir antes de que cargue no actualiza la pantalla ni sigue escuchando', async () => {
    let release: (value: typeof samplePolicy) => void = () => undefined;
    vi.spyOn(settingsService, 'getVerificationPolicy').mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { result, unmount } = renderHook(() => useVerificationPolicy());
    unmount();
    await act(() => Promise.resolve().then(() => release(samplePolicy)));
    act(() => publishPolicy({ ...samplePolicy, qr_enabled: false }));
    expect(result.current.loaded).toBe(false);
  });
});
