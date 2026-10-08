import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiOk, apiFail, mockFetch } from '../test/http';
import { ApiError, configureApiClient } from './apiClient';
import { flashPacingService } from './flashPacingService';

/*
 * Cliente del destello dictado por el servidor: cada paso por el canal en vivo (reutilizado, nunca un segundo socket) y
 * el respaldo por HTTP cuando no hay canal. El canal se simula con un doble de `validationSocket`.
 */

const socket = vi.hoisted(() => ({ available: true, request: vi.fn<(message: Record<string, unknown>) => Promise<unknown>>() }));
vi.mock('./realtime/validationSocket', () => ({ validationSocket: socket }));

/** Un sobre del canal como el que entrega `validationSocket.request` (contrato único). */
const reply = (code: string, data: unknown, success = true) => ({ success, statusCode: success ? 200 : 422, code, message: code, data, errors: success ? [] : [{ code, message: code, field: null, details: null }], traceId: null, timestamp: null });

beforeEach(() => {
  socket.available = true;
  socket.request.mockReset();
  configureApiClient({ getToken: () => 'tok', onUnauthorized: vi.fn(), refreshSession: () => Promise.resolve(true) });
});
afterEach(() => vi.restoreAllMocks());

describe('flashPacingService.step', () => {
  it('pide el primer color sin huella y lo devuelve (FLASH_COLOR)', async () => {
    socket.request.mockResolvedValueOnce(reply('FLASH_COLOR', { step: 0, total: 2, color: '#FF0000', token: 't1', window_ms: 2000 }));
    const result = await flashPacingService.step('t0');
    expect(socket.request).toHaveBeenCalledWith({ type: 'flash', token: 't0' });
    expect(result).toEqual({ done: false, color: { step: 0, total: 2, color: '#FF0000', token: 't1', window_ms: 2000 } });
  });

  it('confirma un color con su huella y entrega el comprobante tras el último (FLASH_DONE)', async () => {
    socket.request.mockResolvedValueOnce(reply('FLASH_DONE', { receipt: 'rcpt-1' }));
    const result = await flashPacingService.step('t2', 'abc123');
    expect(socket.request).toHaveBeenCalledWith({ type: 'flash', token: 't2', digest: 'abc123' });
    expect(result).toEqual({ done: true, receipt: 'rcpt-1' });
  });

  it('un sobre de error (token inválido) se vuelve ApiError', async () => {
    socket.request.mockResolvedValueOnce(reply('FLASH_TOKEN_INVALID', null, false));
    await expect(flashPacingService.step('t0')).rejects.toBeInstanceOf(ApiError);
  });

  it('un código o datos inesperados fallan (nunca se interpreta algo que no es el destello)', async () => {
    socket.request.mockResolvedValueOnce(reply('PONG', {}));
    await expect(flashPacingService.step('t0')).rejects.toThrow('FLASH_BAD_RESPONSE');
    socket.request.mockResolvedValueOnce(reply('FLASH_COLOR', { step: 0 })); // sin color/token
    await expect(flashPacingService.step('t0')).rejects.toThrow('FLASH_BAD_RESPONSE');
    socket.request.mockResolvedValueOnce(reply('FLASH_DONE', {})); // sin comprobante
    await expect(flashPacingService.step('t0')).rejects.toThrow('FLASH_BAD_RESPONSE');
  });
});

describe('flashPacingService.available', () => {
  it('refleja la disponibilidad del canal en vivo', () => {
    socket.available = true;
    expect(flashPacingService.available).toBe(true);
    socket.available = false;
    expect(flashPacingService.available).toBe(false);
  });
});

describe('flashPacingService.fallbackColors (respaldo HTTP)', () => {
  it('pide los colores de siempre con el token inicial y los devuelve', async () => {
    const { calls } = mockFetch(apiOk({ flash: ['#FF0000', '#00FF00'] }));
    const colors = await flashPacingService.fallbackColors('t0');
    expect(colors).toEqual(['#FF0000', '#00FF00']);
    expect(calls[0].url).toContain('/face/challenge/flash');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ token: 't0' });
  });

  it('propaga el error del servidor (token inválido)', async () => {
    mockFetch(apiFail(422, 'FLASH_TOKEN_INVALID'));
    await expect(flashPacingService.fallbackColors('t0')).rejects.toBeInstanceOf(ApiError);
  });
});
