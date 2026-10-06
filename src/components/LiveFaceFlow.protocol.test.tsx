import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as pacing from '../services/flashPacingService';
import { advance, flow, renderFlow, resetFaceFlow, serve, stable, TWO_TURNS } from '../test/faceFlow';
import { apiOk } from '../test/http';
import type { FaceChallenge } from '../types';
import type { BurstSpec } from '../types/capture';
import { config } from '../utils/config';
import { FaceBurstRecorder } from '../utils/faceBurstRecorder';

/*
 * Protocolo de captura (antifraude 2a) dentro del flujo: el destello dictado por el servidor (cada color por el canal
 * en vivo, el comprobante con las capturas) y la ráfaga de recortes (tramo quieto antes del destello, de movimiento en
 * el primer paso) que viaja con las capturas si el reto la pide.
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));

const settle = config.faceFlashSettleMs;
const SPEC: BurstSpec = { tile: 112, hold: 30, move: 10, fps: 10, quality: 0.85, margin: 1.6, max_bytes: 400_000, min_frames: 6 };
const PACED: FaceChallenge = { ...TWO_TURNS, challenge_id: 'ch-p', flash: [], flash_pace: { token: 't0', total: 1, window_ms: 2000 }, burst: SPEC };
const baseline = { pitch: 0.5, width: 200, box: { x: 10, y: 20, width: 200, height: 220 } };

beforeEach(() => {
  resetFaceFlow();
  vi.spyOn(pacing, 'sha256Hex').mockResolvedValue('huella');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('LiveFaceFlow: protocolo de captura', () => {
  it('el destello dictado y la ráfaga viajan con las capturas', async () => {
    const step = vi
      .spyOn(pacing.flashPacingService, 'step')
      .mockResolvedValueOnce({ kind: 'color', color: '#FF00FF', token: 't1', step: 0, total: 1 })
      .mockResolvedValueOnce({ kind: 'done', receipt: 'comprobante' });
    const start = vi.spyOn(FaceBurstRecorder.prototype, 'start');
    const settled = vi.spyOn(FaceBurstRecorder.prototype, 'settle').mockResolvedValue();
    const moved = vi.spyOn(FaceBurstRecorder.prototype, 'move');
    const sheet = { image: new Blob(['hoja']), meta: '{"v":1}' };
    const take = vi.spyOn(FaceBurstRecorder.prototype, 'take').mockResolvedValue(sheet);
    serve({ challenge: () => apiOk(PACED) });
    renderFlow();
    await stable(baseline);
    expect(start).toHaveBeenCalledWith(baseline.box); // la ráfaga empieza con el rostro en reposo
    await advance(settle);
    expect(settled).toHaveBeenCalledWith(SPEC);
    expect(step.mock.calls).toEqual([['t0'], ['t1', 'huella']]);
    expect(moved).toHaveBeenCalled(); // el tramo de movimiento, ya en el reto
    await stable();
    await stable();
    await stable();
    expect(take).toHaveBeenCalledWith(SPEC);
    const captured = flow.onSubmit.mock.calls[0][0];
    expect(captured).toMatchObject({ flashReceipt: 'comprobante', burst: sheet });
    expect(captured.flash).toHaveLength(1);
  });

  it('sin hoja (no la pidió el reto o no alcanzó) se envía lo demás', async () => {
    vi.spyOn(pacing.flashPacingService, 'step').mockRejectedValue(new Error('Canal en tiempo real no disponible'));
    vi.spyOn(pacing.flashPacingService, 'fallbackColors').mockResolvedValue(['#FF0000']);
    serve({ challenge: () => apiOk({ ...PACED, burst: null }) });
    renderFlow();
    await stable(baseline);
    await advance(settle);
    await stable();
    await stable();
    await stable();
    const captured = flow.onSubmit.mock.calls[0][0];
    expect(captured.flash).toHaveLength(1);
    expect(captured).not.toHaveProperty('burst');
    expect(captured.flashReceipt).toBeUndefined(); // el destello de siempre: sin comprobante
  });
});
