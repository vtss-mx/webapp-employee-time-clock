import { LocateOff, RefreshCw } from 'lucide-react';
import { t } from '../../i18n';
import { ApiError } from '../../services/apiClient';
import { locationPermissionSteps, locationProblemCopy, LocationError, type LocationProblem } from '../../utils/geolocation';
import type { MessageAction, MessageInput } from '../MessageDialog';

/**
 * Popups de la ubicación, armados en el idioma activo: quien los muestra pasa una función
 * (`feedback.show(() => locationProblemMessage(…))`) para que el popup abierto siga al idioma.
 */

/** Para qué se pidió la ubicación: cambia por qué se necesita y cómo seguir tras permitirla. */
export type LocationPurpose = 'login' | 'map' | 'checkpoint' | 'verification';

/** Ubicación del dispositivo bloqueada o no disponible (inicio de sesión, una verificación o "Mi ubicación"). */
export function locationProblemMessage(problem: LocationProblem, purpose: LocationPurpose = 'login'): MessageInput {
  const { title, text } = locationProblemCopy(problem);
  const denied = problem === 'denied';
  return {
    variant: denied || problem === 'insecure' ? 'warning' : 'error',
    icon: <LocateOff size={30} />,
    eyebrow: t('location.eyebrow'),
    title,
    text: denied ? t(`location.deniedFor.${purpose}.text`) : text,
    details: denied ? [...locationPermissionSteps(), t(`location.deniedFor.${purpose}.next`)] : undefined,
    detailsStyle: 'steps',
    key: `location-${problem}`,
  };
}

/** Cancelar + «Reintentar» (otra lectura de ubicación): el mismo par en todos los flujos con ubicación. */
const retryActions = (): MessageAction[] => [
  { id: 'close', label: t('common.actions.cancel'), variant: 'ghost' },
  { id: 'retry', label: t('common.actions.retry'), variant: 'primary', icon: <RefreshCw size={18} /> },
];

/**
 * Respuestas del servidor sobre la ubicación en una VERIFICACIÓN facial con ubicación obligatoria (`verification_location`
 * ENFORCE): falta, no es válida o está fuera del lugar permitido. El reto lo decide el servidor; la app solo ofrece
 * reintentar con una lectura nueva, nunca bloquea a ciegas.
 */
const VERIFICATION_LOCATION_TITLES = {
  LOCATION_REQUIRED: 'location.server.required',
  LOCATION_INVALID: 'location.server.inaccurate',
  LOCATION_OUT_OF_RANGE: 'location.server.outOfRange',
} as const;

const isVerificationLocationCode = (code: string): code is keyof typeof VERIFICATION_LOCATION_TITLES => code in VERIFICATION_LOCATION_TITLES;

/**
 * Popup (con «Reintentar») de la respuesta del servidor sobre la ubicación de una verificación; null si el error es
 * de otra cosa (rostro, red, servidor). Se arma al dibujarse (en el idioma activo): un popup abierto sigue al idioma.
 */
export function verificationLocationMessage(error: unknown): (() => MessageInput) | null {
  if (!(error instanceof ApiError) || !isVerificationLocationCode(error.code)) return null;
  // Se fija la llave del título fuera del closure (dentro de él, `error.code` vuelve a verse como `string`).
  const titleKey = VERIFICATION_LOCATION_TITLES[error.code];
  const key = `verify-${error.code}`;
  return () => ({
    variant: 'warning',
    icon: <LocateOff size={30} />,
    eyebrow: t('location.eyebrow'),
    title: t(titleKey),
    text: error.message,
    actions: retryActions(),
    key,
  });
}

/** Título de cada respuesta del backend sobre la ubicación al iniciar sesión. */
const LOGIN_LOCATION_TITLES = {
  LOCATION_OUT_OF_RANGE: 'location.server.outOfRange',
  LOCATION_INACCURATE: 'location.server.inaccurate',
  LOCATION_REQUIRED: 'location.server.required',
} as const;

const isLoginLocationCode = (code: string): code is keyof typeof LOGIN_LOCATION_TITLES => code in LOGIN_LOCATION_TITLES;

/**
 * Aviso del inicio de sesión cuando el validador requiere ubicación: permiso o GPS del dispositivo
 * (LocationError) o la respuesta del backend (fuera del radio, ubicación imprecisa). null: otro error.
 */
export function loginLocationMessage(error: unknown): MessageInput | null {
  if (error instanceof LocationError) return locationProblemMessage(error.problem);
  if (!(error instanceof ApiError) || !isLoginLocationCode(error.code)) return null;
  return {
    variant: 'warning',
    icon: <LocateOff size={30} />,
    eyebrow: t('location.eyebrow'),
    title: t(LOGIN_LOCATION_TITLES[error.code]),
    text: error.message,
    details: error.code === 'LOCATION_OUT_OF_RANGE' ? [t('location.server.approach'), t('location.server.gps'), t('location.server.signInAgain')] : undefined,
    detailsStyle: 'steps',
    key: `login-${error.code}`,
  };
}
