import { useCallback, useSyncExternalStore } from 'react';

/**
 * ¿Se cumple una consulta de medios (`(max-width: 520px)`)? Se redibuja al cambiar (girar el teléfono, cambiar el
 * tamaño de la ventana). Sin `matchMedia` (un entorno sin ventana) es `false`. Para lo que el CSS no puede decidir:
 * una medida que calcula el código (el ancho mínimo de una lista flotante).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia?.(query);
      if (!media) return () => undefined;
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(query).matches ?? false);
}
