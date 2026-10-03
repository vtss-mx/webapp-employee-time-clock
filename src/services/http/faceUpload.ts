import { config } from '../../utils/config';
import { apiRequest } from '../apiClient';

/** Reto de prueba de vida respondido: su id y una captura con la cabeza girada por cada giro, en orden. */
export interface FaceChallengeCapture {
  id: string;
  images: Blob[];
}

/** Lo que la cámara entrega en un intento facial (registro, verificación o identificación). */
export interface FaceCaptures {
  frontal: Blob[];
  challenge?: FaceChallengeCapture;
  /** Nombre de la cámara usada (el backend rechaza las cámaras virtuales). */
  camera?: string;
}

/** Multipart con las capturas frontales, las del reto (una por giro) y el nombre de la cámara. */
export function buildFaceForm({ frontal, challenge, camera }: FaceCaptures, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  Object.entries(extra).forEach(([key, value]) => form.append(key, value));
  frontal.forEach((image, i) => form.append('images', image, `frontal-${i + 1}.jpg`));
  if (challenge) {
    form.append('challenge_id', challenge.id);
    challenge.images.forEach((image, i) => form.append('challenge_image', image, `challenge-${i + 1}.jpg`));
  }
  if (camera) form.append('camera_label', camera.slice(0, 200));
  return form;
}

/** Envío de capturas faciales (registro o verificación) con el tiempo límite de subida. */
export function postFaceCaptures<T>(path: string, captures: FaceCaptures, validate: (data: unknown) => data is T, extra: Record<string, string> = {}): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: buildFaceForm(captures, extra),
    timeoutMs: config.apiUploadTimeoutMs,
    validate,
  });
}
