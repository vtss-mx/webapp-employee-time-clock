import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CameraTurnedError } from '../utils/cameraDiagnostics';
import { config } from '../utils/config';
import { nextVideoFrame } from '../utils/videoFrames';
import { sleep } from '../utils/waits';
import type { CameraController } from './useCamera';
import type { FaceGuidance } from './useFaceDetection';

/** Cómo se toman las fotos de frente (el registro facial: fotos completas, más chicas y seguidas). */
export interface FrontalPhoto {
  /** Lado mayor de cada foto (px). */
  maxSide: number;
  /** Pausa mínima entre una foto y la siguiente (ms); cada una espera además un cuadro nuevo del video. */
  gapMs: number;
  /**
   * Registro facial (decisión del dueño, 2026-10-06 y 2026-10-07): solo cuentan las fotos VÁLIDAS y nunca se repite el
   * proceso. Un cuadro cuenta cuando el detector lo da por válido (`ready` = `isSteadyGuidance`): rostro completo dentro
   * de la guía, centrado, de frente, con luz, QUIETO y ENFOCADO —la nitidez por el Laplaciano ya es parte de la guía
   * (`useFaceAutoCapture` con `quality`: un cuadro borroso es `blurry`, no `hold_still`)—; los demás no se toman ni cuentan
   * y el escaneo espera a la persona lo que haga falta (el único tope es el del reto, que se renueva solo).
   */
  valid?: { ready: () => boolean };
}

/** La foto que se está tomando y cuántas son (mensaje «Capturando 2 de 3…» y barra de la etapa). */
export interface CaptureCount {
  current: number;
  total: number;
}

export interface FrontalCapture {
  /** La foto en curso (null fuera de la toma). */
  capture: CaptureCount | null;
  /** Fotos VÁLIDAS tomadas en este escaneo (el anillo las cuenta). */
  photos: number;
  /** Toma las fotos de frente, una tras otra; lanza si la cámara falla (quien llama decide). */
  take: () => Promise<Blob[]>;
  /**
   * Una captura más de la MISMA toma y del mismo tamaño que las fotos de frente (cada movimiento y cada color del
   * destello): el servidor exige que todas las capturas de un intento tengan la misma resolución (`ensure_same_take`:
   * salen del mismo flujo de la cámara) y mide la continuidad del rostro entre ellas en píxeles. Un registro facial con
   * fotos de 640 px y movimientos de 1280 px se rechazaba como CAPTURE_INCONSISTENT en cualquier navegador.
   */
  shot: () => Promise<Blob>;
  /**
   * El último cuadro capturado de este escaneo (o null si aún no hay). La vigilancia continua de accesorios lo reutiliza
   * mientras se toman las fotos, en lugar de capturar otro: así no agrega capturas a la toma (decisión del dueño,
   * 2026-10-07; mantiene «una sola resolución por toma» y no infla el conteo de cuadros).
   */
  last: () => Blob | null;
  /** Olvida la toma (otro escaneo empieza de cero; una toma en curso se detiene). */
  clear: () => void;
}

/**
 * Las fotos de frente de un escaneo facial (`LiveFaceFlow`): las de una verificación (las capturas de siempre, con
 * `config.faceFrameGapMs` entre una y otra) o las del registro facial (`frontalPhoto`: fotos completas de su tamaño, con
 * su pausa, contando solo las VÁLIDAS). Cada una espera además un cuadro NUEVO del video (`nextVideoFrame`): dos fotos
 * nunca son el mismo cuadro. Nada de leer píxeles grandes en el hilo de la interfaz: cada foto es un `drawImage` y un
 * `toBlob` asíncrono (`useCamera`); la revisión de calidad lee 96 × 96 píxeles del rostro.
 *
 * La toma no tiene tope de cuadros (decisión del dueño, 2026-10-07: «no se debe repetir»): espera a que el rostro sea
 * válido. Por eso se detiene sola al cerrar la pantalla o al empezar otro escaneo (`clear`): devuelve lo que llevaba y
 * quien la esperaba ya no está.
 */
