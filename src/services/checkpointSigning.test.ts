import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { identifiedResult, sampleCheckpoint } from '../test/fixtures';
import { apiOk, jsonResponse, mockFetch, envelope, type MockCall } from '../test/http';
import { checkpointService } from './checkpointService';
import { sha256Hex } from '../utils/digest';
import { signingNonce } from './http/requestSigning';

// La firma real se prueba en `utils/deviceKey.test.ts`; aquí, qué firma cada identificación y qué viaja con ella.
vi.mock('../utils/deviceKey', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requestSignature: (nonce: string, message: string) => Promise.resolve({ signature_key: 'KEY', signature_nonce: nonce, signature: `sig(${message})` }),
}));

const NONCE = `${Math.floor(Date.now() / 1000) + 600}.sal.mac`;
const NEXT = `${Math.floor(Date.now() / 1000) + 900}.otra.mac`;
const HERE = { latitude: 29.1, longitude: -110.9, accuracy: 15, samples: [{ latitude: 29.1, longitude: -110.9, accuracy: 15 }] };
const json = (call: MockCall) => JSON.parse(call.init.body as string) as Record<string, unknown>;
const form = (call: MockCall) => call.init.body as FormData;

/** El servidor: el perfil con el reto y cada identificación con el siguiente. */
function server() {
  return mockFetch((call) => {
    if (call.url.endsWith('/checkpoint/me')) return apiOk({ ...sampleCheckpoint, device_nonce: NONCE, location_required: true });
    if (call.url.endsWith('/qr/inspect')) return apiOk({ employee_id: 7, name: 'Ana Ruiz', employee_number: 'EMP-7', device_nonce: NEXT });
    return apiOk({ ...identifiedResult, device_nonce: NEXT });
  });
}

beforeEach(() => signingNonce.reset());
afterEach(() => signingNonce.reset());

describe('punto de control: identificaciones firmadas y con ubicación', () => {
  it('QR: sin reto pide el perfil antes; firma la huella del QR, manda la ubicación y guarda el reto siguiente', async () => {
    const { calls } = server();
    await checkpointService.identifyQr('TCQR2:abc', HERE);
    expect(calls.map((c) => c.url)).toEqual(['/api/checkpoint/me', '/api/checkpoint/identify/qr']);
    const digest = await sha256Hex(new Blob(['TCQR2:abc']));
    expect(json(calls[1])).toEqual({
      qr_content: 'TCQR2:abc',
      signature_key: 'KEY',
      signature_nonce: NONCE,
      signature: `sig(${NONCE}.qr.${digest})`,
      location: { latitude: 29.1, longitude: -110.9, accuracy: 15 },
      location_samples: [{ latitude: 29.1, longitude: -110.9, accuracy: 15 }],
    });
    expect(signingNonce.value()).toBe(NEXT);
  });

  it('de quién es el QR y rostro: sin reto también piden el perfil antes; con ubicación la mandan', async () => {
    const { calls } = server();
    await checkpointService.inspectQr('TCQR2:xyz', HERE);
    expect(json(calls[1])).toMatchObject({ signature_nonce: NONCE, location: { latitude: 29.1, longitude: -110.9, accuracy: 15 } });
    signingNonce.reset();
    await checkpointService.identifyFace({ frontal: [new Blob(['f'])] });
    expect(calls.map((c) => c.url)).toEqual(['/api/checkpoint/me', '/api/checkpoint/qr/inspect', '/api/checkpoint/me', '/api/checkpoint/identify/face']);
  });

  it('de quién es el QR (inspect): firma como `inspect`; sin ubicación no la manda', async () => {
    const { calls } = server();
    signingNonce.remember(NONCE);
    const holder = await checkpointService.inspectQr('TCQR2:xyz');
    expect(holder.name).toBe('Ana Ruiz');
    const body = json(calls[0]);
    expect(body.signature).toBe(`sig(${NONCE}.inspect.${await sha256Hex(new Blob(['TCQR2:xyz']))})`);
    expect(body).not.toHaveProperty('location');
    expect(signingNonce.value()).toBe(NEXT);
  });

  it('rostro: firma la PRIMERA captura frontal y manda la ubicación como campos del formulario', async () => {
    const { calls } = server();
    signingNonce.remember(NONCE);
    const first = new Blob(['frontal-1']);
    await checkpointService.identifyFace({ frontal: [first, new Blob(['frontal-2'])] }, 'TCQR2:abc', HERE);
    const sent = form(calls[0]);
    expect(sent.get('signature')).toBe(`sig(${NONCE}.face.${await sha256Hex(first)})`);
    expect(sent.get('signature_nonce')).toBe(NONCE);
    expect(sent.get('qr_content')).toBe('TCQR2:abc');
    expect([sent.get('latitude'), sent.get('longitude'), sent.get('accuracy')]).toEqual(['29.1', '-110.9', '15']);
    expect(JSON.parse(sent.get('location_samples') as string)).toEqual(HERE.samples);
    await checkpointService.identifyFace({ frontal: [first] }, undefined, null);
    expect(form(calls[1]).has('latitude')).toBe(false);
    expect(form(calls[1]).has('qr_content')).toBe(false);
  });

  it('reto vencido: el servidor manda otro en el detalle y la identificación se repite sola, una vez', async () => {
    signingNonce.remember(NONCE);
    const stale = { code: 'SIGNATURE_STALE', message: 'El reto venció', field: null, details: { device_nonce: NEXT } };
    let first = true;
    const { calls } = mockFetch(() => {
      if (!first) return apiOk(identifiedResult);
      first = false;
      return jsonResponse(envelope(null, { status: 403, code: 'SIGNATURE_STALE', message: 'El reto venció', errors: [stale] }), 403);
    });
    expect((await checkpointService.identifyQr('TCQR2:abc')).verified).toBe(true);
    expect(calls.map((c) => json(c).signature_nonce)).toEqual([NONCE, NEXT]);
  });

  it('un perfil sin el dato (otra versión del servidor) cuenta como "sin firma"', async () => {
    const { device_nonce: _omitted, ...legacy } = sampleCheckpoint;
    mockFetch(apiOk(legacy));
    await checkpointService.profile();
    expect([signingNonce.stale(), signingNonce.value()]).toEqual([false, null]);
  });
});
