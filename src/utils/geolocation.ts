/**
 * Ubicación del dispositivo con el aviso NATIVO del navegador (sin popup previo propio): la usan el
 * inicio de sesión de los validadores que requieren ubicación, el registro de asistencia y el botón
 * "Mi ubicación" del mapa.
 */
import { t } from '../i18n/core';

export type LocationProblem = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  /** Precisión en metros (radio del 68 %). */
  accuracy: number;
}

export class LocationError extends Error {
  constructor(readonly problem: LocationProblem) {
    super();
    this.name = 'LocationError';
    // El texto se traduce al leerse (como `localizedError`): un popup abierto sigue al idioma activo.
    Object.defineProperty(this, 'message', { get: () => locationProblemCopy(problem).text, configurable: true, enumerable: false });
  }
}

/** Cómo volver a permitir la ubicación (los mismos pasos en cualquier pantalla), en el idioma activo. */
export function locationPermissionSteps(): string[] {
  return [t('location.permissionSteps.iphone'), t('location.permissionSteps.android')];
}

/**
 * Título y explicación de cada problema (popup de la aplicación), en el idioma activo: se piden al
 * dibujarse. Por qué se necesita y cómo permitirla cuando está bloqueada dependen de la pantalla
 * (`locationProblemMessage(problem, purpose)`).
 */
export function locationProblemCopy(problem: LocationProblem): { title: string; text: string } {
  return { title: t(`location.problems.${problem}.title`), text: t(`location.problems.${problem}.text`) };
}

const PROBLEM_BY_CODE: Record<number, LocationProblem> = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };

/** El problema detrás de un error del navegador (permiso, GPS sin señal, tiempo agotado). */
export const locationProblemOf = (error: GeolocationPositionError): LocationProblem => PROBLEM_BY_CODE[error.code] ?? 'unavailable';

/** Lo que impide leer la ubicación en este navegador antes de intentarlo (conexión no segura o sin la API); null si nada. */
export function locationBlocker(): LocationProblem | null {
  if (typeof window !== 'undefined' && window.isSecureContext === false) return 'insecure';
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'unsupported';
  return null;
}

/**
 * Una lectura fresca y precisa (GPS si el dispositivo lo tiene). `highAccuracy: false` + `maxAgeMs` piden la de la red
 * (Wi-Fi), que una computadora sin GPS sí suele tener; solo la usa el mapa como respaldo, nunca un registro.
 */
export function currentLocation({ timeoutMs = 15_000, highAccuracy = true, maxAgeMs = 0 } = {}): Promise<DeviceLocation> {
  const blocker = locationBlocker();
  if (blocker) return Promise.reject(new LocationError(blocker));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      (error) => reject(new LocationError(locationProblemOf(error))),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: maxAgeMs },
    );
  });
}

/**
 * La ubicación que el dispositivo ya conoce, SOLO si la persona ya dio el permiso: nunca abre el aviso
 * del navegador (se consulta el estado del permiso antes). Sirve de referencia, p. ej. para ordenar
 * lugares por cercanía; acepta una lectura reciente (rápida, sin encender el GPS). Es accesorio: sin
 * permiso, sin soporte, con error o si tarda responde null (nunca lanza).
 */
export async function knownLocation({ timeoutMs = 3_000, maxAgeMs = 10 * 60_000 } = {}): Promise<DeviceLocation | null> {
  try {
    if ((await navigator.permissions.query({ name: 'geolocation' })).state !== 'granted') return null;
    return await new Promise<DeviceLocation | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: maxAgeMs },
      );
    });
  } catch {
    return null; // navegador sin la API de permisos o sin geolocalización: no hay referencia
  }
}
