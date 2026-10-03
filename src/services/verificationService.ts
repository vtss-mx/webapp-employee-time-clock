import type { FaceChallenge, FaceCheckResult, VerificationResult } from '../types';
import { hasKeys } from '../utils/guards';
import { apiRequest } from './apiClient';
import { postFaceCaptures, type FaceCaptures } from './http/faceUpload';

export const isVerificationResult = hasKeys<VerificationResult>('verified', 'method', 'message');
const isResult = isVerificationResult;
const isChallenge = hasKeys<FaceChallenge>('liveness_required');
const isCheck = hasKeys<FaceCheckResult>('detection_score');

export const verificationService = {
  verifyFace(captures: FaceCaptures): Promise<VerificationResult> {
    return postFaceCaptures('/verification/face', captures, isResult);
  },

  verifyQr(qrContent: string): Promise<VerificationResult> {
    return apiRequest<VerificationResult>('/verification/qr', {
      method: 'POST',
      body: { qr_content: qrContent },
      validate: isResult,
    });
  },
};

export const faceService = {
  /** Reto aleatorio de prueba de vida (girar la cabeza), de uso único. */
  getChallenge(): Promise<FaceChallenge> {
    return apiRequest<FaceChallenge>('/face/challenge', { method: 'POST', validate: isChallenge });
  },

  /**
   * Validación previa de una captura (calidad, pose, lentes, gorra, cubrebocas).
   * Lanza ApiError 422 con `code` y `errors[0].details.accessories` si no son aptas.
   */
  check(images: Blob[], allowHeadwear = false): Promise<FaceCheckResult> {
    // Varias capturas consecutivas: los accesorios se deciden por mayoría en el backend.
    const form = new FormData();
    images.slice(0, 3).forEach((image, i) => form.append('images', image, `check-${i + 1}.jpg`));
    form.append('allow_headwear', String(allowHeadwear));
    return apiRequest<FaceCheckResult>('/face/check', { method: 'POST', body: form, validate: isCheck });
  },
};
