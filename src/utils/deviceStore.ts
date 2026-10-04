import { deviceObjectStore, idbRequest } from './indexedDb';

const unavailable = () => new Error('Este navegador no permite guardar datos del dispositivo');

/**
 * Preferencias de ESTE dispositivo (no de la persona: esas viven en la BD, `users.preferences`), en
 * IndexedDB. Hoy: qué cámara usar. Son accesorias: si el navegador no permite guardar (modo privado
 * estricto), no se recuerdan y la aplicación funciona igual (abre la cámara por omisión).
 */
export const deviceStore = {
  async get(key: string): Promise<unknown> {
    try {
      return await idbRequest((await deviceObjectStore('prefs', 'readonly', unavailable)).get(key), unavailable);
    } catch {
      return undefined; // accesorio: sin preferencia guardada
    }
  },

  async set(key: string, value: unknown): Promise<void> {
    try {
      await idbRequest((await deviceObjectStore('prefs', 'readwrite', unavailable)).put(value, key), unavailable);
    } catch {
      // accesorio: la próxima vez se elige la cámara por omisión
    }
  },
};
