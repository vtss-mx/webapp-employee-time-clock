import type { Detection } from '@mediapipe/tasks-vision';

/*
 * Rostros y video simulados para las pruebas de la detección facial (MediaPipe real: prueba en
 * navegador). Los puntos siguen el orden de BlazeFace: ojo derecho, ojo izquierdo, nariz, boca.
 */

export const VIDEO_SIZE = { width: 640, height: 480 };

/** <video> con imagen (o sin ella: `readyState` < 2, ancho 0). */
export function videoElement({ readyState = 4, width = VIDEO_SIZE.width, height = VIDEO_SIZE.height } = {}): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: readyState, configurable: true });
  Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: height, configurable: true });
  return video;
}

export interface FaceSpec {
  score?: number;
  /** Centro de la caja en proporción del video y su tamaño en píxeles. */
  cx?: number;
  cy?: number;
  size?: number;
  /** Nariz respecto al punto medio de los ojos (proporción del ancho): positivo = gira a su izquierda. */
  nose?: number;
  /** Altura de la nariz entre ojos (0) y boca (1): 0.5 de frente; menor = mira arriba. */
  pitch?: number;
  eyeGap?: number;
  box?: boolean;
  /** Sin el punto de la boca (solo ojos y nariz). */
  noMouth?: boolean;
}

/** Rostro como lo entrega BlazeFace: caja en píxeles y puntos normalizados (ojos a 0.45, boca a 0.65). */
export function face({ score = 0.95, cx = 0.5, cy = 0.5, size = 200, nose = 0, pitch = 0.5, eyeGap = 0.1, box = true, noMouth = false }: FaceSpec = {}): Detection {
  const x = cx * VIDEO_SIZE.width - size / 2;
  const y = cy * VIDEO_SIZE.height - size / 2;
  // Ojos en desorden (derecho primero): la métrica los ordena por posición.
  const keypoints = [
    { x: cx + eyeGap / 2, y: 0.45 },
    { x: cx - eyeGap / 2, y: 0.45 },
    { x: cx + nose, y: 0.45 + pitch * 0.2 },
    { x: cx, y: 0.65 },
  ];
  return {
    categories: [{ score, index: 0, categoryName: 'face', displayName: '' }],
    boundingBox: box ? { originX: x, originY: y, width: size, height: size, angle: 0 } : undefined,
    keypoints: noMouth ? keypoints.slice(0, 3) : keypoints,
  };
}
