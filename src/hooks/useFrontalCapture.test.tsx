import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraTurnedError } from '../utils/cameraDiagnostics';
import { config } from '../utils/config';
import type { CameraController } from './useCamera';
import type { FaceGuidance } from './useFaceDetection';
import { isSteadyGuidance, useEnrollmentPhotoPlan, useFrontalCapture, type FrontalPhoto } from './useFrontalCapture';

// La nitidez/enfoque y la luz ya las decide el detector (`useFaceAutoCapture` con `quality`), así que aquí un cuadro
// cuenta solo por `valid.ready()` (`isSteadyGuidance`): el detector ya lo dio por válido. La medición vive en
// `utils/frameQuality.ts` (sus propias pruebas) y en `useFaceDetection.test.tsx`.

/** Una cámara cuyo video la prueba puede girar (de horizontal a vertical) a media toma. */
function cameraWith(video: { videoWidth: number; videoHeight: number } | null) {
  const captureFrame = vi.fn(() => Promise.resolve(new Blob(['jpeg'])));
  const camera = { videoRef: { current: video }, captureFrame } as unknown as CameraController;
  return { camera, captureFrame };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useFrontalCapture: una sola resolución por toma', () => {
  it('el movimiento y el destello van del tamaño de la toma; si la cámara giró, se repite antes de enviar', async () => {
    const video = { videoWidth: 1280, videoHeight: 720 };
    const { camera, captureFrame } = cameraWith(video);
    const { result } = renderHook(() => useFrontalCapture(camera, 1, { maxSide: 640, gapMs: 100 }));
    await act(async () => void (await result.current.take()));
    await expect(result.current.shot()).resolves.toBeInstanceOf(Blob);
    expect(captureFrame).toHaveBeenLastCalledWith({ maxSide: 640 });
    // El teléfono giró: la imagen pasó a vertical.
    Object.assign(video, { videoWidth: 720, videoHeight: 1280 });
    await expect(result.current.shot()).rejects.toBeInstanceOf(CameraTurnedError);
    // Una toma nueva empieza con el tamaño que tenga entonces.
    act(() => result.current.clear());
    await expect(result.current.shot()).resolves.toBeInstanceOf(Blob);
  });

  it('sin imagen todavía no se compara nada (la captura misma avisa si la cámara no está lista)', async () => {
    const { camera, captureFrame } = cameraWith(null);
    const { result } = renderHook(() => useFrontalCapture(camera, 1));
    await act(async () => void (await result.current.take()));
    await expect(result.current.shot()).resolves.toBeInstanceOf(Blob);
    expect(captureFrame).toHaveBeenLastCalledWith(undefined);
  });
});