export function useFrontalCapture(camera: CameraController, frontalFrames: number, frontalPhoto?: FrontalPhoto): FrontalCapture {
  const [capture, setCapture] = useState<CaptureCount | null>(null);
  const [photos, setPhotos] = useState(0);
  const side = frontalPhoto?.maxSide;
  const gap = frontalPhoto?.gapMs ?? config.faceFrameGapMs;
  const valid = frontalPhoto?.valid;

  /** Tamaño de la imagen de la cámara al empezar la toma (ancho × alto): todas sus capturas lo comparten. */
  const takeSize = useRef<string | null>(null);
  /** El último cuadro capturado (para reutilizarlo en la vigilancia de accesorios sin tomar otro). */
  const lastRef = useRef<Blob | null>(null);
  /** Número de la toma en curso: `clear` (o salir de la pantalla) la cambia y la toma que corría se detiene. */
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const { videoRef } = camera;
  const videoSize = useCallback(() => {
    const video = videoRef.current;
    return video?.videoWidth ? `${video.videoWidth}x${video.videoHeight}` : null;
  }, [videoRef]);

  const shot = useCallback(async () => {
    const size = videoSize();
    // El teléfono giró a media toma: se repite antes de mandar capturas de dos resoluciones (el servidor las tomaría
    // por un montaje). Sin imagen todavía, la captura misma avisa que la cámara no está lista.
    if (takeSize.current && size && size !== takeSize.current) throw new CameraTurnedError();
    const blob = await camera.captureFrame(side ? { maxSide: side } : undefined);
    lastRef.current = blob;
    return blob;
  }, [camera, side, videoSize]);

  // ¿El cuadro actual sirve? La validez (posición, pose, luz, quietud y NITIDEZ) ya la decide el detector y la entrega
  // `valid.ready()` (`isSteadyGuidance`); sin plan (una verificación), cada cuadro sirve.
  const usable = useCallback(() => !valid || valid.ready(), [valid]);

  const take = useCallback(async (): Promise<Blob[]> => {
    takeSize.current = videoSize();
    const mine = ++generation.current;
    const frames: Blob[] = [];
    setCapture({ current: 0, total: frontalFrames });
    while (frames.length < frontalFrames && generation.current === mine) {
      if (usable()) {
        frames.push(await shot());
        setPhotos(frames.length);
        setCapture({ current: frames.length, total: frontalFrames });
      }
      if (frames.length < frontalFrames) await Promise.all([sleep(gap), nextVideoFrame(camera.videoRef.current, config.faceFrameGapMs)]);
    }
    if (generation.current === mine) setCapture(null);
    return frames;
  }, [camera, frontalFrames, gap, shot, usable, videoSize]);

  const clear = useCallback(() => {
    generation.current += 1;
    takeSize.current = null;
    lastRef.current = null;
    setCapture(null);
    setPhotos(0);
  }, []);

  const last = useCallback(() => lastRef.current, []);

  return { capture, photos, take, shot, last, clear };
}

/** El rostro está listo (completo, centrado, de frente y quieto): una foto del registro cuenta solo así. */
export const isSteadyGuidance = (guidance: FaceGuidance) => guidance === 'hold_still' || guidance === 'ready';

/**
 * El plan de las fotos del registro con su revisión en vivo (decisión del dueño, 2026-10-06): lo que ve el detector se lee
 * de una referencia al tomar cada cuadro, nunca al dibujar; sin `frontalPhoto` (una verificación) no hay plan. La nitidez
 * ya la decide el detector (`useFaceAutoCapture` con `quality`), así que un cuadro listo (`isSteadyGuidance`) ya es nítido.
 */
export function useEnrollmentPhotoPlan(frontalPhoto: FrontalPhoto | undefined, guidance: RefObject<FaceGuidance>): FrontalPhoto | undefined {
  return useMemo<FrontalPhoto | undefined>(
    () => frontalPhoto && { ...frontalPhoto, valid: { ready: () => isSteadyGuidance(guidance.current) } },
    [frontalPhoto, guidance],
  );
}
