import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasskeyError, createPasskey, fromBase64Url, getPasskey, passkeysSupported, toBase64Url } from './webauthn';

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

/** Un `PublicKeyCredential` como lo devuelve el navegador (los bytes como ArrayBuffer). */
function credentialOf(response: object, { withTransports = true } = {}) {
  const full = withTransports ? { ...response, getTransports: () => ['internal', 'hybrid'] } : response;
  return { id: 'Y3JlZA', rawId: bytes(99, 114, 101, 100), type: 'public-key', authenticatorAttachment: 'platform', response: full, getClientExtensionResults: () => ({}) };
}

function stubCredentials(create: () => Promise<unknown>, get: () => Promise<unknown> = create) {
  vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() {});
  Object.defineProperty(navigator, 'credentials', { value: { create, get }, configurable: true });
}

const creation = {
  rp: { id: 'localhost', name: 'Employee Time Clock' },
  user: { id: 'MQ', name: 'ana@empresa.com', displayName: 'ana@empresa.com' },
  challenge: 'cmV0bw',
  pubKeyCredParams: [{ type: 'public-key' as const, alg: -7 }],
  excludeCredentials: [{ id: 'Y3JlZA', type: 'public-key' as const, transports: ['internal'] }],
};
const request = { challenge: 'cmV0bw', rpId: 'localhost', allowCredentials: [] };

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'credentials');
});

describe('base64url', () => {
  it('va y viene sin relleno ni caracteres de URL', () => {
    const data = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const text = toBase64Url(data);
    expect(text).not.toMatch(/[+/=]/);
    expect(Array.from(fromBase64Url(text))).toEqual(Array.from(data));
    expect(toBase64Url(data.buffer)).toBe(text);
    expect(Array.from(fromBase64Url('cmV0bw=='))).toEqual([114, 101, 116, 111]); // también acepta base64 con relleno
    expect(fromBase64Url('').length).toBe(0);
  });
});

describe('llaves de acceso en el navegador', () => {
  it('sin WebAuthn no se admiten y las ceremonias fallan con su motivo', async () => {
    expect(passkeysSupported()).toBe(false);
    await expect(createPasskey(creation)).rejects.toBeInstanceOf(PasskeyError);
    const error = (await getPasskey(request).catch((e: unknown) => e)) as PasskeyError;
    expect(error).toMatchObject({ kind: 'unsupported', name: 'PasskeyError' });
    expect(error.message).toBe('Este navegador no admite llaves de acceso. Usa Safari, Chrome o Edge actualizados.');
  });

  it('registra: convierte las opciones a bytes y la credencial al formato JSON del servidor', async () => {
    const create = vi.fn(() => Promise.resolve(credentialOf({ clientDataJSON: bytes(1, 2), attestationObject: bytes(3) })));
    stubCredentials(create);
    expect(passkeysSupported()).toBe(true);
    const result = await createPasskey(creation);
    const options = (create.mock.calls[0] as unknown as [{ publicKey: PublicKeyCredentialCreationOptions }])[0].publicKey;
    expect(Array.from(new Uint8Array(options.challenge as ArrayBuffer))).toEqual([114, 101, 116, 111]);
    expect(Array.from(new Uint8Array(options.user.id as ArrayBuffer))).toEqual([49]);
    expect(options.excludeCredentials?.[0].transports).toEqual(['internal']);
    expect(result).toEqual({
      id: 'Y3JlZA',
      rawId: 'Y3JlZA',
      type: 'public-key',
      response: { clientDataJSON: 'AQI', attestationObject: 'Aw', transports: ['internal', 'hybrid'] },
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
    });
  });

  it('un navegador sin `getTransports` manda la lista vacía y sin adjunto declarado, null', async () => {
    const bare = { ...credentialOf({ clientDataJSON: bytes(1), attestationObject: bytes(2) }, { withTransports: false }), authenticatorAttachment: undefined };
    stubCredentials(() => Promise.resolve(bare));
    const result = await createPasskey({ ...creation, excludeCredentials: undefined });
    expect(result?.response.transports).toEqual([]);
    expect(result?.authenticatorAttachment).toBeNull();
  });

  it('entrar: firma el reto y devuelve la aserción (con o sin identificador de la persona)', async () => {
    const get = vi.fn(() => Promise.resolve(credentialOf({ clientDataJSON: bytes(1), authenticatorData: bytes(2), signature: bytes(3), userHandle: bytes(49) })));
    stubCredentials(get, get);
    const result = await getPasskey(request);
    const options = (get.mock.calls[0] as unknown as [{ publicKey: PublicKeyCredentialRequestOptions }])[0].publicKey;
    expect(options.rpId).toBe('localhost');
    expect(options.allowCredentials).toEqual([]);
    expect(result?.response).toEqual({ clientDataJSON: 'AQ', authenticatorData: 'Ag', signature: 'Aw', userHandle: 'MQ' });
    const bare = { ...credentialOf({ clientDataJSON: bytes(1), authenticatorData: bytes(2), signature: bytes(3), userHandle: null }), authenticatorAttachment: undefined };
    stubCredentials(get, () => Promise.resolve(bare));
    const second = await getPasskey({ challenge: 'cmV0bw' });
    expect(second?.response.userHandle).toBeNull();
    expect(second?.authenticatorAttachment).toBeNull();
  });

  it('cancelar el aviso del sistema no es una falla (null); otra falla sí lo es', async () => {
    const cancelled = Object.assign(new Error('cancel'), { name: 'NotAllowedError' });
    stubCredentials(() => Promise.reject(cancelled));
    expect(await createPasskey(creation)).toBeNull();
    expect(await getPasskey(request)).toBeNull();
    stubCredentials(() => Promise.resolve(null));
    expect(await createPasskey(creation)).toBeNull();
    stubCredentials(() => Promise.reject(new Error('boom')));
    const failed = (await getPasskey(request).catch((e: unknown) => e)) as PasskeyError;
    expect(failed).toMatchObject({ kind: 'failed' });
    expect(failed.message).toBe('Tu dispositivo no pudo completar la operación. Intenta de nuevo.');
  });
});
