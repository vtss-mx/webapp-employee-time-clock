import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireAvatar, avatarCacheSize, clearAvatarCache, releaseAvatar } from './avatarCache';
import { config } from './config';

let created = 0;
const revoke = vi.fn();
const blob = () => Promise.resolve(new Blob(['x'], { type: 'image/webp' }));

beforeEach(() => {
  created = 0;
  revoke.mockReset();
  Object.assign(URL, { createObjectURL: vi.fn(() => `blob:foto-${(created += 1)}`), revokeObjectURL: revoke });
});
afterEach(() => clearAvatarCache());

describe('fotos de perfil en memoria de la página', () => {
  it('una descarga por foto: los avatares de la misma persona comparten la URL', async () => {
    const load = vi.fn(blob);
    const [first, second] = await Promise.all([acquireAvatar('a', load), acquireAvatar('a', load)]);
    expect(first).toBe('blob:foto-1');
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    releaseAvatar('a');
    releaseAvatar('a');
    releaseAvatar('a'); // de más: no pasa nada
    releaseAvatar('nunca-pedida');
    expect(avatarCacheSize()).toBe(1); // se conserva para volver a la pantalla sin descargar
    expect(await acquireAvatar('a', load)).toBe('blob:foto-1');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('las que nadie muestra se liberan de la más vieja a la más nueva al pasar el tope; las visibles nunca', async () => {
    const limit = config.avatarCacheEntries;
    await acquireAvatar('visible', blob);
    for (let i = 0; i < limit + 2; i += 1) {
      await acquireAvatar(`idle-${i}`, blob);
      releaseAvatar(`idle-${i}`);
    }
    expect(avatarCacheSize()).toBe(limit + 1);
    expect(revoke).toHaveBeenCalledWith('blob:foto-2'); // idle-0
    expect(revoke).toHaveBeenCalledWith('blob:foto-3'); // idle-1
    expect(revoke).not.toHaveBeenCalledWith('blob:foto-1');
  });

  it('salir antes de que llegue cancela la descarga; una que falla se vuelve a pedir', async () => {
    let signal: AbortSignal | undefined;
    const pending = acquireAvatar('lenta', (s) => {
      signal = s;
      return new Promise<Blob>((_, reject) => s.addEventListener('abort', () => reject(new DOMException('cancelada', 'AbortError'))));
    });
    releaseAvatar('lenta');
    expect(signal?.aborted).toBe(true);
    await expect(pending).rejects.toThrow('cancelada');
    expect(avatarCacheSize()).toBe(0);

    await expect(acquireAvatar('rota', () => Promise.reject(new Error('503')))).rejects.toThrow('503');
    expect(avatarCacheSize()).toBe(0);
    expect(await acquireAvatar('rota', blob)).toMatch(/^blob:/);
  });

  it('al cerrar sesión se cancela lo pendiente y se liberan todas', async () => {
    let signal: AbortSignal | undefined;
    await acquireAvatar('lista', blob);
    void acquireAvatar('pendiente', (s) => {
      signal = s;
      return new Promise<Blob>(() => undefined);
    });
    clearAvatarCache();
    expect(signal?.aborted).toBe(true);
    expect(revoke).toHaveBeenCalledWith('blob:foto-1');
    expect(avatarCacheSize()).toBe(0);
  });
});
