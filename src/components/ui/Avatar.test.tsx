import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { clearAvatarCache } from '../../utils/avatarCache';
import { Avatar, AVATAR_TONES, avatarTone } from './Avatar';

const image = (size: number) => apiOk({ user_id: 7, size_px: size, version: 'v1', content_type: 'image/webp', data: btoa('RIFF') });

beforeEach(() => {
  let n = 0;
  Object.assign(URL, { createObjectURL: vi.fn(() => `blob:foto-${(n += 1)}`), revokeObjectURL: vi.fn() });
});
afterEach(() => {
  clearAvatarCache();
  vi.unstubAllGlobals();
});

describe('Avatar', () => {
  it('sin foto: iniciales con un tono estable por nombre y su texto alternativo', async () => {
    render(<Avatar name="Ana Ruiz" />);
    const avatar = screen.getByRole('img', { name: 'Foto de perfil de Ana Ruiz' });
    expect(avatar).toHaveTextContent('AR');
    expect(avatar).toHaveClass('avatar', 'avatar--md', `avatar--tone-${avatarTone('Ana Ruiz')}`);
    expect(avatarTone('Ana Ruiz')).toBe(avatarTone('Ana Ruiz'));
    expect(new Set(['Ana', 'Luis', 'Sofía', 'Pedro', 'Juana', 'María', 'José', 'Rosa', 'Iván', 7, 12].map(avatarTone)).size).toBeGreaterThan(3);
    expect(avatarTone('x')).toBeGreaterThanOrEqual(1);
    expect(avatarTone('x')).toBeLessThanOrEqual(AVATAR_TONES);
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('img', { name: 'Profile photo of Ana Ruiz' })).toBeInTheDocument();
  });

  it('decorativo (junto al nombre escrito) o con texto propio y semilla propia', () => {
    const { container, rerender } = render(<Avatar name="Ana Ruiz" decorative size="sm" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    rerender(<Avatar name="Ana Ruiz" alt="Tú" seed={42} size="xs" className="extra" />);
    expect(screen.getByRole('img', { name: 'Tú' })).toHaveClass('avatar--xs', `avatar--tone-${avatarTone(42)}`, 'extra');
  });

  it('con foto: la pide por la API con la sesión (96 px en tamaños chicos, 512 en grandes) y la muestra', async () => {
    const { calls } = mockFetch((call) => image(call.url.endsWith('512') ? 512 : 96));
    const { container, rerender } = render(<Avatar name="Ana Ruiz" src="/users/7/avatar?v=v1" />);
    await waitFor(() => expect(container.querySelector('img.avatar__image')).toHaveAttribute('src', 'blob:foto-1'));
    expect(container.firstChild).toHaveClass('has-image');
    expect(calls[0].url).toBe('/api/users/7/avatar?v=v1&size=96');
    rerender(<Avatar name="Ana Ruiz" src="/users/7/avatar?v=v1" size="xl" />);
    await waitFor(() => expect(container.querySelector('img.avatar__image')).toHaveAttribute('src', 'blob:foto-2'));
    expect(calls[1].url).toBe('/api/users/7/avatar?v=v1&size=512');
    rerender(<Avatar name="Ana Ruiz" src="/users/7/avatar?v=v1" size="lg" quality={96} />);
    await waitFor(() => expect(container.querySelector('img.avatar__image')).toHaveAttribute('src', 'blob:foto-1')); // ya estaba
    expect(calls).toHaveLength(2);
  });

  it('dos avatares de la misma foto comparten la descarga: si uno sale antes de que llegue, el otro la muestra', async () => {
    let answer: (response: Response) => void = () => undefined;
    const { calls } = mockFetch(() => new Promise<Response>((resolve) => (answer = resolve)));
    const { container, rerender } = render(
      <>
        <Avatar name="Ana Ruiz" src="/users/7/avatar?v=v1" />
        <Avatar name="Ana Ruiz" src="/users/7/avatar?v=v1" />
      </>,
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    rerender(<Avatar name="Ana Ruiz" src="/users/7/avatar?v=v1" />);
    await act(async () => {
      answer(image(96));
      await Promise.resolve();
    });
    await waitFor(() => expect(container.querySelectorAll('img.avatar__image')).toHaveLength(1));
    rerender(<Avatar name="Ana Ruiz" src={null} />); // quitó su foto: vuelven las iniciales
    expect(container.querySelector('img')).toBeNull();
  });

  it('si la foto no llega se quedan las iniciales, sin avisos (es accesoria)', async () => {
    const { calls } = mockFetch(apiFail(503, 'STORAGE_UNAVAILABLE'));
    const { container } = render(<Avatar name="Ana Ruiz" src="/users/7/avatar?v=v1" />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img')).toHaveTextContent('AR');
  });

  it('carga diferida: con IntersectionObserver solo la pide al acercarse a la pantalla', async () => {
    let notify: (records: { isIntersecting: boolean }[]) => void = () => undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (records: { isIntersecting: boolean }[]) => void) {
          notify = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const { calls } = mockFetch(image(96));
    const { container, unmount } = render(<Avatar name="Ana Ruiz" src="/users/7/avatar?v=v1" />);
    act(() => notify([{ isIntersecting: false }]));
    expect(calls).toHaveLength(0);
    act(() => notify([{ isIntersecting: true }]));
    await waitFor(() => expect(container.querySelector('img.avatar__image')).not.toBeNull());
    expect(disconnect).toHaveBeenCalled();
    unmount();
  });
});
