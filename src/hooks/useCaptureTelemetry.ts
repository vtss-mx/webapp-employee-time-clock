import { useCallback, useEffect, useRef } from 'react';
import type { CameraController } from './useCamera';
import { captureTelemetry, watchFrames, type FrameWatcher } from '../utils/captureTelemetry';
import { config } from '../utils/config';

/**
 * Telemetría de la toma facial (antifraude 1b): mientras la cámara da imagen mide el ritmo de sus cuadros y, al
 * enviar, arma el JSON que viaja con las capturas (`utils/captureTelemetry.ts`). Nunca bloquea ni avisa nada: lo
 * decide el servidor, y como mucho pide un paso más.
 */
export function useCaptureTelemetry(camera: CameraController, blocked: readonly string[]): () => string {
  const watcher = useRef<FrameWatcher | null>(null);
  const { videoRef, status } = camera;

  useEffect(() => {
    const video = videoRef.current;
    if (status !== 'active' || !video) return;
    const current = watchFrames(video, config.faceFrameRhythmSamples);
    watcher.current = current;
    return () => current.stop();
  }, [status, videoRef]);

  const { videoTrack, devices } = camera;
  return useCallback(
    () => JSON.stringify(captureTelemetry({ track: videoTrack(), devices, blocked, intervals: watcher.current?.intervals() ?? [] })),
    [blocked, devices, videoTrack],
  );
}
