import { useEffect } from 'react';
import { useFeedback } from '../hooks/useFeedback';
import { ApiError } from '../services/apiClient';
import { reportClientError } from '../services/clientErrorService';
import { reloadForNewVersion } from '../services/versionReload';

const GENERIC_TEXT = 'Intenta nuevamente. Si persiste, recarga la página.';

/**
 * Red de seguridad para errores asíncronos no capturados (promesas rechazadas, errores de
 * scripts): se muestran en el popup de mensajes en lugar de fallar en silencio. Si es una falla de
 * la app (no una respuesta de la API, un permiso, la red o una cancelación: lo decide
 * `reportClientError`), además se reporta al ADMIN ("Errores del sistema").
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
      void reportClientError({ kind: 'UNHANDLED', error: reason, component: 'unhandledrejection' });
      notify(reason);
    };
    const onError = (event: ErrorEvent) => {
      // Errores de recursos externos/ResizeObserver no afectan la operación.
      if (!event.error || /ResizeObserver/.test(event.message)) return;
      console.error('[error]', event.error);
      void reportClientError({ kind: 'UNHANDLED', error: event.error, component: 'window.onerror' });
      notify(event.error);
    };
    // Vite no pudo descargar un módulo (pantalla, detector facial, generador de QR). Se recarga solo
    // si ya se publicó una versión nueva, y una vez (`reloadForNewVersion`). El error sigue su curso
    // hasta quien importó el módulo: la pantalla ofrece "Reintentar" y el detector pasa a captura
    // manual. Sin preventDefault(): con él, Vite se traga el error y la importación devuelve undefined.
    const onPreloadError = () => void reloadForNewVersion();

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
