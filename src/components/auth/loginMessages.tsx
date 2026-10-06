import { MonitorSmartphone, ShieldX } from 'lucide-react';
import { t } from '../../i18n';
import { ApiError } from '../../services/apiClient';
import { DeviceKeyError } from '../../utils/deviceKey';
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
 * Aviso del inicio de sesión cuando una regla del validador lo impide: dispositivo por autorizar,
 * rechazado o revocado, navegador sin llave de dispositivo, o la ubicación. null: otro error.
 * Sus textos salen del idioma activo al llamarse: el inicio de sesión lo pide al dibujar el popup
 * (`feedback.show(() => …)`), así un cambio de idioma con el aviso abierto lo traduce.
 */
export function loginRuleMessage(error: unknown): MessageInput | null {
  if (error instanceof DeviceKeyError) {
    return { variant: 'error', icon: <ShieldX size={30} />, eyebrow: t('auth.device.eyebrow'), title: t('auth.device.unsupported'), text: error.message, key: 'login-device-unsupported' };
  }
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
