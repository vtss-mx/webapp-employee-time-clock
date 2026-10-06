/** Tipos de la sesión (contrato de `/auth/*`); se reexportan desde `types/index.ts`. */
import type { Page, User } from './index';

/** Respuesta de /auth/login y /auth/refresh. El refresh token viaja en una cookie HttpOnly. */
export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  /** Segundos de vigencia del access token (12 h). */
  expires_in: number;
  expires_at: string;
  session_id: string;
  user: User;
}

/** Sesión en memoria (nunca se persiste el token). */
export interface Session {
  token: string;
  user: User;
  sessionId: string;
  expiresAt: number; // epoch ms
}

export interface DeviceSession {
  id: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  current: boolean;
}

export type DeviceSessionList = Page<DeviceSession>;
