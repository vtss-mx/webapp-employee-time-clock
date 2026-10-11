import type {
  PageQuery,
  SigningKey,
  SigningKeyGenerated,
  SigningKeyGeneratePayload,
  SigningKeyList,
  SigningKeyRegisterPayload,
} from '../types';
import { hasKeys, isPage, isRecord } from '../utils/guards';
import { apiRequest } from './apiClient';

const isKey = hasKeys<SigningKey>('id', 'label', 'fingerprint', 'public_key', 'algorithm', 'status', 'expires_at');
/** El par generado: además de la clave, la privada que viaja UNA sola vez. */
const isGenerated = hasKeys<SigningKeyGenerated>('id', 'fingerprint', 'private_key');

/** Los cinco números que decide el servidor: la pantalla los dibuja y no puede inventar ninguno (regla 25). */
const LIMITS = ['active', 'max_active', 'default_days', 'max_days', 'grace_days'] as const;

/**
 * Página de claves con sus dos acompañantes: la clave pública de la PLATAFORMA y las reglas del servidor
 * (`limits`, regla 25 de la raíz). Un `data` sin ellos se rechaza (`INVALID_RESPONSE`): la pantalla los necesita
 * para dibujarse y no puede inventarlos. De la clave de la plataforma solo se exige `configured`: su huella y su
 * clave son nulas a propósito cuando la plataforma no tiene su secreto, y eso no es un error.
 */
const isLimits = (value: unknown): boolean => isRecord(value) && LIMITS.every((field) => typeof value[field] === 'number');

const isList = (value: unknown): value is SigningKeyList =>
  isRecord(value) && isLimits(value.limits) && isRecord(value.platform) && typeof value.platform.configured === 'boolean' && isPage<SigningKeyList>(isKey)(value);

/** Lo que se envía al servidor: el nombre sin espacios de sobra (como las llaves de la API). */
const body = <T extends { label: string }>(payload: T): T => ({ ...payload, label: payload.label.trim() });

/**
 * Claves de FIRMA de la empresa (pantalla «Integraciones (API)» → «Claves de firma»; migración 0105 del backend).
 * Todo va con la SESIÓN de una cuenta de la empresa: administrar claves con una llave de la API sería escalada de
 * privilegios (regla 24 de la raíz, exclusión 4), así que estas rutas no existen en `/integrations/v1`.
 */
export const signingKeyService = {
  list(query: PageQuery, signal?: AbortSignal): Promise<SigningKeyList> {
    return apiRequest<SigningKeyList>('/api-keys/signing-keys', { query: { ...query }, signal, validate: isList });
  },

  /** El camino RECOMENDADO: la empresa registra SU clave pública y su privada no toca el servidor. */
  register(payload: SigningKeyRegisterPayload): Promise<SigningKey> {
    return apiRequest<SigningKey>('/api-keys/signing-keys', { method: 'POST', body: body(payload), validate: isKey });
  },

  /** El segundo camino: la plataforma genera el par y devuelve la privada UNA vez (no la guarda nadie). */
  generate(payload: SigningKeyGeneratePayload): Promise<SigningKeyGenerated> {
    return apiRequest<SigningKeyGenerated>('/api-keys/signing-keys/generate', { method: 'POST', body: body(payload), validate: isGenerated });
  },

  /** Revocar es al INSTANTE, a propósito: una clave comprometida deja de servir ya. */
  revoke(id: number): Promise<SigningKey> {
    return apiRequest<SigningKey>(`/api-keys/signing-keys/${id}`, { method: 'DELETE', validate: isKey });
  },
};
