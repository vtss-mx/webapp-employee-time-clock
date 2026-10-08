// Llaves de acceso (WebAuthn / passkeys, antifraude fase 3): contrato de `/api/auth/passkeys` y del inicio de sesión
// con llave (`/api/auth/login/passkey`).
import type { AuthenticationResponseJSON, CreationOptionsJSON, RegistrationResponseJSON, RequestOptionsJSON } from '../utils/webauthn';
import type { Page } from './index';

/** Una llave de acceso registrada por la persona (la llave privada nunca sale de su dispositivo o de su cuenta). */
export interface Passkey {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
  /** Cómo se conecta el autenticador (`internal`, `hybrid`, `usb`...); informativo. */
  transports: string[];
  /** Sincronizada en la nube de la plataforma (iCloud, Google): sobrevive a perder el dispositivo. */
  backed_up: boolean;
}

export type PasskeyList = Page<Passkey>;

/** El reto sellado (`token`, de un solo uso) y las opciones para `navigator.credentials.create`. */
export interface PasskeyRegistrationOptions {
  token: string;
  options: CreationOptionsJSON;
}

/** El reto sellado y las opciones para `navigator.credentials.get` (sin lista de llaves: la persona elige). */
export interface PasskeyLoginOptions {
  token: string;
  options: RequestOptionsJSON;
}

export interface PasskeyRegistration {
  token: string;
  name: string;
  credential: RegistrationResponseJSON;
}

export interface PasskeyAssertion {
  token: string;
  credential: AuthenticationResponseJSON;
  remember: boolean;
}
