/**
 * Acceso seguro a Web Storage: puede lanzar excepciones en modo privado o si está bloqueado.
 * Solo guarda datos NO sensibles: el access token vive en memoria y el refresh token en una
 * cookie HttpOnly (inaccesible para JavaScript).
 */
export interface SafeStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function createStore(getStorage: () => Storage): SafeStore {
  return {
    get: (key) => safe(() => getStorage().getItem(key), null),
    set: (key, value) => safe(() => getStorage().setItem(key, value), undefined),
    remove: (key) => safe(() => getStorage().removeItem(key), undefined),
  };
}

/** Persiste entre pestañas y reinicios (preferencias, indicador de sesión iniciada). */
export const preferenceStore = createStore(() => window.localStorage);
/** Solo durante la pestaña actual. */
export const tabStore = createStore(() => window.sessionStorage);

/** Datos de usuario que versiones anteriores guardaban en el navegador y ahora viven en la BD. */
const LEGACY_USER_DATA_KEYS = ['tc.login.email', 'tc.sidebar.collapsed'];

export function purgeLegacyUserData(): void {
  LEGACY_USER_DATA_KEYS.forEach((key) => preferenceStore.remove(key));
}
