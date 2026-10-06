import { useEffect, useState } from 'react';
import { avatarPath, avatarService } from '../services/avatarService';
import type { AvatarSize } from '../types/avatar';
import { acquireAvatar, releaseAvatar } from '../utils/avatarCache';

/**
 * ¿El elemento ya se vio en pantalla? (carga diferida: una lista larga solo pide las fotos de las filas que se
 * ven). Una vez visible se queda así. Sin `IntersectionObserver` (navegadores viejos) cuenta como visible.
 * `element` llega por una referencia de función (`ref={setElement}`): null hasta montarse.
 */
export function useInView(element: Element | null, enabled: boolean): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!enabled || seen || !element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver((records) => setSeen((was) => was || records.some((record) => record.isIntersecting)), {
      rootMargin: '200px',
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, enabled, seen]);
  return seen;
}

/**
 * La URL local (`blob:`) de una foto de perfil, o null mientras no llega o si no se pudo leer: entonces se ven
 * las iniciales. Comparte la descarga con los demás avatares de la misma foto (`avatarCache`) y la cancela si
 * el avatar sale de la pantalla antes de recibirla.
 */
export function useAvatarImage(src: string | null | undefined, size: AvatarSize, visible: boolean): string | null {
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!src || !visible) return;
    const key = avatarPath(src, size);
    let active = true;
    acquireAvatar(key, (signal) => avatarService.image(src, size, signal)).then(
      (url) => {
        if (active) setLoaded({ key, url });
      },
      // La foto es accesoria: si no llega (sin red, bucket caído, sin permiso) se quedan las iniciales, sin
      // popup. El servidor ya registró sus fallas.
      () => undefined,
    );
    return () => {
      active = false;
      releaseAvatar(key);
    };
  }, [src, size, visible]);
  return loaded && src && loaded.key === avatarPath(src, size) ? loaded.url : null;
}
