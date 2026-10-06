import { useEffect, useState, type RefObject } from 'react';
import { FaceBurstRecorder } from '../utils/faceBurstRecorder';

/**
 * La ráfaga de recortes del rostro de una pantalla de captura (antifraude 2a): un solo recolector por pantalla que
 * recorta del video de la cámara y se descarta al salir (nada queda en memoria ni en el dispositivo).
 */
export function useFaceBurst(videoRef: RefObject<HTMLVideoElement | null>): FaceBurstRecorder {
  const [recorder] = useState(() => new FaceBurstRecorder(() => videoRef.current));
  useEffect(() => () => recorder.reset(), [recorder]);
  return recorder;
}
