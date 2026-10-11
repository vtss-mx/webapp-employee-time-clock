import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, flow, renderFlow, resetFaceFlow, serve, stable, TWO_TURNS } from '../test/faceFlow';
import { apiOk } from '../test/http';
import type { FaceChallenge } from '../types';
import { config } from '../utils/config';

/*
 * Destello dictado por el servidor (restaurado el 2026-10-08 como interruptor del ADMIN, apagado por omisión): lo dispara
 * el RETO (`flash_pace` dictado o `flash` en claro), entre el fin de la prueba de vida y el envío. Sin uno ni otro, la
 * pantalla nunca se pinta (el camino por omisión, que el dueño exige libre de destellos). El canal (`flashPacingService`)
 * se simula; la cámara, MediaPipe y la ráfaga también.
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));
vi.mock('../hooks/useFaceBurst', () => ({
  useFaceBurst: () => ({ start: () => undefined, move: () => undefined, pause: () => undefined, reset: () => undefined, settle: () => Promise.resolve(), take: () => Promise.resolve(null), subscribe: () => () => undefined, held: () => 0 }),
}));

const pace = vi.hoisted(() => ({ available: true, step: vi.fn(), fallbackColors: vi.fn() }));
vi.mock('../services/flashPacingService', () => ({ flashPacingService: pace }));
const digest = vi.hoisted(() => ({ sha256Hex: vi.fn() }));
// WebCrypto tiene su propia cola: avanzar el reloj simulado no espera su digest. La utilidad
// criptográfica tiene pruebas reales propias; aquí se controla su promesa, igual que cámara y canal.
vi.mock('../utils/digest', () => digest);

const HOLD = config.faceFlashHoldMs;
const DICTATED: FaceChallenge = { ...TWO_TURNS, flash: [], flash_pace: { token: 't0', total: 2, window_ms: 2000 } };
const OPEN: FaceChallenge = { ...TWO_TURNS, flash: ['#AAAAAA'], flash_pace: null };
const color = (hex: string, token: string) => ({ done: false, color: { step: 0, total: 2, color: hex, token, window_ms: 2000 } });
const overlay = () => document.querySelector('.flash');

/** Las dos vueltas del reto de verificación hasta el envío (dos movimientos). */
async function throughChallenge() {
  await stable(); // frontal → primer movimiento
  await stable(); // movimiento 1 → vuelta al frente
  await stable(); // vuelta al frente → movimiento 2
  await stable(); // movimiento 2 → fin de la prueba de vida (empieza el destello, si lo hay)
}

beforeEach(() => {
  resetFaceFlow();
  pace.available = true;
  pace.step.mockReset();
  pace.fallbackColors.mockReset();
  digest.sha256Hex.mockReset().mockResolvedValue('a'.repeat(64));
});
afterEach(() => vi.useRealTimers());

describe('LiveFaceFlow: destello dictado por el servidor', () => {
  it('tras la prueba de vida pinta cada color, lo captura y envía las capturas con el comprobante', async () => {
    pace.step.mockResolvedValueOnce(color('#FF0000', 't1')).mockResolvedValueOnce(color('#00FF00', 't2')).mockResolvedValueOnce({ done: true, receipt: 'rcpt-9' });
    serve({ challenge: () => apiOk(DICTATED) });
    renderFlow();
    await throughChallenge();
    expect(overlay()).not.toBeNull(); // la pantalla se pinta durante el destello
    await advance(HOLD); // segundo color
    await advance(HOLD); // último color → comprobante → envío
    expect(overlay()).toBeNull(); // deja de pintar al terminar
    expect(flow.onSubmit).toHaveBeenCalledTimes(1);
    const captured = flow.onSubmit.mock.calls[0][0];
    expect(captured.flashImage).toHaveLength(2);
    expect(captured.flashReceipt).toBe('rcpt-9');
    expect(pace.step).toHaveBeenNthCalledWith(1, 't0'); // el primer color sin huella
    expect(pace.step.mock.calls[1][0]).toBe('t1');
    expect(pace.step).toHaveBeenNthCalledWith(2, 't1', 'a'.repeat(64));
    expect(pace.step).toHaveBeenNthCalledWith(3, 't2', 'a'.repeat(64));
  });

  it('espera la huella pendiente antes de pedir otro color y enviar el intento', async () => {
    let finishDigest!: (hex: string) => void;
    digest.sha256Hex.mockImplementationOnce(() => new Promise<string>((resolve) => { finishDigest = resolve; }));
    pace.step.mockResolvedValueOnce(color('#FF0000', 't1')).mockResolvedValueOnce(color('#00FF00', 't2')).mockResolvedValueOnce({ done: true, receipt: 'rcpt-delayed' });
    serve({ challenge: () => apiOk(DICTATED) });
    renderFlow();
    await throughChallenge();
    await advance(HOLD);
    // Reproduce la carrera anterior sin depender de carga de CPU ni agregar tiempo al test:
    // el reloj del color venció, pero el trabajo criptográfico todavía no terminó.
    expect(overlay()).not.toBeNull();
    expect(pace.step).toHaveBeenCalledTimes(1);
    expect(flow.onSubmit).not.toHaveBeenCalled();
    await act(() => { finishDigest('b'.repeat(64)); return Promise.resolve(); });
    expect(pace.step).toHaveBeenNthCalledWith(2, 't1', 'b'.repeat(64));
    await advance(HOLD);
    expect(overlay()).toBeNull();
    expect(flow.onSubmit).toHaveBeenCalledTimes(1);
    expect(flow.onSubmit.mock.calls[0][0].flashReceipt).toBe('rcpt-delayed');
  });

  it('modo de respaldo en claro (el reto trae `flash`): pinta cada color y envía SIN comprobante', async () => {
    serve({ challenge: () => apiOk(OPEN) });
    renderFlow();
    await throughChallenge();
    expect(overlay()).not.toBeNull();
    await advance(HOLD);
    expect(flow.onSubmit).toHaveBeenCalledTimes(1);
    const captured = flow.onSubmit.mock.calls[0][0];
    expect(captured.flashImage).toHaveLength(1);
    expect(captured).not.toHaveProperty('flashReceipt');
    expect(pace.step).not.toHaveBeenCalled(); // sin dictado no se usa el canal
  });

  it('sin destello dictado por el reto la pantalla nunca se pinta ni viajan capturas de color (por omisión)', async () => {
    serve({ challenge: () => apiOk(TWO_TURNS) });
    renderFlow();
    await throughChallenge();
    expect(overlay()).toBeNull();
    expect(flow.onSubmit).toHaveBeenCalledTimes(1);
    const captured = flow.onSubmit.mock.calls[0][0];
    expect(captured).not.toHaveProperty('flashImage');
    expect(captured).not.toHaveProperty('flashReceipt');
    expect(pace.step).not.toHaveBeenCalled();
    expect(pace.fallbackColors).not.toHaveBeenCalled();
  });
});
