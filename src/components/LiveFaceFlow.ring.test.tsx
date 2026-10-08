import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, camera, detail, flow, heading, message, NO_LIVENESS, renderFlow, resetFaceFlow, see, serve, stable, TWO_TURNS } from '../test/faceFlow';
import { apiFail, apiOk } from '../test/http';
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
const LIVE: FaceChallenge = { ...TWO_TURNS, burst: SPEC };
const ring = () => screen.getByRole('img', { name: /^Captura al/ }).getAttribute('aria-label');
const done = () => screen.queryByRole('img', { name: 'Captura completa' });

beforeEach(() => {
  resetFaceFlow();
  act(() => burst.hold(0));
});
afterEach(() => vi.useRealTimers());

describe('LiveFaceFlow: anillo de las fotos', () => {
  it('avanza con cada foto por todo el proceso y se completa con la marca ✓ al enviar', async () => {
    serve({ challenge: () => apiOk(LIVE) }); // 1 de frente + 26 ligeras + 2 movimientos con 10 recortes = 39
    flow.onSubmit.mockImplementation(() => new Promise(() => undefined));
    renderFlow();
    expect(ring()).toBe('Captura al 0 %');
    await stable();
    expect(ring()).toBe('Captura al 3 %'); // la foto de frente (el reto ya llegó: se pidió al empezar)
    act(() => burst.hold(13));
    expect(ring()).toBe('Captura al 36 %'); // y las fotos ligeras del tramo quieto
    act(() => burst.hold(26));
    expect(ring()).toBe('Captura al 69 %');
    await act(() => Promise.resolve().then(burst.release)); // tramo quieto completo: empieza el primer movimiento
    expect(document.querySelector('.flash')).toBeNull(); // nunca una capa de color (el destello se retiró)
    expect(ring()).toBe('Captura al 69 %');
    see({ guidance: 'move', moveProgress: 0.5 });
    expect(ring()).toBe('Captura al 77 %'); // sigue a la cabeza
    expect(done()).toBeNull();
    await stable(); // primer movimiento → de vuelta al frente
    expect(ring()).toBe('Captura al 85 %');
    await stable();
    await stable();
    expect(done()).toHaveAttribute('data-value', '100'); // completo al enviar (el anillo lleno es la señal)
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
    expect(done()).toHaveAttribute('data-value', '100'); // sin prueba de vida: la única foto era todo (y se envía)
  });
});

describe('LiveFaceFlow: fotos completas del registro facial', () => {
  it('primero la foto inicial que valida el servidor y luego las válidas, del tamaño de la configuración, con su pausa y una tras otra hasta las que pide', async () => {
    const server = serve();
    renderFlow({ frontalFrames: 3, frontalPhoto: { maxSide: 640, gapMs: 120 } });
    await stable();
    // La foto inicial (validada por el servidor: UNA foto en /face/check) y la primera válida.
    expect(server.checks()).toBe(1);
    expect(camera.capture).toHaveBeenCalledTimes(2);
    expect(camera.capture).toHaveBeenLastCalledWith({ maxSide: 640 });
    await advance(119);
    expect(camera.capture).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(camera.capture).toHaveBeenCalledTimes(3);
    await advance(120);
    // Se envían solo las válidas (la inicial ya cumplió su función).
    expect(flow.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ frontal: camera.frames.slice(1) }));
    expect(camera.frames).toHaveLength(4);
  });

  it('los movimientos del registro van del mismo tamaño que sus fotos (el servidor exige una sola resolución)', async () => {
    serve({ challenge: () => apiOk({ ...LIVE, burst: null }) });
    renderFlow({ frontalFrames: 1, frontalPhoto: { maxSide: 640, gapMs: 120 } });
    await stable();
    await act(() => Promise.resolve().then(burst.release));
    await stable(); // primer movimiento → de vuelta al frente
    await stable();
    await stable(); // segundo movimiento → de vuelta al frente (el registro termina centrado)
    await stable(); // centrado: se envía
    expect(flow.onSubmit).toHaveBeenCalledTimes(1);
    expect(camera.capture).toHaveBeenCalledTimes(1 + 1 + 2); // inicial + válida + movimientos
    camera.capture.mock.calls.forEach((call) => expect(call).toEqual([{ maxSide: 640 }]));
  });

  it('si la ráfaga falla al enviar tras la vuelta al frente final del registro, se avisa y el escaneo se reanuda', async () => {
    serve({ challenge: () => apiOk({ ...LIVE, burst: SPEC }) });
    const take = burst.recorder.take;
    burst.recorder.take = () => Promise.reject(new CameraNotReadyError());
    try {
      renderFlow({ frontalFrames: 1, frontalPhoto: { maxSide: 640, gapMs: 120 } });
      await stable();
      await act(() => Promise.resolve().then(burst.release));
      await stable(); // primer movimiento → de vuelta al frente
      await stable(); // al frente → segundo movimiento
      await stable(); // segundo movimiento → vuelta al frente final
      await stable(); // centrado: la ráfaga falla al armar la hoja
      expect(heading()).toHaveTextContent('Intenta de nuevo');
      expect(message()).toHaveTextContent('La cámara aún no está lista');
      expect(flow.onSubmit).not.toHaveBeenCalled();
      expect(flow.onFatal).not.toHaveBeenCalled();
    } finally {
      burst.recorder.take = take;
    }
  });

  it('una verificación captura con lo de siempre (sin tamaño propio)', async () => {
    serve();
    renderFlow({ frontalFrames: 1 });
    await stable();
    expect(camera.capture).toHaveBeenCalledWith(undefined);
  });
});

