/**
 * Ubicación del dispositivo con el aviso NATIVO del navegador (sin popup previo propio): la usan el
 * inicio de sesión de los validadores que requieren ubicación y el botón "Mi ubicación" del mapa.
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
  denied: {
    title: 'Permite el acceso a tu ubicación',
    text: 'Este validador solo puede iniciar sesión en su lugar de operación y el permiso de ubicación está bloqueado.',
    steps: [
      'iPhone: Ajustes › Privacidad › Localización › Safari (o tu navegador) › «Al usar la app».',
      'Android: toca el candado junto a la dirección › Permisos › Ubicación › Permitir.',
      'Vuelve a la aplicación e inicia sesión de nuevo.',
    ],
  },
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
