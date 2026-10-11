import { ShieldCheck, ShieldOff } from 'lucide-react';
import { t } from '../../i18n';
import { localizeServerText } from '../../i18n/serverTexts';
import type { ConfirmInput } from '../../types/confirm';
import type { ConsentAsk } from '../../types/consents';
import { formatDateTime } from '../../utils/format';

/**
 * En qué estado está un consentimiento, en una línea: cuándo lo otorgó, cuándo lo revocó o que su empresa lo pide.
 * `null` cuando no hay nada que decir (un consentimiento opcional que nunca otorgó).
 */
export function consentFacts(ask: ConsentAsk): string | null {
  if (ask.granted && ask.granted_at) return t('consents.grantedOn', { date: formatDateTime(ask.granted_at) });
  if (ask.revoked_at) return t('consents.revokedOn', { date: formatDateTime(ask.revoked_at) });
  return ask.required ? t('consents.askedBy') : null;
}

/**
 * Confirmación antes de otorgar (regla 3: nada se crea por accidente). Nombra el consentimiento con el TÍTULO del
 * servidor y la versión del texto que se mostró (lo que queda como prueba), y dice que se puede revocar.
 */
export function grantConsentConfirm(ask: ConsentAsk): ConfirmInput {
  return {
    kind: 'create',
    icon: <ShieldCheck size={30} />,
    eyebrow: t('consents.grantAsk.eyebrow'),
    title: t('consents.grantAsk.title'),
    message: t('consents.grantAsk.message'),
    details: [localizeServerText(ask.title), t('consents.version', { version: ask.version })],
    note: t('consents.grantAsk.note'),
    confirmLabel: t('consents.grantAsk.confirm'),
    confirmIcon: <ShieldCheck size={18} />,
  };
}

/**
 * Confirmación antes de revocar: el servidor borra la biometría AL MOMENTO (rostro, plantillas, fotos y voz) y el
 * registro facial deja de existir, así que la nota dice la consecuencia real y que no se puede deshacer.
 */
export function revokeConsentConfirm(ask: ConsentAsk): ConfirmInput {
  const facts = consentFacts(ask);
  return {
    kind: 'delete',
    icon: <ShieldOff size={30} />,
    eyebrow: t('consents.revokeAsk.eyebrow'),
    title: t('consents.revokeAsk.title'),
    message: t('consents.revokeAsk.message'),
    details: facts ? [localizeServerText(ask.title), facts] : [localizeServerText(ask.title)],
    note: t('consents.revokeAsk.note'),
    confirmLabel: t('consents.revokeAsk.confirm'),
    confirmIcon: <ShieldOff size={18} />,
  };
}
