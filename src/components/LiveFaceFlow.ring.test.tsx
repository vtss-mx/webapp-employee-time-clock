import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, camera, flow, NO_LIVENESS, renderFlow, resetFaceFlow, see, serve, stable, TWO_TURNS } from '../test/faceFlow';
import { apiOk } from '../test/http';
import type { FaceChallenge } from '../types';
import type { BurstSpec } from '../types/capture';
import { CameraNotReadyError } from '../utils/cameraDiagnostics';
import { config } from '../utils/config';

/*
 * El anillo de 36 marcas del escáner (decisión del dueño, 2026-10-06) dentro del flujo: un solo avance por todo el
 * proceso —fotos de frente, fotos ligeras de la ráfaga, colores del destello y movimientos— que se completa con la
 * marca ✓ al enviar; y las fotos completas del registro facial (tamaño, pausa y un cuadro nuevo del video).
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));

// La ráfaga simulada: la prueba decide cuántas fotos ligeras lleva el tramo quieto (y lo avisa como el recolector real).
const burst = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let held = 0;
  /** El tramo quieto se completa cuando la prueba lo dice (`release`). */
  let release: () => void = () => undefined;
  return {
    release: () => release(),
    recorder: {
      start: () => undefined,
      move: () => undefined,
      pause: () => undefined,
      reset: () => undefined,
      settle: () => new Promise<void>((resolve) => (release = resolve)),
      take: () => Promise.resolve(null),
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
      held: () => held,
    },
    hold(count: number) {
      held = count;
      listeners.forEach((listener) => listener());
    },
  };
});
vi.mock('../hooks/useFaceBurst', () => ({ useFaceBurst: () => burst.recorder }));

const SPEC: BurstSpec = { tile: 160, hold: 26, move: 10, fps: 10, quality: 0.85, margin: 1.6, max_bytes: 524_288, min_frames: 6 };
const LIVE: FaceChallenge = { ...TWO_TURNS, flash: ['#FF0000', '#00FF00', '#0000FF'], burst: SPEC };
const ring = () => screen.getByRole('img', { name: /^Captura al/ }).getAttribute('aria-label');
const done = () => screen.queryByRole('img', { name: 'Captura completa' });

beforeEach(() => {
  resetFaceFlow();
  act(() => burst.hold(0));
});
afterEach(() => vi.useRealTimers());

describe('LiveFaceFlow: anillo de las fotos', () => {
  it('avanza con cada foto por todo el proceso y se completa con la marca ✓ al enviar', async () => {
    serve({ challenge: () => apiOk(LIVE) }); // 1 de frente + 26 ligeras + 3 colores + 2 movimientos con 10 recortes = 42
    flow.onSubmit.mockImplementation(() => new Promise(() => undefined));
    renderFlow();
    expect(ring()).toBe('Captura al 0 %');
    await stable();
    expect(ring()).toBe('Captura al 2 %'); // la foto de frente (el reto ya llegó: se pidió al empezar)
    act(() => burst.hold(13));
    expect(ring()).toBe('Captura al 33 %'); // y las fotos ligeras del tramo quieto
    act(() => burst.hold(26));
    expect(ring()).toBe('Captura al 64 %');
    await act(() => Promise.resolve().then(burst.release)); // tramo quieto completo: empieza el destello
    await advance(config.faceFlashSettleMs);
    expect(document.querySelector('.flash')).not.toBeNull();
    expect(ring()).toBe('Captura al 67 %'); // el tramo quieto completo y el primer color capturado
    await advance(config.faceFlashSettleMs * 2);
    expect(ring()).toBe('Captura al 71 %');
    see({ guidance: 'move', moveProgress: 0.5 });
    expect(ring()).toBe('Captura al 79 %'); // sigue a la cabeza
    expect(done()).toBeNull();
    await stable(); // primer movimiento → de vuelta al frente
    expect(ring()).toBe('Captura al 86 %');
    await stable();
    await stable();
    expect(ring()).toBe('Captura al 100 %');
    expect(done()).toBeInTheDocument();
  });

  it('el reto de un escaneo que se detuvo no cambia el anillo del siguiente', async () => {
    const answers: ((response: Response) => void)[] = [];
    serve({ challenge: () => new Promise((resolve) => answers.push(resolve)) });
    camera.capture.mockRejectedValueOnce(new CameraNotReadyError());
    renderFlow();
    await stable(); // la cámara no dio imagen: se detiene con su reto aún en camino
    await advance(config.faceResumeAfterBlockMs);
    await stable(); // escaneo nuevo: su foto ya está, su reto aún no
    await act(() => Promise.resolve().then(() => answers[0](apiOk(LIVE))));
    expect(ring()).toBe('Captura al 0 %'); // el reto viejo no cuenta
    await act(() => Promise.resolve().then(() => answers[1](apiOk(NO_LIVENESS))));
    expect(ring()).toBe('Captura al 100 %'); // sin prueba de vida: la única foto era todo (y se envía)
  });
});

describe('LiveFaceFlow: fotos completas del registro facial', () => {
  it('del tamaño de la configuración, con su pausa y una tras otra hasta las que pide', async () => {
    serve();
    renderFlow({ frontalFrames: 3, frontalPhoto: { maxSide: 640, gapMs: 120 } });
    await stable();
    expect(camera.capture).toHaveBeenCalledTimes(1);
    expect(camera.capture).toHaveBeenLastCalledWith({ maxSide: 640 });
    await advance(119);
    expect(camera.capture).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(camera.capture).toHaveBeenCalledTimes(2);
    await advance(120);
    expect(flow.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ frontal: camera.frames }));
    expect(camera.frames).toHaveLength(3);
  });

  it('una verificación captura con lo de siempre (sin tamaño propio)', async () => {
    serve();
    renderFlow({ frontalFrames: 1 });
    await stable();
    expect(camera.capture).toHaveBeenCalledWith(undefined);
  });
});
