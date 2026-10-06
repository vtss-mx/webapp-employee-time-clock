import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiOk, mockFetch } from '../test/http';
import { adminService } from './adminService';
import { checkpointService } from './checkpointService';
import { signingNonce } from './http/requestSigning';
import { reloadApp } from './versionService';

const company = { id: 5, name: 'Abarrotes', active: true, employee_count: 0 };
const result = { verified: true, method: 'FACE', message: 'ok' };

describe('servicios: cuerpos que se envían', () => {
  it('editar empresa: recorta textos, límite vacío = sin límite y no envía los campos sin valor', async () => {
    const { calls } = mockFetch(apiOk(company));
    await adminService.update(5, { name: '  Abarrotes  ', legal_name: undefined, max_employees: '' });
    expect(calls[0].init.method).toBe('PUT');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: 'Abarrotes', max_employees: null });
  });

  it('identificar por rostro: con QR envía su contenido; sin QR busca entre todos (1:N)', async () => {
    const { calls } = mockFetch(apiOk(result));
    signingNonce.remember(null); // el perfil ya dijo que la empresa no pide firma: nada que pedir antes
    const captures = { frontal: [new Blob(['f'])] };
    await checkpointService.identifyFace(captures, 'TCQR2:abc');
    await checkpointService.identifyFace(captures);
    const [withQr, withoutQr] = calls.map((call) => call.init.body as FormData);
    expect(calls.map((call) => call.url)).toEqual(['/api/checkpoint/identify/face', '/api/checkpoint/identify/face']);
    expect(withQr.get('qr_content')).toBe('TCQR2:abc');
    expect(withoutQr.has('qr_content')).toBe(false);
    expect(withoutQr.getAll('images')).toHaveLength(1);
  });
});

describe('recarga de la aplicación', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recarga la página actual (versión nueva publicada)', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    reloadApp();
    expect(reload).toHaveBeenCalledOnce();
  });
});
