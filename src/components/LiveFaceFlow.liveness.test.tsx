import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { advance, camera, detection, ENROLLMENT, flow, FOUR_MOVES, heading, message, renderFlow, resetFaceFlow, see, serve, stable, TWO_TURNS } from '../test/faceFlow';
import { apiOk } from '../test/http';
import { config } from '../utils/config';

/*
 * Prueba de vida: el vencimiento del reto que dice el servidor (`expires_in`) frente al tiempo de cada movimiento; que un
 * reto SIN destello (lo normal: el destello es un interruptor del ADMIN apagado por omisión) no pinta la pantalla (el
 * destello dictado tiene su propio banco, `LiveFaceFlow.flash.test.tsx`); y la prueba de vida COMPLETA del registro
 * (decisión del dueño, 2026-10-07): los cuatro movimientos de la cabeza, la vuelta al frente después de cada uno y el
 * final centrado.
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));

beforeEach(resetFaceFlow);
afterEach(() => vi.useRealTimers());

describe('LiveFaceFlow: vencimiento del reto (expires_in)', () => {
  it('el reto completo vence antes que el tiempo de cada movimiento: se pide otro a tiempo para enviarlo', async () => {
    // 20 s de vida menos el margen del envío (5 s) = 15 s, aunque cada movimiento tenga 20 s.
    serve({ challenge: () => apiOk({ ...TWO_TURNS, expires_in: 20 }) });
    renderFlow();
    await stable();
    await advance(10_000);
    await stable(); // primer giro a los 10 s: al volver al frente quedan 5 s
    await advance(4_999);
    expect(heading()).not.toHaveTextContent('Intenta de nuevo');
    await advance(1);
    expect(heading()).toHaveTextContent('Intenta de nuevo');
    expect(message()).toHaveTextContent('No se completó el movimiento a tiempo');
  });

  it('sin vencimiento del servidor rige solo el tiempo de cada movimiento', async () => {
    serve({ challenge: () => apiOk({ ...TWO_TURNS, expires_in: null }) });
    renderFlow();
    await stable();
    await advance(config.faceChallengeTimeoutMs - 1);
    expect(heading()).toHaveTextContent('Prueba de vida · paso 1 de 2');
    await advance(1);
    expect(heading()).toHaveTextContent('Intenta de nuevo');
  });
});

describe('LiveFaceFlow: sin destello dictado por el reto, la pantalla no se pinta (por omisión)', () => {
  it('un reto sin `flash` ni `flash_pace` hace los movimientos sin pintar ningún color ni enviar capturas de color', async () => {
    serve({ challenge: () => apiOk(TWO_TURNS) });
    renderFlow();
    await stable();
    expect(document.querySelector('.flash')).toBeNull();
    expect(heading()).toHaveTextContent('Prueba de vida · paso 1 de 2');
    await stable();
    await stable();
    await stable();
    expect(document.querySelector('.flash')).toBeNull(); // nunca una capa de color (el destello es de la política del ADMIN)
    expect(flow.onSubmit).toHaveBeenCalledTimes(1);
    expect(flow.onSubmit.mock.calls[0][0]).not.toHaveProperty('flashImage');
    expect(flow.onSubmit.mock.calls[0][0]).not.toHaveProperty('flashReceipt');
  });
});

describe('LiveFaceFlow: la prueba de vida completa del registro (decisión del dueño, 2026-10-07)', () => {
  it('pide el reto del registro, hace los cuatro movimientos con la vuelta al frente tras cada uno y termina centrado', async () => {
    const server = serve({ challenge: () => apiOk(FOUR_MOVES) });
    renderFlow(ENROLLMENT);
    const baseline = { pitch: 0.55, width: 200 };
    await stable(baseline);
    await advance(20);
    // El reto es el del registro (los cuatro movimientos); una verificación no lleva el propósito.
    expect(server.calls.find((call) => call.url.includes('/face/challenge'))?.url).toContain('purpose=ENROLLMENT');
    expect(heading()).toHaveTextContent('Prueba de vida · paso 1 de 4');
    expect(detection.options?.mode).toMatchObject({ kind: 'action', action: 'LOOK_UP', baseline });
    for (let step = 1; step <= 4; step++) {
      await stable(); // el movimiento, capturado: SIEMPRE de vuelta al frente, también tras el último
      expect(detection.options?.mode).toEqual({ kind: 'frontal', baseline });
      if (step < 4) {
        expect(heading()).toHaveTextContent(`Prueba de vida · paso ${step + 1} de 4`);
        expect(screen.getByText('Vuelve a mirar al frente para el siguiente paso.')).toBeInTheDocument();
        see({ guidance: 'off_center' });
        expect(message()).toHaveTextContent('Centra tu rostro');
        see({ guidance: 'hold_still' });
        await stable(); // de vuelta al frente (con detección real): el siguiente movimiento
        expect(detection.options?.mode).toMatchObject({ kind: 'action', action: FOUR_MOVES.actions[step] });
      }
    }
    // Tras el cuarto: la vuelta al frente final («paso 4 de 4», «Centra tu rostro para terminar.») y, centrado, el envío.
    expect(heading()).toHaveTextContent('Prueba de vida · paso 4 de 4');
    expect(screen.getByText('Centra tu rostro para terminar.')).toBeInTheDocument();
    see({ guidance: 'move' });
    expect(message()).toHaveTextContent('Centra tu rostro');
    see({ guidance: 'ready' });
    expect(message()).toHaveTextContent('Rostro centrado');
    expect(flow.onSubmit).not.toHaveBeenCalled();
    await stable();
    expect(flow.onSubmit).toHaveBeenCalledTimes(1);
    const [, frontalPhoto, ...moves] = camera.frames; // la inicial, la válida y una captura por movimiento, en orden
    expect(flow.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ frontal: [frontalPhoto], challenge: { id: 'ch-enroll', images: moves } }));
    expect(moves).toHaveLength(4);
  });

  it('una verificación pide el reto de la política (sin propósito) y envía tras el último movimiento, sin vuelta al frente final', async () => {
    const server = serve({ challenge: () => apiOk(TWO_TURNS) });
    renderFlow();
    await stable();
    expect(server.calls.find((call) => call.url.includes('/face/challenge'))?.url).not.toContain('purpose');
    await stable(); // primer giro → de vuelta al frente
    await stable(); // al frente → segundo giro
    await stable(); // segundo giro: se envía
    expect(flow.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('si el reto venció mientras se reunían las fotos válidas, se pide otro conservándolas, sin aviso ni reintento', async () => {
    let issued = 0;
    const server = serve({ challenge: () => apiOk({ ...FOUR_MOVES, challenge_id: `ch-${++issued}`, expires_in: 10 }) });
    renderFlow({ ...ENROLLMENT, frontalFrames: 2 });
    see({ guidance: 'off_center' }); // la persona tarda en colocarse
    await stable();
    await advance(6_000); // 10 s de vida menos el margen de 5 s: el primer reto ya venció
    expect(server.challenges()).toBe(1);
    see({ guidance: 'hold_still' });
    await advance(100);
    expect(server.challenges()).toBe(2); // el reto nuevo, con las mismas fotos
    expect(heading()).toHaveTextContent('Prueba de vida · paso 1 de 4');
    expect(heading()).not.toHaveTextContent('Intenta de nuevo');
    expect(camera.capture).toHaveBeenCalledTimes(3); // inicial + las dos válidas: no se repitió nada
    expect(detection.options?.mode).toMatchObject({ kind: 'action', action: 'LOOK_UP' });
  });

  it('si la pantalla se cierra mientras llega el reto nuevo (el anterior venció), la respuesta ya no hace nada', async () => {
    let issued = 0;
    let answer: (response: Response) => void = () => undefined;
    serve({
      challenge: () => (++issued === 1 ? apiOk({ ...FOUR_MOVES, challenge_id: 'ch-1', expires_in: 10 }) : new Promise((resolve) => (answer = resolve))),
    });
    const view = renderFlow(ENROLLMENT);
    see({ guidance: 'off_center' });
    await stable();
    await advance(6_000); // el primer reto venció mientras la persona se colocaba
    see({ guidance: 'hold_still' });
    await advance(100); // la foto válida: se pide otro reto, aún en camino
    view.unmount();
    await act(() => Promise.resolve().then(() => answer(apiOk(FOUR_MOVES))));
    expect(flow.onSubmit).not.toHaveBeenCalled();
    expect(flow.onFatal).not.toHaveBeenCalled();
  });
});
