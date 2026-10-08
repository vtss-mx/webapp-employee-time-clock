import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { FeedbackContext, type ErrorMessageOptions, type FeedbackApi } from '../context/FeedbackContext';
import { ApiError } from '../services/apiClient';

export function useFeedback(): FeedbackApi {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('FEEDBACK_PROVIDER_MISSING');
  return context;
}

/** Misma falla (mismo código y estado), mismo popup: dos cargas que caen juntas no abren dos. */
function loadErrorKey(error: unknown): string {
  return error instanceof ApiError ? `load:${error.code}:${error.status}` : `load:${String(error)}`;
}

/**
 * Muestra en popup el error de carga de una pantalla cada vez que aparece uno nuevo
 * (`error` pasa de null a un valor). Pensado para estados `error` de peticiones de lectura. Si la
 * carga se recupera sola (p. ej. al volver la red) el popup se cierra: ya no hay nada que avisar.
 */
export function useErrorPopup(error: unknown, options: ErrorMessageOptions = {}): void {
  const feedback = useFeedback();
  // Las opciones (p. ej. retry) cambian en cada render; solo un error nuevo abre el popup.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    if (!error) return;
    const key = loadErrorKey(error);
    void feedback.fromError(error, { ...latest.current, key });
    return () => feedback.dismiss(key);
  }, [error, feedback]);
}