describe('useFrontalCapture: en el registro solo cuentan las fotos VÁLIDAS (decisión del dueño, 2026-10-06)', () => {
  /** El plan del registro: la prueba dicta si el detector dio por válido el rostro en cada cuadro (`ready`). */
  const plan = (ready: boolean[]): FrontalPhoto => {
    let attempt = 0;
    return { maxSide: 640, gapMs: 10, valid: { ready: () => ready[attempt++] ?? false } };
  };

  it('un cuadro que el detector no da por válido (fuera de posición o borroso) no cuenta ni se fotografía; el contador lleva solo las válidas', async () => {
    const video = { videoWidth: 1280, videoHeight: 720 };
    const { camera, captureFrame } = cameraWith(video);
    const { result } = renderHook(() => useFrontalCapture(camera, 2, plan([true, false, true, true])));
    let photos: Blob[] = [];
    await act(async () => {
      const taking = result.current.take();
      await vi.advanceTimersByTimeAsync(10 * 5);
      photos = await taking;
    });
    expect(photos).toHaveLength(2);
    expect(captureFrame).toHaveBeenCalledTimes(2); // el cuadro no válido no se fotografía
    expect(captureFrame).toHaveBeenCalledWith({ maxSide: 640 });
    expect(result.current.photos).toBe(2);
    expect(result.current.last()).toBe(photos[1]); // el último cuadro capturado (lo reutiliza la vigilancia de accesorios)
    expect(result.current.capture).toBeNull();
  });

  it('sin fotos válidas la toma espera lo que haga falta (nunca avisa ni reinicia) y sigue en cuanto el rostro sirve', async () => {
    const { camera, captureFrame } = cameraWith({ videoWidth: 1280, videoHeight: 720 });
    const ready = { value: false };
    const waiting: FrontalPhoto = { maxSide: 640, gapMs: 10, valid: { ready: () => ready.value } };
    const { result } = renderHook(() => useFrontalCapture(camera, 1, waiting));
    let photos: Blob[] = [];
    await act(async () => {
      const taking = result.current.take();
      await vi.advanceTimersByTimeAsync(10 * 500); // cientos de cuadros sin rostro válido: nada se toma, nada falla
      expect(captureFrame).not.toHaveBeenCalled();
      ready.value = true;
      await vi.advanceTimersByTimeAsync(10 * 2);
      photos = await taking;
    });
    expect(photos).toHaveLength(1);
    expect(result.current.photos).toBe(1);
  });

  it('otra toma (`clear`) o cerrar la pantalla detienen la toma en curso: devuelve lo que llevaba y no sigue tomando', async () => {
    const { camera, captureFrame } = cameraWith({ videoWidth: 1280, videoHeight: 720 });
    const { result, unmount } = renderHook(() => useFrontalCapture(camera, 3, plan(Array<boolean>(50).fill(true))));
    let photos: Blob[] = [];
    await act(async () => {
      const taking = result.current.take();
      await vi.advanceTimersByTimeAsync(10);
      result.current.clear();
      await vi.advanceTimersByTimeAsync(10 * 10);
      photos = await taking;
    });
    expect(photos.length).toBeLessThan(3);
    const taken = captureFrame.mock.calls.length;
    await act(async () => {
      const taking = result.current.take();
      await vi.advanceTimersByTimeAsync(10);
      unmount();
      await vi.advanceTimersByTimeAsync(10 * 10);
      await taking;
    });
    expect(captureFrame.mock.calls.length - taken).toBeLessThan(3);
  });

  it('una verificación (sin plan de validez) toma cada cuadro', async () => {
    const { camera, captureFrame } = cameraWith({ videoWidth: 1280, videoHeight: 720 });
    const { result } = renderHook(() => useFrontalCapture(camera, 2));
    await act(async () => {
      const taking = result.current.take();
      await vi.advanceTimersByTimeAsync(config.faceFrameGapMs * 2);
      await taking;
    });
    expect(captureFrame).toHaveBeenCalledTimes(2);
  });

  it('`last()` es el último cuadro capturado y `clear()` lo olvida', async () => {
    const { camera } = cameraWith({ videoWidth: 1280, videoHeight: 720 });
    const { result } = renderHook(() => useFrontalCapture(camera, 1));
    expect(result.current.last()).toBeNull();
    let frame: Blob | null = null;
    await act(async () => {
      frame = await result.current.shot();
    });
    expect(result.current.last()).toBe(frame);
    act(() => result.current.clear());
    expect(result.current.last()).toBeNull();
  });
});

describe('useEnrollmentPhotoPlan: la revisión en vivo de cada foto del registro', () => {
  it('lee lo que ve el detector al tomar cada cuadro (referencia): un cuadro cuenta cuando el detector lo da por válido', () => {
    const guidance = { current: 'no_face' as FaceGuidance };
    const initial: { photo: FrontalPhoto | undefined } = { photo: { maxSide: 640, gapMs: 100 } };
    const { result, rerender } = renderHook(({ photo }) => useEnrollmentPhotoPlan(photo, guidance), { initialProps: initial });
    const valid = result.current?.valid;
    expect(result.current).toMatchObject({ maxSide: 640, gapMs: 100 });
    expect(valid?.ready()).toBe(false);
    guidance.current = 'hold_still';
    expect(valid?.ready()).toBe(true);
    guidance.current = 'ready';
    expect(valid?.ready()).toBe(true);
    rerender({ photo: undefined }); // una verificación: sin plan
    expect(result.current).toBeUndefined();
    // Un cuadro borroso o en movimiento ya no es «válido»: el detector lo marca `blurry`/`moving`, no `hold_still`/`ready`.
    expect(['hold_still', 'ready', 'move', 'no_face', 'moving', 'blurry', 'look_straight'].map((g) => isSteadyGuidance(g as FaceGuidance))).toEqual([true, true, false, false, false, false, false]);
  });
});
