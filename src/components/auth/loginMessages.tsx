import { Clock, KeyRound, MonitorSmartphone, ShieldX } from 'lucide-react';
import { t } from '../../i18n';
import { ApiError } from '../../services/apiClient';
import { DeviceKeyError } from '../../utils/deviceKey';
import { formatDuration } from '../../utils/numbers';
import { loginLocationMessage } from '../location/locationMessages';
import type { MessageInput } from '../MessageDialog';

/** Reglas del dispositivo de un validador: variante del aviso y si lleva los pasos para autorizarlo. */
const DEVICE_RULES = {
  DEVICE_PENDING_APPROVAL: { variant: 'info', steps: true },
  DEVICE_REJECTED: { variant: 'warning', steps: false },
  DEVICE_REVOKED: { variant: 'warning', steps: false },
  DEVICE_PROOF_INVALID: { variant: 'error', steps: false },
} as const satisfies Record<string, { variant: MessageInput['variant']; steps: boolean }>;

type DeviceRule = keyof typeof DEVICE_RULES;

const isDeviceRule = (code: string): code is DeviceRule => code in DEVICE_RULES;

/** Qué hacer con un dispositivo por autorizar, en el idioma activo. */
const pendingSteps = () => [t('auth.device.pendingSteps.ask'), t('auth.device.pendingSteps.authorize'), t('auth.device.pendingSteps.retry')];

/**
 * Segundo factor obligatorio (migración 0096 del backend): la cuenta YA tiene una llave de acceso, así que la
 * contraseña sola dejó de abrir sesión (403 `MFA_REQUIRED`). La acción que sirve es entrar con la llave —el botón
 * «Entrar con llave de acceso» del propio formulario—, nunca volver a escribir la contraseña.
 */
function mfaRequiredMessage(message: string): MessageInput {
  return {
    variant: 'info',
    icon: <KeyRound size={30} />,
    eyebrow: t('auth.mfa.eyebrow'),
    title: t('auth.mfa.title'),
    text: message,
    details: [t('auth.mfa.step')],
    detailsStyle: 'steps',
    key: 'login-mfa-required',
  };
}

/**
 * Cuenta bloqueada por intentos fallidos de contraseña (429 `ACCOUNT_LOCKED`): se dice CUÁNTO falta con el
 * `Retry-After` del servidor y no se ofrece reintentar, porque reintentar antes de ese plazo vuelve a fallar
 * (regla 7 de la raíz). Una llave de acceso sí entra: no pasa por el contador de contraseñas.
 */
function lockedMessage(error: ApiError): MessageInput {
  const wait = error.retryAfterMs;
  return {
    variant: 'warning',
    icon: <Clock size={30} />,
    eyebrow: t('auth.locked.eyebrow'),
    title: t('auth.locked.title'),
    text: error.message,
    details: wait === null ? [t('auth.locked.passkey')] : [t('auth.locked.wait', { value: formatDuration(wait) }), t('auth.locked.passkey')],
    key: 'login-account-locked',
  };
}

/**
 * Aviso del inicio de sesión cuando una regla lo impide: el segundo factor obligatorio, la cuenta bloqueada por
 * intentos fallidos, el dispositivo del validador (por autorizar, rechazado o revocado), un navegador sin llave de
 * dispositivo o la ubicación. null: otro error.
 * Sus textos salen del idioma activo al llamarse: el inicio de sesión lo pide al dibujar el popup
 * (`feedback.show(() => …)`), así un cambio de idioma con el aviso abierto lo traduce.
 */
export function loginRuleMessage(error: unknown): MessageInput | null {
  if (error instanceof DeviceKeyError) {
    return { variant: 'error', icon: <ShieldX size={30} />, eyebrow: t('auth.device.eyebrow'), title: t('auth.device.unsupported'), text: error.message, key: 'login-device-unsupported' };
  }
  if (error instanceof ApiError && error.status === 403 && error.code === 'MFA_REQUIRED') return mfaRequiredMessage(error.message);
  if (error instanceof ApiError && error.status === 429 && error.code === 'ACCOUNT_LOCKED') return lockedMessage(error);
  if (error instanceof ApiError && isDeviceRule(error.code)) {
    const rule = DEVICE_RULES[error.code];
    return {
      variant: rule.variant,
      icon: <MonitorSmartphone size={30} />,
      eyebrow: t('auth.device.eyebrow'),
      title: t(`auth.device.titles.${error.code}`),
      text: error.message,
      details: rule.steps ? pendingSteps() : undefined,
      detailsStyle: 'steps',
      key: `login-${error.code}`,
    };
  }
  return loginLocationMessage(error);
}
