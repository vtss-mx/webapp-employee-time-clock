import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALES, setLocale, t } from '../i18n';
import { ApiError } from '../services/apiClient';
import { verificationSessionService } from '../services/verificationSessionService';
import type { ConfirmSource } from '../types/confirm';
import { useVerificationSession } from './useVerificationSession';

const confirmation = vi.hoisted(() => ({ ask: vi.fn<(source: ConfirmSource) => Promise<boolean>>() }));
vi.mock('./useConfirm', () => ({ useConfirm: () => confirmation.ask }));
const id = 's'.repeat(64);
const session = {
  id, execution_status: 'READY' as const, decision_status: null, attempt_id: null, device_nonce: null,
  created_at: '2026-10-10T22:00:00Z', expires_at: '2026-10-10T22:01:00Z',
  policy_version: 'p'.repeat(64), flow_version: 'test-protocol',
};

beforeEach(() => {
  confirmation.ask.mockReset().mockResolvedValue(true);
  vi.spyOn(verificationSessionService, 'read').mockResolvedValue(session);
  vi.spyOn(verificationSessionService, 'cancel').mockResolvedValue({ ...session, execution_status: 'CANCELLED' });
});
afterEach(async () => { vi.restoreAllMocks(); await setLocale('es-MX'); });

describe('useVerificationSession', () => {
  it('sin reto no consulta ni cancela y un id inválido es un error de contrato', async () => {
    const { result } = renderHook(() => useVerificationSession('Captura de prueba'));
    result.current.bind(undefined);
    await expect(result.current.ready()).resolves.toBeUndefined();
    await expect(result.current.cancel()).resolves.toBe(true);
    result.current.bind(null);
    expect(() => result.current.bind('short')).toThrow(expect.objectContaining({ code: 'INVALID_RESPONSE' }));
    expect(verificationSessionService.read).not.toHaveBeenCalled();
    expect(confirmation.ask).not.toHaveBeenCalled();
  });

  it('consulta READY antes de permitir el envío; rechaza estados terminales o iniciados', async () => {
    const { result } = renderHook(() => useVerificationSession('Captura de prueba'));
    result.current.bind(id);
    await expect(result.current.ready()).resolves.toBeUndefined();
    for (const execution_status of ['EXPIRED', 'CANCELLED', 'PROCESSING', 'COMPLETED'] as const) {
      vi.mocked(verificationSessionService.read).mockResolvedValue({ ...session, execution_status });
      await expect(result.current.ready()).rejects.toMatchObject({
        code: execution_status === 'EXPIRED' || execution_status === 'CANCELLED' ? 'CHALLENGE_INVALID' : 'VERIFICATION_SESSION_UNAVAILABLE',
      });
    }
    const error: unknown = await result.current.ready().catch((value: unknown) => value);
    expect(error).toHaveProperty('message', t('face.session.alreadyStarted'));
  });

  it('declinar la confirmación no lee ni modifica la sesión', async () => {
    confirmation.ask.mockResolvedValue(false);
    const { result } = renderHook(() => useVerificationSession('Captura de prueba'));
    result.current.bind(id);
    await expect(result.current.cancel()).resolves.toBe(false);
    expect(verificationSessionService.read).not.toHaveBeenCalled();
    expect(verificationSessionService.cancel).not.toHaveBeenCalled();
  });

  it.each(['READY', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as const)('cancelar desde %s usa el estado fresco', async (execution_status) => {
    vi.mocked(verificationSessionService.read).mockResolvedValue({ ...session, execution_status });
    const { result } = renderHook(() => useVerificationSession('Captura de prueba'));
    result.current.bind(id);
    await expect(result.current.cancel()).resolves.toBe(true);
    expect(verificationSessionService.read).toHaveBeenCalledWith(id);
    expect(verificationSessionService.cancel).toHaveBeenCalledTimes(execution_status === 'READY' || execution_status === 'PROCESSING' ? 1 : 0);
  });

  it('doble cancelación comparte trabajo y el envío espera la respuesta de la confirmación', async () => {
    let decide: (value: boolean) => void = () => undefined;
    confirmation.ask.mockReturnValue(new Promise((resolve) => { decide = resolve; }));
    const { result } = renderHook(() => useVerificationSession('Captura de prueba'));
    result.current.bind(id);
    const first = result.current.cancel();
    expect(result.current.cancel()).toBe(first);
    const ready = result.current.ready();
    expect(verificationSessionService.read).not.toHaveBeenCalled();
    decide(false);
    await expect(first).resolves.toBe(false);
    await expect(ready).resolves.toBeUndefined();
    expect(verificationSessionService.read).toHaveBeenCalledTimes(1);
  });

  it('espera el reto en vuelo para cancelar su sesión emitida y atiende una falla de emisión', async () => {
    let issue: () => void = () => undefined;
    const { result } = renderHook(() => useVerificationSession('Captura de prueba'));
    const pending = new Promise<void>((resolve) => { issue = () => { result.current.bind(id); resolve(); }; });
    result.current.track(pending);
    const cancellation = result.current.cancel();
    expect(confirmation.ask).not.toHaveBeenCalled();
    issue();
    await expect(cancellation).resolves.toBe(true);
    expect(verificationSessionService.cancel).toHaveBeenCalledWith(id);
    const failure = Promise.reject(new ApiError({ statusCode: 503, code: 'SERVER_BUSY', message: '' }));
    result.current.track(failure);
    await expect(result.current.cancel()).rejects.toMatchObject({ code: 'SERVER_BUSY' });
  });

  it('una emisión sin sesión no modifica nada y una emisión vieja no borra la nueva en vuelo', async () => {
    let finish: () => void = () => undefined;
    const { result } = renderHook(() => useVerificationSession('Captura de prueba'));
    result.current.track(Promise.resolve());
    const next = new Promise<void>((resolve) => { finish = resolve; });
    result.current.track(next);
    const cancellation = result.current.cancel();
    await act(async () => { await Promise.resolve(); });
    expect(confirmation.ask).not.toHaveBeenCalled();
    finish();
    await expect(cancellation).resolves.toBe(true);
    expect(verificationSessionService.read).not.toHaveBeenCalled();
  });

  it('la falla de cancelación se propaga y permite otro intento sin una promesa rechazada suelta', async () => {
    vi.mocked(verificationSessionService.cancel).mockRejectedValueOnce(new ApiError({ statusCode: 503, code: 'SERVER_BUSY', message: '' }));
    const { result } = renderHook(() => useVerificationSession('Captura de prueba'));
    result.current.bind(id);
    await expect(result.current.cancel()).rejects.toMatchObject({ code: 'SERVER_BUSY' });
    await expect(result.current.cancel()).resolves.toBe(true);
  });

  it('confirmación abierta y errores locales siguen los siete idiomas y el título actualizado', async () => {
    confirmation.ask.mockResolvedValue(false);
    const { result, rerender } = renderHook(({ title }) => useVerificationSession(title), { initialProps: { title: 'Inicial' } });
    result.current.bind(id);
    await result.current.cancel();
    const source = confirmation.ask.mock.calls[0][0];
    expect(typeof source).toBe('function');
    rerender({ title: 'Actualizado' });
    vi.mocked(verificationSessionService.read).mockResolvedValue({ ...session, execution_status: 'EXPIRED' });
    const error: unknown = await result.current.ready().catch((value: unknown) => value);
    for (const locale of LOCALES) {
      await setLocale(locale);
      const content = typeof source === 'function' ? source() : source;
      expect(content.title).toBe(t('face.session.cancelTitle'));
      expect(content.details).toEqual([{ label: t('face.session.capture'), value: 'Actualizado' }]);
      expect(content.confirmLabel).toBe(t('face.session.cancelConfirm'));
      expect(content.cancelLabel).toBe(t('face.session.continue'));
      expect(error).toHaveProperty('message', t('face.session.noLongerActive'));
    }
  });

  it('cerrar se ejecuta una vez, declinar mantiene el flujo y los errores se entregan al dueño', async () => {
    const onClose = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(() => useVerificationSession('Captura de prueba'));
    result.current.bind(id);
    result.current.close(onClose, onError);
    result.current.close(onClose, onError);
    await act(async () => { await Promise.resolve(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    confirmation.ask.mockResolvedValue(false);
    result.current.close(onClose, onError);
    await act(async () => { await Promise.resolve(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    confirmation.ask.mockResolvedValue(true);
    vi.mocked(verificationSessionService.read).mockRejectedValue(new ApiError({ statusCode: 503, code: 'SERVER_BUSY', message: '' }));
    result.current.close(onClose, onError);
    await act(async () => { await Promise.resolve(); });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'SERVER_BUSY' }));
  });

  it.each([false, true])('un flujo desmontado no cierra ni avisa otra pantalla (falla=%s)', async (fail) => {
    let decide: (value: boolean) => void = () => undefined;
    confirmation.ask.mockReturnValue(new Promise((resolve) => { decide = resolve; }));
    if (fail) vi.mocked(verificationSessionService.read).mockRejectedValue(new Error('Falló la lectura ficticia'));
    const onClose = vi.fn();
    const onError = vi.fn();
    const { result, unmount } = renderHook(() => useVerificationSession('Captura de prueba'));
    result.current.bind(id);
    result.current.close(onClose, onError);
    unmount();
    decide(true);
    await act(async () => { await Promise.resolve(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
