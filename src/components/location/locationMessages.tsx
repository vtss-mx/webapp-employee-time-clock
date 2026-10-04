import { LocateOff } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { LOCATION_MESSAGES, LOCATION_PERMISSION_STEPS, LocationError, type LocationProblem } from '../../utils/geolocation';
import type { MessageInput } from '../MessageDialog';

/** Para qué se pidió la ubicación: cambia por qué se necesita y cómo seguir tras permitirla. */
export type LocationPurpose = 'login' | 'attendance' | 'map';

const DENIED_BY_PURPOSE: Record<LocationPurpose, { text: string; next: string }> = {
  login: {
    text: 'Este validador solo puede iniciar sesión en su lugar de operación y el permiso de ubicación está bloqueado.',
    next: 'Vuelve a la aplicación e inicia sesión de nuevo.',
  },
  attendance: {
    text: 'Tu registro de asistencia necesita tu ubicación y el permiso está bloqueado en este navegador.',
    next: 'Regresa aquí y toca «Reintentar».',
  },
  map: {
    text: 'Para ubicarte en el mapa hace falta el permiso de ubicación y está bloqueado en este navegador.',
    next: 'Vuelve a tocar «Mi ubicación» (o marca el punto en el mapa).',
  },
};

/** Ubicación del dispositivo bloqueada o no disponible (inicio de sesión, asistencia o "Mi ubicación"). */
export function locationProblemMessage(problem: LocationProblem, purpose: LocationPurpose = 'login'): MessageInput {
  const { title, text, steps } = LOCATION_MESSAGES[problem];
  const denied = problem === 'denied' ? DENIED_BY_PURPOSE[purpose] : null;
  return {
    variant: problem === 'denied' || problem === 'insecure' ? 'warning' : 'error',
    icon: <LocateOff size={30} />,
    eyebrow: 'Ubicación',
    title,
    text: denied?.text ?? text,
    details: denied ? [...LOCATION_PERMISSION_STEPS, denied.next] : steps,
    detailsStyle: 'steps',
    key: `location-${problem}`,
  };
}

const LOGIN_LOCATION_TITLES: Record<string, string> = {
  LOCATION_OUT_OF_RANGE: 'Estás fuera del lugar permitido',
  LOCATION_INACCURATE: 'Tu ubicación no es precisa',
  LOCATION_REQUIRED: 'Se necesita tu ubicación',
};

/**
 * Aviso del inicio de sesión cuando el validador requiere ubicación: permiso o GPS del dispositivo
 * (LocationError) o la respuesta del backend (fuera del radio, ubicación imprecisa). null: otro error.
 */
export function loginLocationMessage(error: unknown): MessageInput | null {
  if (error instanceof LocationError) return locationProblemMessage(error.problem);
  if (!(error instanceof ApiError) || !(error.code in LOGIN_LOCATION_TITLES)) return null;
  return {
    variant: 'warning',
    icon: <LocateOff size={30} />,
    eyebrow: 'Ubicación',
    title: LOGIN_LOCATION_TITLES[error.code],
    text: error.message,
    details:
      error.code === 'LOCATION_OUT_OF_RANGE'
        ? ['Acércate al acceso donde opera este validador.', 'Activa la ubicación precisa (GPS) del dispositivo.', 'Vuelve a iniciar sesión.']
        : undefined,
    detailsStyle: 'steps',
    key: `login-${error.code}`,
  };
}
