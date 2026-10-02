import { useEffect } from 'react';
import { useFeedback } from '../hooks/useFeedback';
import { ApiError } from '../services/apiClient';

const GENERIC_TEXT = 'Intenta nuevamente. Si persiste, recarga la página.';

/**
 * Red de seguridad para errores asíncronos no capturados (promesas rechazadas, errores de
 * scripts): se muestran en el popup de mensajes en lugar de fallar en silencio.
 */
export function GlobalErrorHandler() {
  const feedback = useFeedback();

  useEffect(() => {
    let last = 0;
    const notify = (error: unknown) => {
      const now = Date.now();
      if (now - last < 4000) return; // evita ráfagas de mensajes
      last = now;
      // Los errores de la API llevan su mensaje y código de rastreo; los demás, un texto amable.
      void feedback.fromError(error instanceof ApiError ? error : new Error(GENERIC_TEXT), { title: 'Ocurrió un problema' });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      console.error('[unhandledrejection]', reason);
      notify(reason);
    };
    const onError = (event: ErrorEvent) => {
      // Errores de recursos externos/ResizeObserver no afectan la operación.
      if (!event.error || /ResizeObserver/.test(event.message)) return;
      console.error('[error]', event.error);
      notify(event.error);
    };
    // Vite: falla al precargar un módulo tras una nueva publicación → recargar.
    const onPreloadError = () => window.location.reload();

    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    window.addEventListener('vite:preloadError', onPreloadError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
      window.removeEventListener('vite:preloadError', onPreloadError);
    };
  }, [feedback]);

  return null;
}
