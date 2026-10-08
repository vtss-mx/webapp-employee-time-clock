import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flow, renderFlow, resetFaceFlow, serve, stable, TWO_TURNS } from '../test/faceFlow';
import { apiOk } from '../test/http';
import type { FaceChallenge } from '../types';
import type { BurstSpec } from '../types/capture';
import { FaceBurstRecorder } from '../utils/faceBurstRecorder';

/*
 * Protocolo de captura (antifraude 2a) dentro del flujo: la ráfaga de recortes (tramo quieto antes del reto, de
 * movimiento en el primer paso) que viaja con las capturas si el reto la pide. Este reto NO dicta destello, así que no
 * viajan capturas de color (el destello dictado tiene su propio banco, `LiveFaceFlow.flash.test.tsx`).
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));

const SPEC: BurstSpec = { tile: 112, hold: 30, move: 10, fps: 10, quality: 0.85, margin: 1.6, max_bytes: 400_000, min_frames: 6 };
const WITH_BURST: FaceChallenge = { ...TWO_TURNS, challenge_id: 'ch-p', burst: SPEC };
const baseline = { pitch: 0.5, width: 200, box: { x: 10, y: 20, width: 200, height: 220 } };

beforeEach(resetFaceFlow);
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('LiveFaceFlow: protocolo de captura', () => {
  it('la ráfaga empieza con el rostro en reposo, completa su tramo quieto antes del reto y viaja con las capturas', async () => {
    const start = vi.spyOn(FaceBurstRecorder.prototype, 'start');
    const settled = vi.spyOn(FaceBurstRecorder.prototype, 'settle').mockResolvedValue();
    const moved = vi.spyOn(FaceBurstRecorder.prototype, 'move');
    const sheet = { image: new Blob(['hoja']), meta: '{"v":1}' };
    const take = vi.spyOn(FaceBurstRecorder.prototype, 'take').mockResolvedValue(sheet);
    serve({ challenge: () => apiOk(WITH_BURST) });
    renderFlow();
    await stable(baseline);
    expect(start).toHaveBeenCalledWith(baseline.box); // la ráfaga empieza con el rostro en reposo
    expect(settled).toHaveBeenCalledWith(SPEC);
    expect(moved).toHaveBeenCalled(); // el tramo de movimiento, ya en el reto
    await stable();
    await stable();
    await stable();
    expect(take).toHaveBeenCalledWith(SPEC);
    const captured = flow.onSubmit.mock.calls[0][0];
    expect(captured).toMatchObject({ burst: sheet });
    expect(captured).not.toHaveProperty('flashImage'); // este reto no dicta destello
  });

  it('sin hoja (no la pidió el reto o no alcanzó) se envía lo demás', async () => {
    serve({ challenge: () => apiOk({ ...WITH_BURST, burst: null }) });
    renderFlow();
    await stable(baseline);
    await stable();
    await stable();
    await stable();
    const captured = flow.onSubmit.mock.calls[0][0];
    expect(captured).not.toHaveProperty('burst');
    expect(captured.challenge?.images).toHaveLength(2);
  });
});
