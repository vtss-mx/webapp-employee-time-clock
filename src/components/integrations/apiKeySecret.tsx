import { KeyRound } from 'lucide-react';
import { t } from '../../i18n';
import type { ApiKeyCreated } from '../../types';
import type { MessageInput } from '../MessageDialog';
import { oneTimeSecretMessage } from './oneTimeSecret';

/**
 * Popup con el secreto de una llave recién creada o rotada. Es la ÚNICA vez que se muestra (en la
 * BD solo queda su hash), así que solo se cierra confirmando que ya se guardó. Se pasa como función
 * (`feedback.show(() => apiKeySecretMessage(key))`) para que el popup abierto siga al idioma activo.
 * La mecánica del «se ve una sola vez y no se guarda» vive en `oneTimeSecret.tsx`.
 */
export function apiKeySecretMessage(key: ApiKeyCreated, rotated = false): MessageInput {
  return oneTimeSecretMessage({
    value: key.secret,
    icon: <KeyRound size={30} />,
    eyebrow: t(rotated ? 'apiKeys.secret.rotated' : 'apiKeys.secret.created'),
    title: t('apiKeys.secret.title', { name: key.name }),
    text: t(rotated ? 'apiKeys.secret.rotatedText' : 'apiKeys.secret.createdText'),
    copyLabel: t('apiKeys.secret.copy'),
    details: [t('apiKeys.secret.header'), t('apiKeys.secret.store'), t('apiKeys.secret.lost')],
    saved: t('apiKeys.secret.saved'),
    key: `api-key-secret-${key.id}`,
  });
}
