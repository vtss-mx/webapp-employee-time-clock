import { config } from '../../utils/config';
import { apiRequest } from '../apiClient';

export interface FaceChallengeCapture {
  id: string;
  image: Blob;
}

/** Multipart con las capturas frontales y, si existe, el reto de prueba de vida. */
export function buildFaceForm(frontal: Blob[], challenge?: FaceChallengeCapture, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  Object.entries(extra).forEach(([key, value]) => form.append(key, value));
  frontal.forEach((image, i) => form.append('images', image, `frontal-${i + 1}.jpg`));
  if (challenge) {
    form.append('challenge_id', challenge.id);
    form.append('challenge_image', challenge.image, 'challenge.jpg');
  }
  return form;
}

/** Envío de capturas faciales (registro o verificación) con el tiempo límite de subida. */
export function postFaceCaptures<T>(
  path: string,
  frontal: Blob[],
  challenge: FaceChallengeCapture | undefined,
  validate: (data: unknown) => data is T,
  extra: Record<string, string> = {},
): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: buildFaceForm(frontal, challenge, extra),
    timeoutMs: config.apiUploadTimeoutMs,
    validate,
  });
}
