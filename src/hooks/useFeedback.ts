import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { FeedbackContext, type ErrorMessageOptions, type FeedbackApi } from '../context/FeedbackContext';

export function useFeedback(): FeedbackApi {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback debe usarse dentro de <FeedbackProvider>');
  return context;
}

/**
 * Muestra en popup el error de carga de una pantalla cada vez que aparece uno nuevo
 * (`error` pasa de null a un valor). Pensado para estados `error` de peticiones de lectura.
 */
export function useErrorPopup(error: unknown, options: ErrorMessageOptions = {}): void {
  const feedback = useFeedback();
  // Las opciones (p. ej. retry) cambian en cada render; solo un error nuevo abre el popup.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    if (error) void feedback.fromError(error, latest.current);
  }, [error, feedback]);
}
