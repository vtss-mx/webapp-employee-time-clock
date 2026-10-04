import { useEffect } from 'react';
import { ApiError } from '../services/apiClient';

/**
 * Lo que no se pudo cargar por falta de conexión (o servidor caído) se vuelve a pedir solo al
 * recuperar la red (evento `online`): así se cumple lo que promete el aviso "Sin conexión" sin que
 * la persona tenga que pulsar "Reintentar". Otros errores (permiso, no encontrado...) no se repiten:
 * darían el mismo resultado y otro popup.
 */
export function useRetryOnReconnect(error: unknown, retry: () => void): void {
  const offline = error instanceof ApiError && error.isTransient;
  useEffect(() => {
    if (!offline) return;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [offline, retry]);
}
