import type { AuthTokenResponse, DeviceSessionList, PageQuery, RememberedAccount, User } from '../types';
import type { PasskeyAssertion } from '../types/passkeys';
import { hasKeys, isNothing, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import type { DeviceProof } from '../utils/deviceKey';
import type { DeviceLocation } from '../utils/geolocation';

/** Pruebas adicionales del inicio de sesión de un validador (las pide el backend). */
export interface LoginProofs {
  location?: DeviceLocation;
  device?: DeviceProof;
}

const isUser = hasKeys<User>('id', 'email', 'role');

/**
 * Códigos 401 de "elegir empresa" que NO cierran la sesión (la del empleado sigue viva en el selector): la empresa
 * está inactiva o su acceso a ella se desactivó. Se muestran como mensaje en el selector, no como cierre de sesión.
 */
export const COMPANY_SELECT_SAFE_CODES: ReadonlySet<string> = new Set(['COMPANY_INACTIVE', 'USER_INACTIVE']);

const isTokenResponse = (value: unknown): value is AuthTokenResponse =>
  hasKeys<AuthTokenResponse>('access_token', 'expires_in', 'session_id', 'user')(value) && isUser(value.user);
const isSessions = isPage<DeviceSessionList>(hasKeys('id', 'created_at', 'current'));
const isRemembered = hasKeys<RememberedAccount>('email');
const isRememberedOrNothing = (value: unknown): value is RememberedAccount | null => value === null || isRemembered(value);

/**
 * Autenticación. Los endpoints de sesión usan `auth: false` (no requieren access token) y la
 * cookie HttpOnly del refresh token, que el navegador envía solo a /api/auth.
 */
export const authService = {
  /**
   * `remember`: la sesión sobrevive al cierre del navegador (cookie persistente, máx. 12 h).
   * `proofs`: solo cuando el backend las pide a un validador — la ubicación del dispositivo y la firma
   * del reto con la llave del dispositivo.
   */
  login(email: string, password: string, remember = false, proofs: LoginProofs = {}): Promise<AuthTokenResponse> {
    return apiRequest<AuthTokenResponse>('/auth/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password, remember, ...proofs },
      auth: false,
      validate: isTokenResponse,
    });
  },

  /**
   * Inicio de sesión fuerte con una llave de acceso (WebAuthn / passkey, antifraude fase 3): el reto sellado que dio
   * `passkeyService.loginOptions` y la firma del dispositivo. Emite la MISMA sesión que la contraseña y respeta las
   * mismas reglas (empresa suspendida, estado, dispositivo y ubicación de un validador: `proofs`).
   */
  loginWithPasskey(assertion: PasskeyAssertion, proofs: LoginProofs = {}): Promise<AuthTokenResponse> {
    return apiRequest<AuthTokenResponse>('/auth/login/passkey', {
      method: 'POST',
      body: { ...assertion, ...proofs },
      auth: false,
      validate: isTokenResponse,
    });
  },

  /** ¿Hay una sesión vigente en este navegador? (lo sabe el backend por la cookie HttpOnly; no la renueva). */
  sessionStatus(): Promise<{ signed_in: boolean }> {
    return apiRequest<{ signed_in: boolean }>('/auth/session', { auth: false, validate: hasKeys<{ signed_in: boolean }>('signed_in') });
  },

  /** Renueva el access token (rota el refresh token de la cookie). */
  refresh(): Promise<AuthTokenResponse> {
    return apiRequest<AuthTokenResponse>('/auth/refresh', { method: 'POST', auth: false, validate: isTokenResponse });
  },

  /** Revoca la sesión en el servidor (por el token activo y por la cookie): el token deja de servir al instante. */
  async logout(): Promise<void> {
    await apiRequest<null | undefined>('/auth/logout', { method: 'POST', validate: isNothing });
  },

  /** Cambia la contraseña; cierra las sesiones de los otros dispositivos (la actual sigue activa). */
  changePassword(currentPassword: string, newPassword: string): Promise<{ revoked_sessions: number }> {
    return apiRequest<{ revoked_sessions: number }>('/auth/change-password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
      validate: hasKeys<{ revoked_sessions: number }>('revoked_sessions'),
    });
  },

  async logoutAll(): Promise<void> {
    await apiRequest<unknown>('/auth/logout-all', { method: 'POST' });
  },

  /** Sesiones abiertas de la cuenta, paginadas (la actual primero). */
  sessions(query: PageQuery, signal?: AbortSignal): Promise<DeviceSessionList> {
    return apiRequest<DeviceSessionList>('/auth/sessions', { query: { ...query }, signal, validate: isSessions });
  },

  async revokeSession(id: string): Promise<void> {
    await apiRequest<null | undefined>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', validate: isNothing });
  },

  me(): Promise<User> {
    return apiRequest<User>('/users/me', { validate: isUser });
  },

  /**
   * EMPLOYEE en varias empresas: entra a una (queda fijada en su sesión del servidor). Si la empresa está inactiva o su
   * acceso a ella está desactivado el servidor responde 401 (`COMPANY_INACTIVE`/`USER_INACTIVE`): es un rechazo de ESTA
   * petición, no una sesión inválida, así que no cierra la sesión (se queda en el selector con el mensaje del servidor).
   */
  selectCompany(companyId: number): Promise<User> {
    return apiRequest<User>('/auth/company', {
      method: 'POST',
      body: { company_id: companyId },
      validate: isUser,
      sessionSafeCodes: COMPANY_SELECT_SAFE_CODES,
    });
  },

  /** Correo recordado en este dispositivo (vive en la BD; el navegador solo tiene una cookie HttpOnly). */
  remembered(): Promise<RememberedAccount | null> {
    return apiRequest<RememberedAccount | null>('/auth/remembered', { auth: false, validate: isRememberedOrNothing });
  },

  /** "Usar otra cuenta": este dispositivo deja de recordar la cuenta. */
  async forgetRemembered(): Promise<void> {
    await apiRequest<null | undefined>('/auth/remembered', { method: 'DELETE', auth: false, validate: isNothing });
  },
};
