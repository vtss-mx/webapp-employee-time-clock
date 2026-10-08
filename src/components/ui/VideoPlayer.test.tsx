import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { clockText, VideoPlayer } from './VideoPlayer';

describe('VideoPlayer: reproductor propio sin controles nativos', () => {
  it('el video no lleva controles del navegador; reproducir y pausar son botones propios', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event('pause'));
    });
    const { container } = render(<VideoPlayer src="blob:clip" label="Respuesta 1" />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.hasAttribute('controls')).toBe(false);
    expect(video.getAttribute('aria-label')).toBe('Respuesta 1');
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }));
    expect(play).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Pausar' })).toBeInTheDocument();
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(pause).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('muestra el tiempo con la duración, se puede buscar con el deslizador y avisa si no se puede reproducir', () => {
    const onError = vi.fn();
    const { container } = render(<VideoPlayer src="blob:clip" label="Respuesta" onError={onError} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 7.4, configurable: true });
    fireEvent.loadedMetadata(video);
    Object.defineProperty(video, 'currentTime', { value: 3, writable: true, configurable: true });
    fireEvent.timeUpdate(video);
    expect(screen.getByText('0:03 / 0:07')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Posición del video' }), { target: { value: '5' } });
    expect(video.currentTime).toBe(5);
    fireEvent.ended(video);
    fireEvent.error(video);
    expect(onError).toHaveBeenCalledTimes(1);
    // Una duración desconocida (Infinity en un WebM sin cabecera) se muestra como 0:00.
    Object.defineProperty(video, 'duration', { value: Infinity, configurable: true });
    fireEvent.loadedMetadata(video);
    expect(screen.getByText('0:05 / 0:00')).toBeInTheDocument();
  });

  it('un play rechazado por el navegador avisa el error', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('NotSupportedError'));
    const onError = vi.fn();
    render(<VideoPlayer src="blob:clip" label="Respuesta" onError={onError} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }));
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    vi.restoreAllMocks();
  });

  it('clockText', () => {
    expect(clockText(0)).toBe('0:00');
    expect(clockText(65.9)).toBe('1:05');
    expect(clockText(Number.NaN)).toBe('0:00');
    expect(clockText(-3)).toBe('0:00');
  });
});
