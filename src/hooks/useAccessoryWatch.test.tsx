import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/apiClient';
import type { FaceCheckResult } from '../types';
import { config } from '../utils/config';
import { useAccessoryWatch } from './useAccessoryWatch';

/*
 * Vigilancia continua de accesorios (decisión del dueño, 2026-10-07): cada intervalo valida un cuadro en el servidor y
 * publica los accesorios. La validación real (`/face/check`) tiene sus propias pruebas; aquí se simula `faceService.check`.
 */
const check = vi.fn<(images: Blob[], allowHeadwear: boolean) => Promise<FaceCheckResult>>();
vi.mock('../services/verificationService', () => ({ faceService: { check: (images: Blob[], allowHeadwear: boolean) => check(images, allowHeadwear) } }));

const ok = (accessories?: string[]): FaceCheckResult => ({ ok: true, message: '', detection_score: 0.9, quality_score: 0.9, yaw_ratio: 0, accessories });
const blocked = (accessories: string[]) =>
  new ApiError({ statusCode: 422, code: 'ACCESSORIES_DETECTED', message: '', errors: [{ code: 'ACCESSORIES_DETECTED', message: '', field: null, details: { accessories } }] });

beforeEach(() => {
  vi.useFakeTimers();
  check.mockReset();
});
afterEach(() => vi.useRealTimers());

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('useAccessoryWatch: insignias de accesorios en vivo', () => {
  it('cada intervalo valida un cuadro chico y publica los accesorios reportados (aparecen y, al quitarlos, desaparecen)', async () => {
    check.mockResolvedValueOnce(ok(['GLASSES'])).mockResolvedValueOnce(ok([]));
    const captureFrame = vi.fn(() => Promise.resolve(new Blob(['x'])));
    const onAccessories = vi.fn();
    // Con un rostro a la vista (`ready` verdadero) la vigilancia valida; sin él (otra prueba) se salta el turno.
    renderHook(() => useAccessoryWatch({ enabled: true, captureFrame, allowHeadwear: false, ready: () => true, onAccessories }));
    expect(check).not.toHaveBeenCalled(); // espera el intervalo (no spamea al abrir)
    await tick(config.faceAccessoryCheckIntervalMs + 100);
    expect(captureFrame).toHaveBeenCalledWith({ maxSide: config.faceAccessoryCheckPx });
    expect(check).toHaveBeenCalledWith([expect.any(Blob)], false);
    expect(onAccessories).toHaveBeenLastCalledWith(['GLASSES']);
    await tick(config.faceAccessoryCheckIntervalMs + 100);
    expect(onAccessories).toHaveBeenLastCalledWith([]); // quitados: la validación limpia la insignia
  });

  it('un 422 por accesorio bloqueado publica los que detectó; otra falla deja las insignias como están', async () => {
    check.mockRejectedValueOnce(blocked(['MASK'])).mockRejectedValueOnce(new ApiError({ statusCode: 422, code: 'TOO_DARK', message: '' }));
    const onAccessories = vi.fn();
    renderHook(() => useAccessoryWatch({ enabled: true, captureFrame: () => Promise.resolve(new Blob(['x'])), allowHeadwear: true, onAccessories }));
    await tick(config.faceAccessoryCheckIntervalMs + 100);
    expect(check).toHaveBeenLastCalledWith([expect.any(Blob)], true);
    expect(onAccessories).toHaveBeenLastCalledWith(['MASK']);
    await tick(config.faceAccessoryCheckIntervalMs + 100);
    expect(onAccessories).toHaveBeenCalledTimes(1); // la falla de calidad no cambia las insignias
  });

  it('sin rostro a la vista (ready false) no gasta una validación; deshabilitada no hace nada', async () => {
    const onAccessories = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useAccessoryWatch({ enabled, captureFrame: () => Promise.resolve(new Blob()), allowHeadwear: false, ready: () => false, onAccessories }),
      { initialProps: { enabled: true } },
    );
    await tick(config.faceAccessoryCheckIntervalMs + 100);
    expect(check).not.toHaveBeenCalled();
    rerender({ enabled: false });
    await tick(config.faceAccessoryCheckIntervalMs * 2);
    expect(check).not.toHaveBeenCalled();
  });

  it('si la cámara no da imagen (la captura lanza) se salta el turno sin romper ni tocar las insignias', async () => {
    const onAccessories = vi.fn();
    renderHook(() => useAccessoryWatch({ enabled: true, captureFrame: () => Promise.reject(new Error('sin imagen')), allowHeadwear: false, onAccessories }));
    await tick(config.faceAccessoryCheckIntervalMs + 100);
    expect(check).not.toHaveBeenCalled();
    expect(onAccessories).not.toHaveBeenCalled();
  });

  it('si se deshabilita con una validación en curso, aplica ese resultado pero ya no agenda otra', async () => {
    let resolve: (r: FaceCheckResult) => void = () => undefined;
    check.mockReturnValueOnce(new Promise<FaceCheckResult>((r) => (resolve = r)));
    const onAccessories = vi.fn();
    const { rerender } = renderHook(({ enabled }) => useAccessoryWatch({ enabled, captureFrame: () => Promise.resolve(new Blob()), allowHeadwear: false, onAccessories }), {
      initialProps: { enabled: true },
    });
    await tick(config.faceAccessoryCheckIntervalMs + 100); // la validación arranca y queda pendiente
    rerender({ enabled: false }); // se deshabilita con la validación en curso
    await act(async () => {
      resolve(ok(['MASK']));
      await Promise.resolve();
    });
    expect(onAccessories).toHaveBeenCalledWith(['MASK']); // el resultado en curso sí se aplica
    await tick(config.faceAccessoryCheckIntervalMs * 2);
    expect(check).toHaveBeenCalledTimes(1); // pero no se agenda otra validación
  });
});
