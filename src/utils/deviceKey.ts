/**
 * Llave del dispositivo: ECDSA P-256 generada en este navegador con WebCrypto y guardada en IndexedDB como NO
 * exportable. Como la llave privada no se puede leer ni copiar, prueba "este navegador en este equipo":
 * - validadores: firma el reto del servidor al iniciar sesión y la empresa autoriza cada llave;
 * - empleados (antifraude 1b, decisión D2): firma el reto que llega con el de la prueba de vida en cada registro o
 *   verificación (`services/http/faceUpload.ts`); el servidor guarda solo el hash de la llave pública;
 * - validadores (antifraude 2b): firma cada identificación (`requestSignature`, `services/http/requestSigning.ts`);
 * - kioscos de los sitios (antifraude 2b): se vinculan con su llave pública y firman cada código que piden.
 * Es UNA llave por navegador (la misma para cualquier cuenta que lo use: así se ve un teléfono compartido).
 */

import { t } from '../i18n/core';
import { deviceObjectStore, idbRequest } from './indexedDb';

/** Su nombre en IndexedDB (se conserva: cambiarlo dejaría sin su llave a los validadores ya autorizados). */
const KEY_ID = 'validator-device';

/** El navegador no puede guardar la llave (sin WebCrypto o sin IndexedDB, p. ej. en modo privado). */
export class DeviceKeyError extends Error {
  constructor() {
    super();
    this.name = 'DeviceKeyError';
    // El texto se traduce al leerse: el popup del inicio de sesión abierto sigue al idioma activo.
    Object.defineProperty(this, 'message', { get: () => t('services.deviceKey.unavailable'), configurable: true, enumerable: false });
  }
}

/** Lo que el backend recibe en `device` al iniciar sesión. */
export interface DeviceProof {
  public_key: string;
  nonce: string;
  signature: string;
  name: string;
}

const unavailable = () => new DeviceKeyError();
const request = <T>(req: IDBRequest<T>) => idbRequest(req, unavailable);
const openStore = (mode: IDBTransactionMode) => deviceObjectStore('keys', mode, unavailable);

/** La llave de este dispositivo; la primera vez se genera (la privada, no exportable). */
export async function deviceKeyPair(): Promise<CryptoKeyPair> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new DeviceKeyError();
  const saved = await request((await openStore('readonly')).get(KEY_ID) as IDBRequest<CryptoKeyPair | undefined>);
  if (saved?.privateKey && saved.publicKey) return saved;
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  await request((await openStore('readwrite')).put(pair, KEY_ID));
  return pair;
}

const toBase64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

/** Un mensaje firmado: la llave pública (SPKI DER en base64) y la firma (ECDSA P-256/SHA-256, r||s, base64). */
export interface SignedMessage {
  publicKey: string;
  signature: string;
}

/** Firma un mensaje (texto UTF-8) con la llave del dispositivo; única implementación de la firma. */
export async function signMessage(message: string): Promise<SignedMessage> {
  const pair = await deviceKeyPair();
  const subtle = globalThis.crypto.subtle;
  const [spki, signature] = await Promise.all([
    subtle.exportKey('spki', pair.publicKey),
    subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(message)),
  ]);
  return { publicKey: toBase64(spki), signature: toBase64(signature) };
}

/** La llave pública de este dispositivo (SPKI DER en base64): con ella se vincula un kiosco. */
export async function devicePublicKey(): Promise<string> {
  const pair = await deviceKeyPair();
  return toBase64(await globalThis.crypto.subtle.exportKey('spki', pair.publicKey));
}

/** Firma el reto del servidor con la llave del dispositivo (ECDSA P-256/SHA-256, r||s). */
export async function deviceProof(nonce: string, name: string): Promise<DeviceProof> {
  const { publicKey, signature } = await signMessage(nonce);
  return { public_key: publicKey, nonce, signature, name: name.slice(0, 120) };
}

/** Los campos de una petición firmada (antifraude 2b): la llave, el reto con que se firmó y la firma. */
export interface RequestSignature {
  signature_key: string;
  signature_nonce: string;
  signature: string;
}

/** Firma una petición (`message` ya incluye el reto: `"{reto}.{acción}.{huella}"`) y arma sus campos. */
export async function requestSignature(nonce: string, message: string): Promise<RequestSignature> {
  const { publicKey, signature } = await signMessage(message);
  return { signature_key: publicKey, signature_nonce: nonce, signature };
}
