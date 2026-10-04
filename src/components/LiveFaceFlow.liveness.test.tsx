import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, camera, detection, flow, heading, message, renderFlow, resetFaceFlow, see, serve, stable, TWO_TURNS } from '../test/faceFlow';
import { apiOk } from '../test/http';
import type { FaceChallenge } from '../types';
import { config } from '../utils/config';
import { CameraNotReadyError } from '../utils/cameraDiagnostics';

/*
 * Prueba de vida reforzada: destello de colores (una captura por color, antes de los movimientos),
 * los cinco movimientos (girar, mirar arriba, mirar abajo, acercarse) con su señal y el vencimiento
 * del reto que dice el servidor (`expires_in`).
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));

const settle = config.faceFlashSettleMs;
const COLORS = ['#FF0000', '#00FF00', '#0000FF'];
const FLASHING: FaceChallenge = {
  ...TWO_TURNS,
  challenge_id: 'ch-f',
  action: 'LOOK_UP',
  instruction: 'Levanta un poco la barbilla y mira hacia arriba',
  actions: ['LOOK_UP', 'LOOK_DOWN', 'MOVE_CLOSER'],
  instructions: ['Levanta un poco la barbilla y mira hacia arriba', 'Baja un poco la barbilla y mira hacia abajo', 'Acerca tu rostro a la cámara'],
  flash: COLORS,
};
const overlay = () => document.querySelector<HTMLElement>('.flash');
const flashColor = () => overlay()?.style.getPropertyValue('--flash-color') ?? null;
const currentFill = () => document.querySelector<HTMLElement>('.faceid__progress .is-current')?.style.getPropertyValue('--fill');
const baseline = { pitch: 0.5, width: 200 };
const { onSubmit, onFatal } = flow;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

beforeEach(resetFaceFlow);
afterEach(() => {
  setVisibility('visible');
  vi.useRealTimers();
});

describe('LiveFaceFlow: destello de colores', () => {
  it('pinta cada color, captura uno por color y sigue con los movimientos; envía todo en orden', async () => {
    const server = serve({ challenge: () => apiOk(FLASHING) });
    renderFlow();
    await stable(baseline);

    // Destello: la pantalla se pinta del primer color; la detección se pausa.
    expect(flashColor()).toBe('#FF0000');
    expect(overlay()).toHaveTextContent('Mantén tu rostro frente a la pantalla');
    expect(heading()).toHaveTextContent('Prueba de vida · destello');
    expect(message()).toHaveTextContent('Mantén tu rostro frente a la pantalla');
    expect(detection.options?.enabled).toBe(false);
    expect(currentFill()).toMatch(/^0\.33/);
    expect(camera.capture).toHaveBeenCalledOnce(); // solo la frontal: aún no se ve el color
    await advance(settle);
    expect(camera.capture).toHaveBeenCalledTimes(2);
    expect(flashColor()).toBe('#00FF00');
    await advance(settle);
    expect(flashColor()).toBe('#0000FF');
    await advance(settle);
    expect(overlay()).toBeNull();

    // Mirar arriba (contra el rostro en reposo de las frontales).
    expect(heading()).toHaveTextContent('Prueba de vida · paso 1 de 3');
    expect(detection.options?.mode).toEqual({ kind: 'action', action: 'LOOK_UP', minimum: 0.09, baseline });
    see({ guidance: 'move' });
    expect(message()).toHaveTextContent('Levanta un poco la barbilla y mira hacia arriba');
    expect(document.querySelector('.tilt-cue--up')).not.toBeNull();
    await stable();
    await stable(); // de vuelta al frente

    // Mirar abajo.
    expect(detection.options?.mode).toMatchObject({ action: 'LOOK_DOWN', minimum: 0.09 });
    expect(document.querySelector('.tilt-cue--down')).not.toBeNull();
    await stable();
    await stable();

    // Acercarse: el óvalo punteado marca hasta dónde crecer.
    expect(heading()).toHaveTextContent('Prueba de vida · paso 3 de 3');
    expect(detection.options?.mode).toEqual({ kind: 'action', action: 'MOVE_CLOSER', minimum: 1.3, baseline });
    expect(Number(document.querySelector<HTMLElement>('.closer-cue')?.style.getPropertyValue('--closer-scale'))).toBeCloseTo(1.3 + config.faceCloserMargin);
    await stable();

    const [frontal, red, green, blue, up, down, closer] = camera.frames;
    expect(onSubmit).toHaveBeenCalledWith({
      frontal: [frontal],
      challenge: { id: 'ch-f', images: [up, down, closer] },
      flash: [red, green, blue],
      camera: 'FaceTime HD Camera',
      accessoryReview: false,
    });
    expect(server.checks()).toBe(1);
  });

  it('si la cámara falla durante el destello y solo se mide, sigue sin él (no envía capturas del destello)', async () => {
    serve({ challenge: () => apiOk({ ...FLASHING, actions: ['TURN_LEFT'], instructions: ['Gira a tu izquierda'] }) });
    renderFlow();
    await stable();
    camera.capture.mockRejectedValueOnce(new CameraNotReadyError());
    await advance(settle);
    expect(overlay()).toBeNull();
    expect(detection.options?.mode).toMatchObject({ kind: 'action', action: 'TURN_LEFT' });
    await stable();
    expect(onSubmit).toHaveBeenCalledWith({ frontal: [camera.frames[0]], challenge: { id: 'ch-f', images: [camera.frames[1]] }, camera: 'FaceTime HD Camera', accessoryReview: false });
  });

  it('obligatorio: si la pantalla deja de verse se explica y se pide otro reto (con colores nuevos) sin volver a escanear', async () => {
    let issued = 0;
    const server = serve({ challenge: () => apiOk({ ...FLASHING, flash_required: true, challenge_id: `ch-${++issued}`, flash: issued === 1 ? COLORS : ['#FFFF00', '#00FFFF'] }) });
    renderFlow();
    await stable();
    setVisibility('hidden');
    await advance(settle);
    expect(overlay()).toBeNull();
    expect(heading()).toHaveTextContent('Intentemos de nuevo');
    expect(message()).toHaveTextContent('No se pudo completar el destello de colores. Mantén la pantalla encendida y tu rostro frente a ella.');
    setVisibility('visible');
    await advance(config.faceResumeAfterBlockMs);
    expect(server.challenges()).toBe(2);
    expect(flashColor()).toBe('#FFFF00');
    await advance(settle * 2);
    expect(heading()).toHaveTextContent('Prueba de vida · paso 1 de 3');
    expect(server.checks()).toBe(1);
    expect(onFatal).not.toHaveBeenCalled();
  });

  it('obligatorio y fallando una y otra vez: tras los retos permitidos reinicia todo el flujo', async () => {
    const server = serve({ challenge: () => apiOk({ ...FLASHING, flash_required: true }) });
    renderFlow();
    await stable();
    setVisibility('hidden');
    await advance(settle); // primer reto: falla
    await advance(config.faceResumeAfterBlockMs + settle); // segundo
    await advance(config.faceResumeAfterBlockMs + settle); // tercero
    expect(server.challenges()).toBe(3);
    expect(message()).toHaveTextContent('No se completó la prueba de vida. Intentemos de nuevo desde el inicio.');
    await advance(config.faceResumeAfterBlockMs);
    expect(detection.options?.mode).toEqual({ kind: 'frontal' });
    expect(onFatal).not.toHaveBeenCalled();
  });

  it('al salir a medio destello no se captura ni se envía nada más', async () => {
    serve({ challenge: () => apiOk(FLASHING) });
    const view = renderFlow();
    await stable();
    view.unmount();
    await advance(settle * 3);
    expect(camera.capture).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onFatal).not.toHaveBeenCalled();
  });
});

describe('LiveFaceFlow: vencimiento del reto (expires_in)', () => {
  it('el reto completo vence antes que el tiempo de cada movimiento: se pide otro a tiempo para enviarlo', async () => {
    // 20 s de vida menos el margen del envío (5 s) = 15 s, aunque cada movimiento tenga 20 s.
    serve({ challenge: () => apiOk({ ...TWO_TURNS, expires_in: 20 }) });
    renderFlow();
    await stable();
    await advance(10_000);
    await stable(); // primer giro a los 10 s: al volver al frente quedan 5 s
    await advance(4_999);
    expect(heading()).not.toHaveTextContent('Intentemos de nuevo');
    await advance(1);
    expect(heading()).toHaveTextContent('Intentemos de nuevo');
    expect(message()).toHaveTextContent('No se completó el movimiento a tiempo');
  });

  it('sin vencimiento del servidor rige solo el tiempo de cada movimiento', async () => {
    serve({ challenge: () => apiOk({ ...TWO_TURNS, expires_in: null }) });
    renderFlow();
    await stable();
    await advance(config.faceChallengeTimeoutMs - 1);
    expect(heading()).toHaveTextContent('Prueba de vida · paso 1 de 2');
    await advance(1);
    expect(heading()).toHaveTextContent('Intentemos de nuevo');
  });
});
