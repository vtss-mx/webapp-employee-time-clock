/**
 * Reglas puras de las claves de firma de la empresa (migración 0105 del backend).
 *
 * Aquí NO vive ningún número del servidor (regla 25 de la raíz): el tope de claves vigentes, la vigencia por
 * omisión, el tope de vigencia y los días de gracia al rotar llegan en `limits` del listado. Lo que vive aquí es
 * solo presentación: qué clave se puede reemplazar, cómo se arma el enlace de «Rotar» y a qué campo va cada código
 * de error del servidor.
 */
import { t } from '../i18n';
import { paths } from '../routes/paths';
import type { SigningKey, SigningKeyLimits } from '../types';

/** Campos del formulario (los mismos nombres que el cuerpo de la API). */
export interface SigningKeyFormFields {
  label: string;
  public_key: string;
  expires_in_days: string;
  replaces: string;
}

/** «Ninguna»: la clave nueva no reemplaza a otra (no es una rotación). Valor del `Select`, no un texto. */
export const NO_REPLACES = '';

/** Parámetro con el que «Rotar» llega al formulario ya apuntando a la clave que se reemplaza. */
export const REPLACES_PARAM = 'replaces';

/**
 * A qué campo va cada error del servidor. Van tanto los nombres de campo del 422 como los códigos de negocio:
 * una clave pública que no es la esperada (422) y una que ya está registrada (409) son problemas de ESE campo, no
 * de la pantalla, así que se marcan ahí y no solo en el popup.
 */
export const SIGNING_KEY_FIELD_ERRORS: Partial<Record<string, keyof SigningKeyFormFields>> = {
  label: 'label',
  SIGNING_KEY_LABEL_REQUIRED: 'label',
  public_key: 'public_key',
  SIGNING_KEY_INVALID: 'public_key',
  SIGNING_KEY_DUPLICATE: 'public_key',
  expires_in_days: 'expires_in_days',
  SIGNING_KEY_EXPIRY_TOO_LONG: 'expires_in_days',
  replaces: 'replaces',
  SIGNING_KEY_NOT_FOUND: 'replaces',
};

/** Enlace de «Rotar»: el formulario de siempre, con la clave que se reemplaza ya elegida. */
export function rotatePath(id: number): string {
  return `${paths.company.newSigningKey}?${new URLSearchParams({ [REPLACES_PARAM]: String(id) })}`;
}

/**
 * Las claves que se pueden reemplazar: solo las que hoy pueden firmar (el ESTADO lo decide el servidor). Una
 * revocada o vencida ya no sirve de nada y rotarla no tendría sentido.
 */
export function replaceable(keys: readonly SigningKey[]): SigningKey[] {
  return keys.filter((key) => key.status === 'ACTIVE');
}

/**
 * La clave que `?replaces=` pide, solo si de verdad se puede reemplazar. Un id inventado, de otra empresa (que
 * para esta no existe) o de una clave revocada no elige nada: el formulario queda como una clave más y la persona
 * decide. Nunca se confía en lo que trae la dirección.
 */
export function replacesFrom(raw: string | null, keys: readonly SigningKey[]): string {
  const match = raw && replaceable(keys).find((key) => String(key.id) === raw);
  return match ? String(match.id) : NO_REPLACES;
}

/** Lo que se envía al servidor: el id de la clave que se reemplaza o null (no es una rotación). */
export function replacesValue(value: string): number | null {
  return value === NO_REPLACES ? null : Number(value);
}

/**
 * Los días de vigencia que se envían: lo escrito o, vacío, null para que el servidor ponga su valor por omisión.
 * La app nunca escribe ese número (regla 25).
 */
export function lifetimeValue(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

/** El cuerpo que pide la API, con el nombre ya limpio (el servidor lo limpia igual). */
export function signingKeyPayload(values: SigningKeyFormFields) {
  return { label: values.label.trim(), expires_in_days: lifetimeValue(values.expires_in_days), replaces: replacesValue(values.replaces) };
}

/** Si el formulario ya se puede enviar. Es solo experiencia: el servidor vuelve a validar todo. */
export function signingKeyReady(values: SigningKeyFormFields, generate: boolean): boolean {
  return Boolean(values.label.trim()) && (generate || Boolean(values.public_key.trim()));
}

/**
 * Lo que falta por llenar, ya en texto (solo después de intentar enviar). El error del SERVIDOR siempre gana:
 * quien lo dibuja escribe `{ ...missingSigningKeyFields(…), ...errores del servidor }`.
 */
export function missingSigningKeyFields(values: SigningKeyFormFields, generate: boolean, touched: boolean): Partial<SigningKeyFormFields> {
  if (!touched) return {};
  const missing: Partial<SigningKeyFormFields> = {};
  if (!values.label.trim()) missing.label = t('signingKeys.form.nameRequired');
  if (!generate && !values.public_key.trim()) missing.public_key = t('signingKeys.form.publicKeyRequired');
  return missing;
}

/** La clave que se está reemplazando (null si la nueva es una clave más). */
export function replacedKey(options: readonly SigningKey[], value: string): SigningKey | null {
  return options.find((key) => String(key.id) === value) ?? null;
}

/** Los días de vigencia que se verán en la confirmación: lo escrito o, vacío, el valor por omisión del servidor. */
export function lifetimeLabel(value: string, limits: SigningKeyLimits): string {
  return t('signingKeys.form.days', { count: Number(value.trim() || limits.default_days) });
}
