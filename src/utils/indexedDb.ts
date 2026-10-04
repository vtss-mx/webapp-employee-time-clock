/**
 * La base de datos de ESTE dispositivo (IndexedDB): lo único que la aplicación guarda en el
 * navegador. Nunca localStorage ni sessionStorage (texto plano, síncrono, sin tipos y legible por
 * cualquier script): IndexedDB guarda objetos tal cual (también llaves de WebCrypto no exportables),
 * es asíncrona y no bloquea la pantalla.
 *
 * Una sola base con un almacén por propósito; subir la versión agrega los nuevos sin tocar los que
 * ya existen (un dispositivo con la v1 conserva su llave al actualizarse).
 */

const DB_NAME = 'tc-device';
/** v1: llave del dispositivo · v2: preferencias del dispositivo (p. ej. la cámara elegida). */
const DB_VERSION = 2;
export type DeviceStoreName = 'keys' | 'prefs';
const STORES: readonly DeviceStoreName[] = ['keys', 'prefs'];

/** Una petición de IndexedDB como promesa (con el error que dé el navegador, o `unavailable`). */
export function idbRequest<T>(req: IDBRequest<T>, unavailable: () => Error): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? unavailable());
  });
}

/** Un almacén de la base del dispositivo, listo para leer o escribir. */
export async function deviceObjectStore(store: DeviceStoreName, mode: IDBTransactionMode, unavailable: () => Error): Promise<IDBObjectStore> {
  if (typeof indexedDB === 'undefined') throw unavailable();
  const open = indexedDB.open(DB_NAME, DB_VERSION);
  open.onupgradeneeded = () => {
    STORES.filter((name) => !open.result.objectStoreNames.contains(name)).forEach((name) => open.result.createObjectStore(name));
  };
  const db = await idbRequest(open, unavailable);
  return db.transaction(store, mode).objectStore(store);
}
