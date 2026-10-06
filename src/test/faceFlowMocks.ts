import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';
import type { DetectionMode, FaceGuidance } from '../hooks/useFaceDetection';
import type { FaceBaseline } from '../utils/facePose';

/*
 * Dobles de la cámara y de MediaPipe para las pruebas del flujo facial (los reales tienen sus propias
 * pruebas). Este módulo no importa nada de la aplicación: lo cargan las fábricas de vi.mock.
 *   vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
 *   vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));
 */

/** La cámara simulada: siempre activa salvo que la prueba diga otra cosa. */
export const camera = {
  status: 'active',
  trackLabel: 'FaceTime HD Camera',
  isMirrored: true,
  capture: vi.fn<() => Promise<Blob>>(),
  /** Capturas entregadas, en orden. */
  frames: [] as Blob[],
};

export function cameraModule() {
  return {
    useCamera: () => ({
      videoRef: { current: null },
      facing: 'user',
      status: camera.status,
      error: null,
      problem: null,
      devices: [],
      activeDeviceId: null,
      activeLabel: 'Cámara frontal',
      trackLabel: camera.trackLabel,
      isMirrored: camera.isMirrored,
      start: () => Promise.resolve(),
      requestAccess: () => undefined,
      stop: () => undefined,
      switchCamera: () => undefined,
      selectCamera: () => undefined,
      captureFrame: camera.capture,
      videoTrack: () => null,
    }),
  };
}

export interface AutoCaptureOptions {
  enabled: boolean;
  mode?: DetectionMode;
  stableFrames?: number;
  onStable?: (sample?: FaceBaseline) => void | Promise<void>;
}

export interface Reading {
  guidance: FaceGuidance;
  progress: number;
  moveProgress: number;
}

const STILL: Reading = { guidance: 'hold_still', progress: 0, moveProgress: 0 };

/** Lo que "ve" el detector, como un store externo: la prueba lo cambia y el flujo se redibuja. */
export const detection = (() => {
  const listeners = new Set<() => void>();
  let reading: Reading = STILL;
  return {
    detector: null as object | null,
    /** La detección automática no cargó (la pantalla ofrece "Capturar"). */
    failed: false,
    options: null as AutoCaptureOptions | null,
    read: () => reading,
    see(next: Partial<Reading>) {
      reading = { ...reading, ...next };
      listeners.forEach((listener) => listener());
    },
    reset() {
      reading = STILL;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
})();

export function detectionModule(original: Record<string, unknown>) {
  return {
    ...original,
    useFaceDetector: () => ({ detector: detection.detector, failed: detection.failed, loading: !detection.detector && !detection.failed }),
    useFaceAutoCapture: (options: AutoCaptureOptions) => {
      detection.options = options;
      return useSyncExternalStore(detection.subscribe, detection.read);
    },
  };
}
