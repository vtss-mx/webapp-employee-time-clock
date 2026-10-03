import { MonitorSmartphone, ShieldX } from 'lucide-react';
import { ApiError } from '../../services/apiClient';
import { DeviceKeyError } from '../../utils/deviceKey';
import { loginLocationMessage } from '../location/locationMessages';
import type { MessageInput } from '../MessageDialog';

const DEVICE_TITLES: Record<string, { title: string; steps?: string[]; variant: MessageInput['variant'] }> = {
  DEVICE_PENDING_APPROVAL: {
    title: 'Dispositivo por autorizar',
    variant: 'info',
    steps: [
      'Pide a un administrador de tu empresa que entre a Validadores › Dispositivos.',
      'Que autorice este dispositivo (aparece con el nombre de este navegador).',
      'Vuelve a iniciar sesión aquí mismo.',
    ],
  },
  DEVICE_REJECTED: { title: 'Dispositivo no autorizado', variant: 'warning' },
  DEVICE_REVOKED: { title: 'Autorización retirada', variant: 'warning' },
  DEVICE_PROOF_INVALID: { title: 'No se pudo verificar el dispositivo', variant: 'error' },
};

/**
 * Aviso del inicio de sesión cuando una regla del validador lo impide: dispositivo por autorizar,
 * rechazado o revocado, navegador sin llave de dispositivo, o la ubicación. null: otro error.
 */
export function loginRuleMessage(error: unknown): MessageInput | null {
  if (error instanceof DeviceKeyError) {
    return { variant: 'error', icon: <ShieldX size={30} />, eyebrow: 'Dispositivo', title: 'No se pudo registrar el dispositivo', text: error.message, key: 'login-device-unsupported' };
  }
  if (error instanceof ApiError && error.code in DEVICE_TITLES) {
    const copy = DEVICE_TITLES[error.code];
    return {
      variant: copy.variant,
      icon: <MonitorSmartphone size={30} />,
      eyebrow: 'Dispositivo',
      title: copy.title,
      text: error.message,
      details: copy.steps,
      detailsStyle: 'steps',
      key: `login-${error.code}`,
    };
  }
  return loginLocationMessage(error);
}
