import { afterEach, describe, expect, it, vi } from 'vitest';
import { deviceStore } from './deviceStore';

/** IndexedDB en memoria con almacenes por nombre y versión (jsdom no la trae). */
function fakeIndexedDB(existing: string[] = []) {
  const stores = new Map<string, Map<string, unknown>>(existing.map((name) => [name, new Map()]));
  const created: string[] = [];
  const request = <T>(result: () => T, upgrade = false) => {
    const req = { result: undefined as T | undefined, error: null, onsuccess: null as null | (() => void), onerror: null, onupgradeneeded: null as null | (() => void) };
    queueMicrotask(() => {
      req.result = result();
      if (upgrade) req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req;
  };
  const storeOf = (name: string) => {
    const data = stores.get(name) as Map<string, unknown>;
    return { get: (key: string) => request(() => data.get(key)), put: (value: unknown, key: string) => request(() => data.set(key, value)) };
  };
  const db = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore: (name: string) => {
      stores.set(name, new Map());
      created.push(name);
    },
    transaction: (name: string) => ({ objectStore: () => storeOf(name) }),
  };
  return { open: vi.fn((_name: string, _version: number) => request(() => db, true)), stores, created };
}

afterEach(() => vi.unstubAllGlobals());

describe('almacén del dispositivo (IndexedDB, nunca localStorage)', () => {
  it('guarda y lee objetos tal cual (sin convertirlos a texto)', async () => {
    const idb = fakeIndexedDB();
    vi.stubGlobal('indexedDB', idb);
    await deviceStore.set('tc.camera.user', { deviceId: 'cam-1', kind: 'front' });
    expect(await deviceStore.get('tc.camera.user')).toEqual({ deviceId: 'cam-1', kind: 'front' });
    expect(await deviceStore.get('otra')).toBeUndefined();
    expect(idb.open).toHaveBeenCalledWith('tc-device', 2);
  });

  it('al actualizar un dispositivo con la versión 1 agrega el almacén nuevo sin tocar la llave', async () => {
    const idb = fakeIndexedDB(['keys']);
    idb.stores.get('keys')?.set('validator-device', 'llave');
    vi.stubGlobal('indexedDB', idb);
    await deviceStore.set('x', 1);
    expect(idb.created).toEqual(['prefs']);
    expect(idb.stores.get('keys')?.get('validator-device')).toBe('llave');
  });

  it('sin IndexedDB (modo privado estricto) no recuerda nada y la app sigue', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(deviceStore.set('x', 1)).resolves.toBeUndefined();
    await expect(deviceStore.get('x')).resolves.toBeUndefined();
  });

  it('si el navegador rechaza abrir la base, tampoco falla', async () => {
    const failing = {
      open: () => {
        const req = { error: new DOMException('bloqueada'), onsuccess: null, onerror: null as null | (() => void), onupgradeneeded: null };
        queueMicrotask(() => req.onerror?.());
        return req;
      },
    };
    vi.stubGlobal('indexedDB', failing);
    await expect(deviceStore.get('x')).resolves.toBeUndefined();
    await expect(deviceStore.set('x', 1)).resolves.toBeUndefined();
  });
});
