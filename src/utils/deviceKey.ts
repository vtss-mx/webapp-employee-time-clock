/**
 * Llave del dispositivo (validadores): ECDSA P-256 generada en este navegador con WebCrypto y
 * guardada en IndexedDB como NO exportable. Con ella el dispositivo firma el reto del servidor al
 * iniciar sesión; la empresa autoriza cada llave (cada tableta o teléfono). Como la llave privada no
 * se puede leer ni copiar, la sesión no se puede trasladar a otro equipo.
 */

import { deviceObjectStore, idbRequest } from './indexedDb';

const KEY_ID = 'validator-device';

export class DeviceKeyError extends Error {
  constructor() {
    super('Este navegador no permite registrar el dispositivo. Usa Safari o Chrome actualizados, fuera del modo privado.');
    this.name = 'DeviceKeyError';
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

/** Firma el reto del servidor con la llave del dispositivo (ECDSA P-256/SHA-256, r||s). */
export async function deviceProof(nonce: string, name: string): Promise<DeviceProof> {
  const pair = await deviceKeyPair();
  const subtle = globalThis.crypto.subtle;
  const [spki, signature] = await Promise.all([
    subtle.exportKey('spki', pair.publicKey),
    subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(nonce)),
  ]);
  return { public_key: toBase64(spki), nonce, signature: toBase64(signature), name: name.slice(0, 120) };
}
