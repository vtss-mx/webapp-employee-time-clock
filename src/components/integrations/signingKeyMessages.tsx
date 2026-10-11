import { Ban, KeyRound, RefreshCw, Signature } from 'lucide-react';
import { t } from '../../i18n';
import type { SigningKey, SigningKeyGenerated } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import type { MessageInput } from '../MessageDialog';
import { timeAgo } from '../../utils/format';
import { oneTimeSecretMessage } from './oneTimeSecret';

/**
 * Popups y confirmaciones de las claves de firma. Todo se arma dentro de una función para que un popup abierto siga
 * al idioma activo (regla 16, cambio en caliente).
 */

/**
 * La clave PRIVADA del par que la plataforma acaba de generar. Se ve UNA sola vez:
 *
 * - el servidor no la guarda (ni en la base, ni en un log, ni en el contexto de un error);
 * - la aplicación tampoco: no va a `localStorage`, `sessionStorage`, IndexedDB ni al estado de una ruta. Vive en
 *   esta función, que vive en la cola de popups, y desaparece al cerrarlo.
 *
 * Por eso el popup no se cierra con Escape ni con un clic fuera: solo con «Ya la guardé» (`oneTimeSecret.tsx`).
 */
export function signingKeyPrivateMessage(key: SigningKeyGenerated): MessageInput {
  return oneTimeSecretMessage({
    value: key.private_key,
    icon: <KeyRound size={30} />,
    eyebrow: t('signingKeys.private.eyebrow'),
    title: t('signingKeys.private.title', { name: key.label }),
    text: t('signingKeys.private.text'),
    copyLabel: t('signingKeys.private.copy'),
    details: [t('signingKeys.private.store'), t('signingKeys.private.never'), t('signingKeys.private.lost')],
    saved: t('signingKeys.private.saved'),
    key: `signing-key-private-${key.id}`,
    multiline: true,
  });
}

/**
 * Revocar una clave: a diferencia de rotar, es INMEDIATO y a propósito (una clave comprometida deja de servir ya).
 * La confirmación dice exactamente qué deja de funcionar, con qué clave y desde cuándo no se usaba.
 */
export function revokeSigningKeyConfirm(key: SigningKey): ConfirmInput {
  return {
    tone: 'danger',
    icon: <Ban size={30} />,
    eyebrow: t('signingKeys.revoke.eyebrow'),
    title: t('signingKeys.revoke.title', { name: key.label }),
    message: t('signingKeys.revoke.message'),
    detailsTitle: t('signingKeys.revoke.detailsTitle'),
    details: [
      { label: t('signingKeys.row.fingerprint'), value: key.fingerprint },
      { label: t('signingKeys.revoke.lastUsed'), value: key.last_used_at ? timeAgo(key.last_used_at) : t('apiKeys.row.neverUsed') },
    ],
    note: t('signingKeys.revoke.note'),
    confirmLabel: t('signingKeys.revoke.confirm'),
    confirmIcon: <Ban size={18} />,
  };
}

/** Lo que se va a registrar o generar: cada dato con su etiqueta, como lo verá la empresa en la lista. */
export interface SigningKeyPlan {
  name: string;
  /** Si la plataforma genera el par (la privada se verá una sola vez) o la empresa registra su clave pública. */
  generate: boolean;
  /** Vigencia que se pedirá, ya en texto. */
  lifetime: string;
  /** Nombre de la clave que se reemplaza (rotación) o null si es una clave más. */
  replaces: string | null;
  /** Días de gracia que el SERVIDOR le dará a la clave reemplazada. */
  graceDays: number;
}

/**
 * Antes de crear nada: qué se registrará y qué consecuencia tiene. Rotar se explica aparte, porque la clave
 * anterior NO deja de servir al instante: sigue firmando sus días de gracia (los del servidor).
 */
export function signingKeyConfirm(plan: SigningKeyPlan): ConfirmInput {
  const details = [
    { label: t('common.fields.name'), value: plan.name },
    { label: t('signingKeys.form.path'), value: t(plan.generate ? 'signingKeys.form.platform.title' : 'signingKeys.form.own.title') },
    { label: t('signingKeys.form.lifetime'), value: plan.lifetime },
  ];
  if (plan.replaces) details.push({ label: t('signingKeys.form.replaces'), value: plan.replaces });
  return {
    kind: 'create',
    icon: plan.replaces ? <RefreshCw size={30} /> : <Signature size={30} />,
    title: t(plan.generate ? 'signingKeys.form.confirm.generateTitle' : 'signingKeys.form.confirm.title', { name: plan.name }),
    message: t(plan.generate ? 'signingKeys.form.confirm.generateMessage' : 'signingKeys.form.confirm.message'),
    detailsTitle: t('signingKeys.form.confirm.detailsTitle'),
    details,
    note: plan.replaces
      ? t('signingKeys.form.confirm.rotateNote', { count: plan.graceDays })
      : t(plan.generate ? 'signingKeys.form.confirm.generateNote' : 'signingKeys.form.confirm.note'),
    confirmLabel: t(plan.generate ? 'signingKeys.form.submitGenerate' : 'signingKeys.form.submit'),
    confirmIcon: plan.generate ? <KeyRound size={18} /> : <Signature size={18} />,
  };
}
