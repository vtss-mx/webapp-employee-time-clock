import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceKeyError, deviceKeyPair, deviceProof } from './deviceKey';

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
  const db = { createObjectStore: () => store, transaction: () => ({ objectStore: () => store }) };
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

  it('sin IndexedDB o sin WebCrypto no se puede registrar el dispositivo', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(deviceKeyPair()).rejects.toBeInstanceOf(DeviceKeyError);
    vi.stubGlobal('indexedDB', idb);
    vi.stubGlobal('crypto', {});
    await expect(deviceKeyPair()).rejects.toThrow(/no permite registrar el dispositivo/);
  });
});
