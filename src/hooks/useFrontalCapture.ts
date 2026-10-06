import { useCallback, useState } from 'react';
import { config } from '../utils/config';
import { nextVideoFrame } from '../utils/videoFrames';
import { sleep } from '../utils/waits';
import type { CameraController } from './useCamera';

/** Cómo se toman las fotos de frente (el registro facial: fotos completas, más chicas y seguidas). */
export interface FrontalPhoto {
  /** Lado mayor de cada foto (px). */
  maxSide: number;
  /** Pausa mínima entre una foto y la siguiente (ms); cada una espera además un cuadro nuevo del video. */
  gapMs: number;
}

/** La foto que se está tomando y cuántas son (mensaje «Capturando 2 de 3…» y barra de la etapa). */
export interface CaptureCount {
  current: number;
  total: number;
}

export interface FrontalCapture {
  /** La foto en curso (null fuera de la toma). */
  capture: CaptureCount | null;
  /** Fotos tomadas en este escaneo (el anillo de 36 marcas las cuenta). */
  photos: number;
  /** Toma las fotos de frente, una tras otra; lanza si la cámara falla (quien llama decide). */
  take: () => Promise<Blob[]>;
  /** Olvida la toma (otro escaneo empieza de cero). */
  clear: () => void;
}

/**
 * Las fotos de frente de un escaneo facial (`LiveFaceFlow`): las de una verificación (las capturas de siempre, con
 * `config.faceFrameGapMs` entre una y otra) o las del registro facial (`frontalPhoto`: fotos completas de su tamaño, con
 * su pausa). Cada una espera además un cuadro NUEVO del video (`nextVideoFrame`): dos fotos nunca son el mismo cuadro.
 * Nada de leer píxeles en el hilo de la interfaz: cada foto es un `drawImage` y un `toBlob` asíncrono (`useCamera`).
 */
export function useFrontalCapture(camera: CameraController, frontalFrames: number, frontalPhoto?: FrontalPhoto): FrontalCapture {
  const [capture, setCapture] = useState<CaptureCount | null>(null);
  const [photos, setPhotos] = useState(0);
  const side = frontalPhoto?.maxSide;
  const gap = frontalPhoto?.gapMs ?? config.faceFrameGapMs;

  const take = useCallback(async (): Promise<Blob[]> => {
    const frames: Blob[] = [];
    for (let i = 0; i < frontalFrames; i++) {
      setCapture({ current: i + 1, total: frontalFrames });
      frames.push(await camera.captureFrame(side ? { maxSide: side } : undefined));
      setPhotos(frames.length);
      if (i < frontalFrames - 1) await Promise.all([sleep(gap), nextVideoFrame(camera.videoRef.current, config.faceFrameGapMs)]);
    }
    setCapture(null);
    return frames;
  }, [camera, frontalFrames, gap, side]);

  const clear = useCallback(() => {
    setCapture(null);
    setPhotos(0);
  }, []);

  return { capture, photos, take, clear };
}
