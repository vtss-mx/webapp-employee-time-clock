import type { PageQuery } from '../types';
import type { Passkey, PasskeyList, PasskeyLoginOptions, PasskeyRegistration, PasskeyRegistrationOptions } from '../types/passkeys';
import { hasKeys, isNothing, isPage, isRecord } from '../utils/guards';
import { apiRequest } from './apiClient';

const BASE = '/auth/passkeys';
const isPasskey = hasKeys<Passkey>('id', 'name', 'created_at', 'transports', 'backed_up');
const isPasskeys = isPage<PasskeyList>(isPasskey);
/** El reto sellado y las opciones del navegador (con su `challenge` en base64url). */
const isOptions = <T extends { token: string; options: { challenge: string } }>(value: unknown): value is T =>
  isRecord(value) && typeof value.token === 'string' && isRecord(value.options) && typeof value.options.challenge === 'string';

/**
 * Llaves de acceso de la cuenta (WebAuthn / passkeys, antifraude fase 3): registrar una en este dispositivo, listar,
 * renombrar y revocar las propias. El reto viaja sellado (`token`, de un solo uso) y el servidor verifica la
 * credencial; la app solo convierte el formato (`utils/webauthn.ts`). Entrar con una llave vive en `authService`.
 */
export const passkeyService = {
  /** El reto y las opciones para `navigator.credentials.create` (excluye las llaves que ya tiene la cuenta). */
  registrationOptions(): Promise<PasskeyRegistrationOptions> {
    return apiRequest<PasskeyRegistrationOptions>(`${BASE}/options`, { method: 'POST', validate: isOptions });
  },

  register(body: PasskeyRegistration): Promise<Passkey> {
    return apiRequest<Passkey>(BASE, { method: 'POST', body, validate: isPasskey });
  },

  list(query: PageQuery, signal?: AbortSignal): Promise<PasskeyList> {
    return apiRequest<PasskeyList>(BASE, { query: { ...query }, signal, validate: isPasskeys });
  },

  rename(id: number, name: string): Promise<Passkey> {
    return apiRequest<Passkey>(`${BASE}/${id}`, { method: 'PATCH', body: { name }, validate: isPasskey });
  },

  /** Revocar es un borrado real (como una sesión): la llave deja de servir al instante. */
  async revoke(id: number): Promise<void> {
    await apiRequest<null | undefined>(`${BASE}/${id}`, { method: 'DELETE', validate: isNothing });
  },

  /** El reto para entrar con una llave (sin sesión; la persona elige la llave en su dispositivo). */
  loginOptions(): Promise<PasskeyLoginOptions> {
    return apiRequest<PasskeyLoginOptions>('/auth/login/passkey/options', { method: 'POST', auth: false, validate: isOptions });
  },
};
