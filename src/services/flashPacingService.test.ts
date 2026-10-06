import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { flashPacingService, sha256Hex } from './flashPacingService';
import type { ApiEnvelope } from './http/envelope';
import { validationSocket } from './realtime/validationSocket';

const reply = (code: string, data: unknown, statusCode = 200): ApiEnvelope => ({
  success: statusCode < 300,
  statusCode,
  code,
  message: code,
  data,
  errors: statusCode < 300 ? [] : [{ code, message: code, field: null, details: null }],
  traceId: 'flash-1',
  timestamp: null,
});

afterEach(() => vi.restoreAllMocks());

describe('destello dictado por el servidor (antifraude 2a)', () => {
  it('pide cada color por el canal en vivo y recibe el comprobante tras el último', async () => {
    const request = vi.spyOn(validationSocket, 'request');
    request.mockResolvedValueOnce(reply('FLASH_COLOR', { color: '#FF0000', token: 't1', step: 0, total: 2, window_ms: 2000 }));
    expect(await flashPacingService.step('t0')).toEqual({ kind: 'color', color: '#FF0000', token: 't1', step: 0, total: 2, window_ms: 2000 });
    expect(request).toHaveBeenLastCalledWith({ type: 'flash', token: 't0' }); // sin huella: el primero
    request.mockResolvedValueOnce(reply('FLASH_DONE', { receipt: 'comprobante' }));
    expect(await flashPacingService.step('t1', 'abc')).toEqual({ kind: 'done', receipt: 'comprobante' });
    expect(request).toHaveBeenLastCalledWith({ type: 'flash', token: 't1', digest: 'abc' });
  });

  it('un rechazo del servidor sube como ApiError y una respuesta extraña como error', async () => {
    const request = vi.spyOn(validationSocket, 'request');
    request.mockResolvedValueOnce(reply('FLASH_TOKEN_INVALID', null, 422));
    await expect(flashPacingService.step('t0')).rejects.toMatchObject({ name: 'ApiError', code: 'FLASH_TOKEN_INVALID' });
    request.mockResolvedValueOnce(reply('FLASH_COLOR', { color: 7 }));
    await expect(flashPacingService.step('t0')).rejects.toThrow('Respuesta inesperada');
    request.mockResolvedValueOnce(reply('FLASH_DONE', {}));
    await expect(flashPacingService.step('t0')).rejects.toThrow('Respuesta inesperada');
    request.mockResolvedValueOnce(reply('PONG', { receipt: 'x' }));
    await expect(flashPacingService.step('t0')).rejects.toThrow('Respuesta inesperada');
  });

  it('sin canal pide los colores de siempre por HTTP', async () => {
    const { calls } = mockFetch(apiOk({ flash: ['#FF0000', '#00FF00'] }), apiFail(422, 'FLASH_TOKEN_INVALID'), apiOk({ flash: [1] }));
    expect(await flashPacingService.fallbackColors('t0')).toEqual(['#FF0000', '#00FF00']);
    expect(calls[0].url).toContain('/face/challenge/flash');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ token: 't0' });
    await expect(flashPacingService.fallbackColors('t0')).rejects.toMatchObject({ code: 'FLASH_TOKEN_INVALID' });
    await expect(flashPacingService.fallbackColors('t0')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('la huella de una captura es su SHA-256 en hexadecimal', async () => {
    expect(await sha256Hex(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
