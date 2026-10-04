import { KeyRound } from 'lucide-react';
import type { ApiKeyCreated } from '../../types';
import type { MessageInput } from '../MessageDialog';
import { CopyField } from '../ui/CopyField';

/**
 * Popup con el secreto de una llave recién creada o rotada. Es la ÚNICA vez que se muestra (en la
 * BD solo queda su hash), así que solo se cierra confirmando que ya se guardó.
 */
export function apiKeySecretMessage(key: ApiKeyCreated, rotated = false): MessageInput {
  return {
    variant: 'success',
    icon: <KeyRound size={30} />,
    eyebrow: rotated ? 'Llave rotada' : 'Llave creada',
    title: `Copia la llave de «${key.name}»`,
    text: rotated
      ? 'Esta es la llave nueva; la anterior ya no funciona. Actualízala en el sistema que se conecta.'
      : 'Configúrala en el sistema que se conectará. Por seguridad no se volverá a mostrar.',
    body: <CopyField value={key.secret} label="Copiar llave" />,
    details: [
      'Envíala en la cabecera X-API-Key de cada petición.',
      'Guárdala en el gestor de secretos del sistema, no en correos ni chats.',
      'Si se pierde o se filtra, rótala o revócala desde Integraciones.',
    ],
    detailsStyle: 'checks',
    actions: [{ id: 'saved', label: 'Ya la guardé', variant: 'primary' }],
    dismissible: false,
    key: `api-key-secret-${key.id}`,
  };
}
