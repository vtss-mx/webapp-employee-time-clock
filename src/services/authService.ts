import type { AuthTokenResponse, DeviceSession, RememberedAccount, User } from '../types';
import { hasKeys, isArrayOf, isNothing } from '../utils/guards';
import { apiRequest } from './apiClient';

const isUser = hasKeys<User>('id', 'email', 'role');
const isTokenResponse = (value: unknown): value is AuthTokenResponse =>
  hasKeys<AuthTokenResponse>('access_token', 'expires_in', 'session_id', 'user')(value) && isUser(value.user);
const isSessions = isArrayOf<DeviceSession[]>(hasKeys('id', 'created_at', 'current'));
const isRemembered = hasKeys<RememberedAccount>('email');
const isRememberedOrNothing = (value: unknown): value is RememberedAccount | null => value === null || isRemembered(value);

/**
 * Autenticación. Los endpoints de sesión usan `auth: false` (no requieren access token) y la
 * cookie HttpOnly del refresh token, que el navegador envía solo a /api/auth.
 */
export const authService = {
  /** `remember`: la sesión sobrevive al cierre del navegador (cookie persistente, máx. 12 h). */
  login(email: string, password: string, remember = false): Promise<AuthTokenResponse> {
    return apiRequest<AuthTokenResponse>('/auth/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password, remember },
      auth: false,
      validate: isTokenResponse,
    });
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

  sessions(): Promise<DeviceSession[]> {
    return apiRequest<DeviceSession[]>('/auth/sessions', { validate: isSessions });
  },

  async revokeSession(id: string): Promise<void> {
    await apiRequest<null | undefined>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', validate: isNothing });
  },

  me(): Promise<User> {
    return apiRequest<User>('/users/me', { validate: isUser });
  },

  /** EMPLOYEE en varias empresas: entra a una (queda fijada en su sesión del servidor). */
  selectCompany(companyId: number): Promise<User> {
    return apiRequest<User>('/auth/company', { method: 'POST', body: { company_id: companyId }, validate: isUser });
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
