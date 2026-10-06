import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceKeyError, deviceKeyPair, deviceProof, devicePublicKey, requestSignature, signMessage } from './deviceKey';

/** IndexedDB mínima en memoria (jsdom no la trae): guarda objetos tal cual, como el navegador. */
function fakeIndexedDB() {
  const data = new Map<string, unknown>();
  const request = <T>(result: () => T) => {
    const req = { result: undefined as T | undefined, error: null, onsuccess: null as null | (() => void), onerror: null, onupgradeneeded: null as null | (() => void) };
    queueMicrotask(() => {
      req.result = result();
      req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req;
  };
  const store = { get: (key: string) => request(() => data.get(key)), put: (value: unknown, key: string) => request(() => data.set(key, value)) };
  const db = { objectStoreNames: { contains: () => false }, createObjectStore: () => store, transaction: () => ({ objectStore: () => store }) };
  return { open: () => request(() => db), data };
}

describe('llave del dispositivo', () => {
  let idb: ReturnType<typeof fakeIndexedDB>;
  beforeEach(() => {
    idb = fakeIndexedDB();
    vi.stubGlobal('indexedDB', idb);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('se genera una sola vez, la privada no se puede exportar y firma el reto', async () => {
    const pair = await deviceKeyPair();
    expect(pair.privateKey.extractable).toBe(false);
    expect(await deviceKeyPair()).toBe(pair); // la misma llave en cada inicio de sesión
    expect(idb.data.size).toBe(1);

    const proof = await deviceProof('reto-123', 'Safari · iPadOS');
    expect(proof).toMatchObject({ nonce: 'reto-123', name: 'Safari · iPadOS' });
    const signature = Uint8Array.from(atob(proof.signature), (c) => c.charCodeAt(0));
    expect(signature).toHaveLength(64); // r||s, como lo verifica el backend
    const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, signature, new TextEncoder().encode('reto-123'));
    expect(valid).toBe(true);
  });

  it('firma cualquier mensaje con la misma llave (peticiones del validador y kioscos) y entrega su llave pública', async () => {
    const pair = await deviceKeyPair();
    const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    const verify = (signature: string, message: string) => crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, fromBase64(signature), new TextEncoder().encode(message));

    const signed = await signMessage('reto.kiosk.9');
    expect(await verify(signed.signature, 'reto.kiosk.9')).toBe(true);
    expect(await devicePublicKey()).toBe(signed.publicKey); // SPKI en base64: la misma de la firma
    const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
    expect(fromBase64(signed.publicKey)).toEqual(spki);

    const request = await requestSignature('n1', 'n1.qr.abc');
    expect(request).toMatchObject({ signature_key: signed.publicKey, signature_nonce: 'n1' });
    expect(await verify(request.signature, 'n1.qr.abc')).toBe(true);
  });

  it('sin IndexedDB o sin WebCrypto no se puede registrar el dispositivo', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(deviceKeyPair()).rejects.toBeInstanceOf(DeviceKeyError);
    vi.stubGlobal('indexedDB', idb);
    vi.stubGlobal('crypto', {});
    await expect(deviceKeyPair()).rejects.toThrow(/no permite registrar el dispositivo/);
  });

  it('IndexedDB que falla al abrirse (modo privado, sin espacio): rechaza con su error o con DeviceKeyError', async () => {
    const failing = (error: DOMException | null) => ({
      open: () => {
        const req = { error, onerror: null as null | (() => void), onsuccess: null, onupgradeneeded: null };
        queueMicrotask(() => req.onerror?.());
        return req;
      },
    });
    const blocked = new DOMException('Base de datos bloqueada', 'InvalidStateError');
    vi.stubGlobal('indexedDB', failing(blocked));
    await expect(deviceKeyPair()).rejects.toBe(blocked);
    vi.stubGlobal('indexedDB', failing(null)); // el navegador no dice la causa
    await expect(deviceKeyPair()).rejects.toBeInstanceOf(DeviceKeyError);
  });
});
