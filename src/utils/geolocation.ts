/**
 * Ubicación del dispositivo con el aviso NATIVO del navegador (sin popup previo propio): la usan el
 * inicio de sesión de los validadores que requieren ubicación, el registro de asistencia y el botón
 * "Mi ubicación" del mapa.
 */

export type LocationProblem = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  /** Precisión en metros (radio del 68 %). */
  accuracy: number;
}

export class LocationError extends Error {
  constructor(readonly problem: LocationProblem) {
    super(LOCATION_MESSAGES[problem].text);
    this.name = 'LocationError';
  }
}

/** Cómo volver a permitir la ubicación (los mismos pasos en cualquier pantalla). */
export const LOCATION_PERMISSION_STEPS = [
  'iPhone: Ajustes › Privacidad › Localización › Safari (o tu navegador) › «Al usar la app».',
  'Android: toca el candado junto a la dirección › Permisos › Ubicación › Permitir.',
];

/** Título, explicación y pasos de cada problema (popup de la aplicación). */
export const LOCATION_MESSAGES: Record<LocationProblem, { title: string; text: string; steps?: string[] }> = {
  unsupported: {
    title: 'Ubicación no disponible',
    text: 'Este navegador no permite conocer la ubicación del dispositivo. Usa Safari o Chrome actualizados.',
  },
  insecure: {
    title: 'Conexión no segura',
    text: 'La ubicación solo se puede leer desde una conexión segura (https). Abre la aplicación con su dirección segura.',
  },
  // Por qué se necesita y cómo seguir dependen de la pantalla (`locationProblemMessage(problem, purpose)`).
  denied: { title: 'Permite el acceso a tu ubicación', text: 'El permiso de ubicación está bloqueado en este navegador.', steps: LOCATION_PERMISSION_STEPS },
  unavailable: {
    title: 'No se pudo obtener tu ubicación',
    text: 'Activa la ubicación (GPS) del dispositivo y vuelve a intentarlo, de preferencia cerca de una ventana.',
  },
  timeout: {
    title: 'La ubicación tardó demasiado',
    text: 'No se obtuvo la ubicación a tiempo. Activa la ubicación precisa del dispositivo y vuelve a intentarlo.',
  },
};

const PROBLEM_BY_CODE: Record<number, LocationProblem> = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };

/** Una lectura fresca y precisa (GPS si el dispositivo lo tiene). */
export function currentLocation({ timeoutMs = 15_000 } = {}): Promise<DeviceLocation> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) return Promise.reject(new LocationError('insecure'));
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return Promise.reject(new LocationError('unsupported'));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      (error) => reject(new LocationError(PROBLEM_BY_CODE[error.code] ?? 'unavailable')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
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
