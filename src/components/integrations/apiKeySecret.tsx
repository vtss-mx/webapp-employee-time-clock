import { KeyRound } from 'lucide-react';
import { t } from '../../i18n';
import type { ApiKeyCreated } from '../../types';
import type { MessageInput } from '../MessageDialog';
import { CopyField } from '../ui/CopyField';

/**
 * Popup con el secreto de una llave recién creada o rotada. Es la ÚNICA vez que se muestra (en la
 * BD solo queda su hash), así que solo se cierra confirmando que ya se guardó. Se pasa como función
 * (`feedback.show(() => apiKeySecretMessage(key))`) para que el popup abierto siga al idioma activo.
 */
export function apiKeySecretMessage(key: ApiKeyCreated, rotated = false): MessageInput {
  return {
    variant: 'success',
    icon: <KeyRound size={30} />,
    eyebrow: t(rotated ? 'apiKeys.secret.rotated' : 'apiKeys.secret.created'),
    title: t('apiKeys.secret.title', { name: key.name }),
    text: t(rotated ? 'apiKeys.secret.rotatedText' : 'apiKeys.secret.createdText'),
    body: <CopyField value={key.secret} label={t('apiKeys.secret.copy')} />,
    details: [t('apiKeys.secret.header'), t('apiKeys.secret.store'), t('apiKeys.secret.lost')],
    detailsStyle: 'checks',
    actions: [{ id: 'saved', label: t('apiKeys.secret.saved'), variant: 'primary' }],
    dismissible: false,
    key: `api-key-secret-${key.id}`,
  };
}
