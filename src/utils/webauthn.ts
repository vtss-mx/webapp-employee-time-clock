/**
 * Llaves de acceso (WebAuthn / passkeys) sin librería: `navigator.credentials` nativo y base64url propio.
 *
 * El servidor (py_webauthn) manda y recibe el formato JSON de WebAuthn (bytes en base64url). Aquí se convierten a
 * `ArrayBuffer` para el navegador y de regreso, y se envuelven las dos ceremonias: registrar una llave
 * (`createPasskey`) y entrar con una (`getPasskey`). No se usa `PublicKeyCredential.parseCreationOptionsFromJSON`
 * porque Safari lo trae desde iOS 17.4 y Firefox aún no: la conversión manual funciona en todos (compatibilidad
 * universal, `docs/rd/compatibilidad-biometria.md`).
 *
 * Una persona que cancela el aviso del sistema (o deja vencer el tiempo) no es una falla: `createPasskey` y
 * `getPasskey` devuelven `null` y la pantalla no avisa nada. Cualquier otra falla sube como `PasskeyError` con su
 * mensaje traducido al leerse (sigue al idioma activo con el popup abierto).
 */

import { t } from '../i18n/core';

/** Lo que el servidor manda para registrar (`PublicKeyCredentialCreationOptions` en JSON, bytes en base64url). */
export interface CreationOptionsJSON {
  rp: { id?: string; name: string };
  user: { id: string; name: string; displayName: string };
  challenge: string;
  pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
  timeout?: number;
  excludeCredentials?: Array<{ id: string; type: 'public-key'; transports?: string[] }>;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
}

/** Lo que el servidor manda para entrar (`PublicKeyCredentialRequestOptions` en JSON). */
export interface RequestOptionsJSON {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{ id: string; type: 'public-key'; transports?: string[] }>;
  userVerification?: UserVerificationRequirement;
}

/** La credencial recién creada, como la verifica el servidor (bytes en base64url). */
export interface RegistrationResponseJSON {
  id: string;
  rawId: string;
  type: 'public-key';
  response: { clientDataJSON: string; attestationObject: string; transports: string[] };
  authenticatorAttachment: string | null;
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
}

/** La firma del reto al entrar, como la verifica el servidor. */
export interface AuthenticationResponseJSON {
  id: string;
  rawId: string;
  type: 'public-key';
  response: { clientDataJSON: string; authenticatorData: string; signature: string; userHandle: string | null };
  authenticatorAttachment: string | null;
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
}

/** Por qué no se pudo completar la ceremonia (el mensaje se traduce al leerse). */
export type PasskeyFailure = 'unsupported' | 'failed';

export class PasskeyError extends Error {
  constructor(readonly kind: PasskeyFailure) {
    super();
    this.name = 'PasskeyError';
    Object.defineProperty(this, 'message', { get: () => t(`passkeys.errors.${kind}`), configurable: true, enumerable: false });
  }
}

/** Bytes → base64url (sin `=`, con `-` y `_`), como lo espera el servidor. */
export function toBase64Url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url (o base64) → bytes. */
export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** El navegador puede registrar y usar llaves de acceso (Safari, Chrome, Edge y Firefox modernos). */
export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && typeof navigator.credentials?.create === 'function';
}

type Descriptor = { id: string; type: 'public-key'; transports?: string[] };

const descriptors = (list: Descriptor[] | undefined): PublicKeyCredentialDescriptor[] | undefined =>
  list?.map((item) => ({ id: fromBase64Url(item.id), type: item.type, transports: item.transports as AuthenticatorTransport[] | undefined }));

/** El aviso del sistema se cerró sin una llave (la persona canceló o se agotó el tiempo): no es una falla. */
const cancelled = (error: unknown) => error instanceof Error && error.name === 'NotAllowedError';

async function ceremony<T>(run: () => Promise<Credential | null>, serialize: (credential: PublicKeyCredential) => T): Promise<T | null> {
  if (!passkeysSupported()) throw new PasskeyError('unsupported');
  let credential: Credential | null;
  try {
    credential = await run();
  } catch (error) {
    if (cancelled(error)) return null;
    throw new PasskeyError('failed');
  }
  if (!credential) return null;
  return serialize(credential as PublicKeyCredential);
}

/** Registra una llave de acceso en este dispositivo (Face ID, huella o PIN) y la devuelve lista para el servidor. */
export function createPasskey(options: CreationOptionsJSON): Promise<RegistrationResponseJSON | null> {
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: fromBase64Url(options.challenge),
    user: { ...options.user, id: fromBase64Url(options.user.id) },
    excludeCredentials: descriptors(options.excludeCredentials),
  };
  return ceremony(
    () => navigator.credentials.create({ publicKey }),
    (credential) => {
      const response = credential.response as AuthenticatorAttestationResponse;
      return {
        id: credential.id,
        rawId: toBase64Url(credential.rawId),
        type: 'public-key',
        response: {
          clientDataJSON: toBase64Url(response.clientDataJSON),
          attestationObject: toBase64Url(response.attestationObject),
          // Safari anterior a 16 no trae `getTransports`: el servidor acepta la lista vacía.
          transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
        },
        authenticatorAttachment: credential.authenticatorAttachment ?? null,
        clientExtensionResults: credential.getClientExtensionResults(),
      };
    },
  );
}

/** Firma el reto del servidor con una llave de acceso de este dispositivo (la persona elige cuál). */
export function getPasskey(options: RequestOptionsJSON): Promise<AuthenticationResponseJSON | null> {
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: fromBase64Url(options.challenge),
    allowCredentials: descriptors(options.allowCredentials),
  };
  return ceremony(
    () => navigator.credentials.get({ publicKey }),
    (credential) => {
      const response = credential.response as AuthenticatorAssertionResponse;
      return {
        id: credential.id,
        rawId: toBase64Url(credential.rawId),
        type: 'public-key',
        response: {
          clientDataJSON: toBase64Url(response.clientDataJSON),
          authenticatorData: toBase64Url(response.authenticatorData),
          signature: toBase64Url(response.signature),
          userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
        },
        authenticatorAttachment: credential.authenticatorAttachment ?? null,
        clientExtensionResults: credential.getClientExtensionResults(),
      };
    },
  );
}