describe('LiveFaceFlow: salir a medio escaneo', () => {
  it('si la pantalla se cierra mientras la ráfaga completa su tramo quieto, el reto no empieza ni se envía nada', async () => {
    serve({ challenge: () => apiOk(LIVE) });
    const view = renderFlow();
    await stable();
    view.unmount();
    await act(() => Promise.resolve().then(burst.release));
    expect(flow.onSubmit).not.toHaveBeenCalled();
  });
});

describe('LiveFaceFlow: la foto inicial y las fotos válidas del registro (decisión del dueño, 2026-10-06)', () => {
  it('la foto inicial la valida el servidor: si la rechaza, se explica, no se toma ninguna más y se vuelve a pedir', async () => {
    const server = serve({ check: () => apiFail(422, 'TOO_BLURRY', 'La foto está borrosa') });
    renderFlow({ frontalFrames: 3, frontalPhoto: { maxSide: 640, gapMs: 10 } });
    await stable();
    expect(server.checks()).toBe(1);
    expect(camera.capture).toHaveBeenCalledTimes(1);
    expect(heading()).toHaveTextContent('Intenta de nuevo');
    expect(message()).toHaveTextContent('La foto está borrosa');
    await advance(config.faceResumeAfterBlockMs);
    expect(heading()).not.toHaveTextContent('Intenta de nuevo');
    expect(camera.capture).toHaveBeenCalledTimes(1);
    expect(flow.onSubmit).not.toHaveBeenCalled();
  });

  it('con el rostro fuera de posición ningún cuadro cuenta ni se fotografía y el escaneo espera (nunca se repite); al corregirlo, cuenta y envía', async () => {
    serve();
    renderFlow({ frontalFrames: 2, frontalPhoto: { maxSide: 640, gapMs: 1 } });
    see({ guidance: 'off_center' });
    await stable();
    expect(camera.capture).toHaveBeenCalledTimes(1); // solo la inicial (válida para el servidor)
    await advance(60_000); // un minuto fuera de la guía: nada cuenta, nada se reinicia, la indicación dice qué corregir
    expect(heading()).not.toHaveTextContent('Intenta de nuevo');
    expect(message()).toHaveTextContent('Centra tu rostro');
    // Al tomar las fotos, un rostro fuera de posición pone el borde en ROJO (decisión del dueño, 2026-10-07), no ámbar.
    expect(document.querySelector('.face-scan')).toHaveClass('face-scan--bad');
    expect(detail()).toHaveTextContent('Capturas válidas: 0 %');
    expect(camera.capture).toHaveBeenCalledTimes(1);
    see({ guidance: 'look_straight' });
    await advance(50);
    expect(message()).toHaveTextContent('Mira al frente');
    expect(camera.capture).toHaveBeenCalledTimes(1);
    // De frente otra vez: las fotos cuentan (en verde), el anillo avanza y se envía sin volver a empezar.
    see({ guidance: 'hold_still' });
    expect(message()).toHaveTextContent('Mantente quieto');
    expect(document.querySelector('.face-scan')).toHaveClass('face-scan--ok');
    await advance(50);
    expect(flow.onSubmit).toHaveBeenCalledTimes(1);
    expect(camera.capture).toHaveBeenCalledTimes(3); // inicial + las dos válidas
    expect(flow.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ frontal: camera.frames.slice(1) }));
  });
});
