import jsQR from 'jsqr';
import { useEffect, useRef } from 'react';
import { config } from '../utils/config';

interface QrScannerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onDetect: (content: string) => void | Promise<void>;
}

const MAX_SIDE = 800; // reduce costo de CPU en móviles sin perder legibilidad

/** Escanea frames del video con jsQR (JS puro: funciona en iOS, Android y desktop). */
export function useQrScanner({ videoRef, enabled, onDetect }: QrScannerOptions) {
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  useEffect(() => {
    if (!enabled) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let raf = 0;
    let last = 0;
    let done = false;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (done || now - last < config.qrScanIntervalMs) return;
      last = now;
      const video = videoRef.current;
      if (!ctx || !video || video.readyState < 2 || !video.videoWidth) return;

      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
      if (code?.data) {
        done = true;
        void onDetectRef.current(code.data);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, videoRef]);
}
