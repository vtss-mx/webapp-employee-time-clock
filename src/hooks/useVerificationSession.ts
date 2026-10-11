import { useCallback, useRef } from 'react';
import { t } from '../i18n';
import { ApiError } from '../services/apiClient';
import { verificationSessionService } from '../services/verificationSessionService';
import { useConfirm } from './useConfirm';
import { useMountedRef } from './useMountedRef';

/** Vigencia del servidor antes de enviar y cancelación confirmada; sin sondeos ni identidades en disco. */
export function useVerificationSession(title: string) {
  const confirm = useConfirm();
  const id = useRef<string | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;
  const pendingCancel = useRef<Promise<boolean> | null>(null);
  const pendingChallenge = useRef<Promise<unknown> | null>(null);
  const closing = useRef(false);
  const mounted = useMountedRef();

  const track = useCallback((pending: Promise<unknown>) => {
    pendingChallenge.current = pending;
    void pending.finally(() => {
      if (pendingChallenge.current === pending) pendingChallenge.current = null;
    }).catch(() => undefined);
  }, []);

  const bind = useCallback((sessionId: string | null | undefined) => {
    if (sessionId != null && sessionId.length !== 64) {
      throw new ApiError({ statusCode: 502, code: 'INVALID_RESPONSE', message: '' });
    }
    id.current = sessionId ?? null;
  }, []);

  const ready = useCallback(async () => {
    if (pendingCancel.current) await pendingCancel.current;
    const sessionId = id.current;
    if (!sessionId) return;
    const current = await verificationSessionService.read(sessionId);
    if (current.execution_status === 'READY') return;
    const expired = current.execution_status === 'EXPIRED' || current.execution_status === 'CANCELLED';
    const error = new ApiError({
      statusCode: expired ? 422 : 409,
      code: expired ? 'CHALLENGE_INVALID' : 'VERIFICATION_SESSION_UNAVAILABLE',
      message: '',
    });
    Object.defineProperty(error, 'message', {
      get: () => t(expired ? 'face.session.noLongerActive' : 'face.session.alreadyStarted'), configurable: true,
    });
    throw error;
  }, []);

  const cancel = useCallback((): Promise<boolean> => {
    if (pendingCancel.current) return pendingCancel.current;
    if (!id.current && !pendingChallenge.current) return Promise.resolve(true);
    const work = (async () => {
      if (pendingChallenge.current) await pendingChallenge.current;
      const sessionId = id.current;
      if (!sessionId) return true;
      const accepted = await confirm(() => ({
        kind: 'action', tone: 'warning',
        title: t('face.session.cancelTitle'),
        message: t('face.session.cancelMessage'),
        details: [{ label: t('face.session.capture'), value: titleRef.current }],
        confirmLabel: t('face.session.cancelConfirm'),
        cancelLabel: t('face.session.continue'),
      }));
      if (!accepted) return false;
      // Consulta fresca: también reconoce una decisión que terminó mientras el popup estaba abierto.
      const current = await verificationSessionService.read(sessionId);
      if (current.execution_status === 'READY' || current.execution_status === 'PROCESSING') {
        await verificationSessionService.cancel(sessionId);
      }
      return true;
    })();
    pendingCancel.current = work;
    void work.finally(() => { pendingCancel.current = null; }).catch(() => undefined);
    return work;
  }, [confirm]);

  const close = useCallback((onClose: () => void, onError: (error: unknown) => void) => {
    if (closing.current) return;
    closing.current = true;
    void cancel().then((accepted) => {
      if (accepted && mounted.current) onClose();
    }).catch((error: unknown) => { if (mounted.current) onError(error); })
      .finally(() => { closing.current = false; });
  }, [cancel, mounted]);

  return { bind, track, ready, cancel, close };
}
