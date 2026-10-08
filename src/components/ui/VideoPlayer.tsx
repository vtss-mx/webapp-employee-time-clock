import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { Button } from './Button';
import { Slider } from './Slider';

interface VideoPlayerProps {
  /** URL local (`blob:`) del video; nunca una URL del bucket. */
  src: string;
  /** Nombre del video para lectores de pantalla. */
  label: string;
  /** El navegador no pudo reproducirlo (formato o archivo dañado). */
  onError?: () => void;
  className?: string;
}

/** «0:07» a partir de segundos. */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * Reproductor de video propio (regla 12: nada de la apariencia nativa del navegador): el `<video>` sin controles y, debajo,
 * reproducir/pausar (`Button`), el avance con el deslizador propio (`Slider`) y el tiempo. Para los clips de la
 * verificación por voz que revisa la empresa (`ValidationReviewPage`).
 */
export function VideoPlayer({ src, label, onError, className }: VideoPlayerProps) {
  const t = useT();
  // El elemento de video como estado: los controles se dibujan cuando existe y trabajan con él directamente.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setDuration(0);
  }, [src]);

  const toggle = (element: HTMLVideoElement) => {
    if (element.paused) void element.play().catch(() => onError?.());
    else element.pause();
  };

  const seek = (element: HTMLVideoElement, seconds: number) => {
    element.currentTime = seconds;
    setTime(seconds);
  };

  return (
    <div className={`video-player ${className ?? ''}`.trim()}>
      <video
        ref={setVideo}
        className="video-player__video"
        src={src}
        playsInline
        preload="metadata"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onError={() => onError?.()}
      />
      {video && (
        <div className="video-player__bar">
          <Button
            variant="secondary"
            iconOnly
            icon={playing ? <Pause size={18} /> : <Play size={18} />}
            aria-label={playing ? t('common.actions.pause') : t('common.actions.play')}
            title={playing ? t('common.actions.pause') : t('common.actions.play')}
            onClick={() => toggle(video)}
          />
          <Slider
            value={Math.min(time, duration || time)}
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.1}
            onChange={(seconds) => seek(video, seconds)}
            label={t('ui.video.position')}
            format={clockText}
            className="video-player__seek"
          />
          <span className="video-player__time" aria-hidden>
            {clockText(time)} / {clockText(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
