import { useEffect, useRef, useState, type RefObject } from 'react';
import { config } from '../utils/config';
import { docGuideRegion, evaluateDocFrame, frameShift, measureDocFrame, type DocGuidance } from '../utils/docQuality';

interface DocumentScanOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Solo analiza mientras la cámara está activa y no se está tomando ya una foto. */
  enabled: boolean;
  /** Se invoca UNA vez cuando el documento estuvo bien encuadrado y quieto los cuadros que pide la configuración. */
  onAutoCapture: () => void;
}

export interface DocumentScanState {
  /** Indicación grande bajo la guía (sigue al estado del cuadro). */
  guidance: DocGuidance;
  /** El cuadro sirve (buen encuadre): habilita el obturador manual y, al quedarse quieto, dispara la captura. */
  acceptable: boolean;
  /** Pasó el tiempo sin un cuadro válido: el obturador manual se habilita igual (nunca un callejón sin salida). */
  stalled: boolean;
}

/**
 * Escáner de documento en vivo (análogo a `useQrScanner` y al bucle de `useFaceAutoCapture`): analiza la región de la
 * guía en cada cuadro con `requestAnimationFrame`, acotado a `config.docScanDetectIntervalMs`, SIN volver a dibujar en
 * React por cuadro (solo cambia el estado cuando cambia la indicación o si el cuadro pasa a servir). Toma la foto sola
 * cuando el documento llena la guía, está enfocado, con luz, sin reflejos, derecho y quieto durante
 * `config.docScanStableFrames` cuadros seguidos. Nunca se queda colgado: sin un cuadro válido, tras
 * `config.docScanManualFallbackMs` habilita el obturador manual.
 */
export function useDocumentScan({ videoRef, enabled, onAutoCapture }: DocumentScanOptions): DocumentScanState {
  const [guidance, setGuidance] = useState<DocGuidance>('searching');
  const [acceptable, setAcceptable] = useState(false);
  const [stalled, setStalled] = useState(false);
  const captureRef = useRef(onAutoCapture);
  captureRef.current = onAutoCapture;

  useEffect(() => {
    if (!enabled) return;
    setGuidance('searching');
    setAcceptable(false);
    setStalled(false);
    let raf = 0;
    let last = 0;
    let stable = 0;
    let fired = false;
    let previous: Float32Array | null = null;
    // Sin un cuadro válido tras la espera, el obturador manual queda disponible igual (una sola vez).
    const stall = window.setTimeout(() => setStalled(true), config.docScanManualFallbackMs);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (fired || now - last < config.docScanDetectIntervalMs) return;
      last = now;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      const region = docGuideRegion(video.videoWidth, video.videoHeight, config.docScanGuideAspect);
      const measured = measureDocFrame(video, region, config.docScanGlareLevel);
      if (!measured) return; // lienzo bloqueado: no se mide (el obturador manual sigue)
      const check = evaluateDocFrame(measured.quality);
      const moving = frameShift(previous, measured.gray) > config.docScanMaxShift;
      previous = measured.gray;

      let next: DocGuidance;
      const ok = check === 'ok';
      if (ok && !moving) {
        stable++;
        if (stable >= config.docScanStableFrames) {
          fired = true;
          next = 'capturing';
          captureRef.current();
        } else {
          next = 'holdStill';
        }
      } else {
        stable = 0;
        // Un cuadro que ya sirve pero se mueve, y uno borroso, piden lo mismo: «Mantén firme».
        next = ok || check === 'blurry' ? 'holdStill' : check;
      }
      setGuidance((prev) => (prev === next ? prev : next));
      setAcceptable((prev) => (prev === ok ? prev : ok));
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(stall);
    };
  }, [enabled, videoRef]);

  return { guidance, acceptable, stalled };
}
