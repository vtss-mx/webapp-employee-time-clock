import { useEffect, useRef, type RefObject } from 'react';

/**
 * `true` mientras el componente está montado: las tareas asíncronas (peticiones, esperas) lo
 * consultan antes de actualizar el estado de una pantalla que ya se cerró.
 *
 * Se vuelve a marcar en CADA montaje: en desarrollo, React (StrictMode) monta, desmonta y vuelve
 * a montar; si solo se apagara al desmontar, la marca quedaría en `false` para siempre y el flujo
 * ignoraría las respuestas (p. ej. el escáner facial se quedaba en "Analizando…").
 */
export function useMountedRef(): RefObject<boolean> {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
