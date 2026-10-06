import { config } from './config';

/**
 * Fotos de perfil ya descargadas en esta página, como URLs `blob:` locales (la etiqueta `<img>` no puede mandar
 * la sesión, así que la foto se pide por la API con `fetch` y se muestra desde memoria).
 *
 * - La llave es la ruta versionada + el tamaño: una foto nueva es otra llave (nunca se muestra la anterior).
 * - Cuenta quién la usa: dos avatares de la misma persona comparten una descarga y una URL.
 * - Las que ya nadie muestra se conservan (para volver a una pantalla sin descargar) hasta
 *   `config.avatarCacheEntries`; las más viejas se liberan (`revokeObjectURL`). Las visibles nunca.
 * - Si nadie la espera, una descarga en curso se cancela (salir de una lista no deja peticiones colgadas).
 * - Al cerrar sesión se vacía (`clearAvatarCache`): nada de la persona queda en la página.
 * Solo memoria de la pestaña: nada en `localStorage`, `sessionStorage` ni IndexedDB.
 */

interface Entry {
  refs: number;
  url: string | null;
  promise: Promise<string>;
  controller: AbortController;
}

const entries = new Map<string, Entry>();

/** La entrada pasa al final (la más reciente): el orden del `Map` es el de uso. */
function touch(key: string, entry: Entry): void {
  entries.delete(key);
  entries.set(key, entry);
}

/** Libera las que nadie muestra, de la más vieja a la más nueva, hasta quedar en el tope. */
function trim(): void {
  // Sin usar solo quedan las ya descargadas (una que se descargaba se cancela al dejar de usarse).
  const idle = [...entries].filter((pair): pair is [string, Entry & { url: string }] => pair[1].refs === 0 && pair[1].url !== null);
  for (const [key, entry] of idle.slice(0, Math.max(0, idle.length - config.avatarCacheEntries))) {
    entries.delete(key);
    URL.revokeObjectURL(entry.url);
  }
}

/**
 * Pide la foto `key` (la descarga con `load` si aún no está) y la marca en uso: cada `acquireAvatar` lleva su
 * `releaseAvatar`. Se resuelve con la URL `blob:`; si la descarga falla, la entrada se olvida (otro intento la
 * vuelve a pedir) y la promesa se rechaza.
 */
export function acquireAvatar(key: string, load: (signal: AbortSignal) => Promise<Blob>): Promise<string> {
  const known = entries.get(key);
  if (known) {
    known.refs += 1;
    touch(key, known);
    return known.promise;
  }
  const controller = new AbortController();
  const entry: Entry = { refs: 1, url: null, controller, promise: Promise.resolve('') };
  entry.promise = load(controller.signal).then(
    (blob) => {
      entry.url = URL.createObjectURL(blob);
      return entry.url;
    },
    (error: unknown) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    },
  );
  entries.set(key, entry);
  return entry.promise;
}

/** Ya no se muestra: si nadie más la usa, queda guardada (o, si seguía descargándose, se cancela). */
export function releaseAvatar(key: string): void {
  const entry = entries.get(key);
  if (!entry || entry.refs === 0) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  if (entry.url === null) {
    entries.delete(key);
    entry.controller.abort();
    return;
  }
  trim();
}

/** Al cerrar sesión: cancela lo pendiente y libera todas las URLs. */
export function clearAvatarCache(): void {
  for (const entry of entries.values()) {
    entry.controller.abort();
    if (entry.url) URL.revokeObjectURL(entry.url);
  }
  entries.clear();
}

/** Cuántas hay (pruebas y diagnóstico). */
export function avatarCacheSize(): number {
  return entries.size;
}
