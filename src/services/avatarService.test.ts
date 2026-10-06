import { describe, expect, it } from 'vitest';
import { apiOk, mockFetch } from '../test/http';
import { avatarPath, avatarService, blobOf } from './avatarService';

const saved = { avatar: '/users/7/avatar?v=abc', version: 'abc' };

describe('avatarService', () => {
  it('sube la foto con su recorte (multipart) y sin recorte solo el archivo', async () => {
    const { calls } = mockFetch(apiOk(saved));
    const file = new File(['foto'], 'yo.jpg', { type: 'image/jpeg' });
    expect(await avatarService.upload(file, { x: 10, y: 20, size: 300 })).toEqual(saved);
    await avatarService.upload(file, null);
    expect(calls[0].url).toBe('/api/users/me/avatar');
    expect(calls[0].init.method).toBe('PUT');
    const withCrop = calls[0].init.body as FormData;
    expect([withCrop.get('crop_x'), withCrop.get('crop_y'), withCrop.get('crop_size')]).toEqual(['10', '20', '300']);
    expect((withCrop.get('file') as File).name).toBe('yo.jpg');
    expect([...(calls[1].init.body as FormData).keys()]).toEqual(['file']);
  });

  it('quita la foto', async () => {
    const { calls } = mockFetch(apiOk({ avatar: null, version: null }));
    expect(await avatarService.remove()).toEqual({ avatar: null, version: null });
    expect(calls[0].init.method).toBe('DELETE');
  });

  it('lee un tamaño de la ruta versionada y lo convierte en un Blob con su tipo', async () => {
    const { calls } = mockFetch(apiOk({ user_id: 7, size_px: 96, version: 'abc', content_type: 'image/webp', data: btoa('RIFF') }));
    const image = await avatarService.image(saved.avatar, 96);
    expect(calls[0].url).toBe('/api/users/7/avatar?v=abc&size=96');
    expect(image.type).toBe('image/webp');
    expect(await image.text()).toBe('RIFF');
  });

  it('la ruta sin versión también lleva su tamaño; el base64 se decodifica byte por byte', async () => {
    expect(avatarPath('/users/7/avatar', 512)).toBe('/users/7/avatar?size=512');
    expect(new Uint8Array(await blobOf(btoa('ÿ\u0001'), 'image/png').arrayBuffer())).toEqual(new Uint8Array([255, 1]));
  });
});
