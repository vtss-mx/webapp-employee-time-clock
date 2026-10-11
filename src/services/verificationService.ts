import type { ChallengePurpose, FaceChallenge, FaceCheckResult, VerificationResult } from '../types';
import { hasKeys } from '../utils/guards';
import { locationFormFields, type LocationTake } from '../utils/locationPayload';
import { apiRequest } from './apiClient';
import { postFaceCaptures, type FaceCaptures } from './http/faceUpload';

const hasResult = hasKeys<VerificationResult>('verified', 'method', 'message');
/** Valida tipos del resultado; estados nuevos son datos, nunca una aprobación implícita. */
export const isVerificationResult = (value: unknown): value is VerificationResult =>
  hasResult(value) && typeof value.verified === 'boolean' && typeof value.method === 'string' && typeof value.message === 'string' &&
  (value.review == null || typeof value.review === 'boolean') &&
  (value.verification_status == null || typeof value.verification_status === 'string');
const isResult = isVerificationResult;
/** El reto trae sus movimientos y los colores del destello (vacío si la empresa no lo usa). */
const isChallenge = hasKeys<FaceChallenge>('liveness_required', 'actions', 'flash');
const isCheck = hasKeys<FaceCheckResult>('detection_score');

export const verificationService = {
  /**
   * Verificación facial del propio empleado. Si la empresa pide ubicación (`verification_location` OBSERVE/ENFORCE) y la
   * hay, viaja la lectura que decide y todas las de la toma (los mismos campos del registro de asistencia, para que el
   * servidor mida y registre dónde se hizo). Sin ubicación se envía igual: en OBSERVE queda "sin ubicación" y en ENFORCE
   * el servidor responde `LOCATION_REQUIRED` (lo decide el servidor, nunca la app).
   */
  verifyFace(captures: FaceCaptures, location?: LocationTake | null): Promise<VerificationResult> {
    return postFaceCaptures('/verification/face', captures, isResult, location ? locationFormFields(location) : {});
  },
};

export const faceService = {
  /**
   * Reto aleatorio de prueba de vida (movimientos de cabeza), de uso único. El del registro facial (`ENROLLMENT`) pide
   * siempre los cuatro movimientos (decisión del dueño, 2026-10-07); una verificación, los de la política.
   */
  getChallenge(purpose: ChallengePurpose = 'VERIFICATION'): Promise<FaceChallenge> {
    const query = purpose === 'ENROLLMENT' ? { purpose } : undefined;
    return apiRequest<FaceChallenge>('/face/challenge', { method: 'POST', query, validate: isChallenge });
  },

  /**
   * Validación previa de una captura (calidad, pose, cubrebocas o gorra si la empresa lo exige; los lentes se permiten).
   * Lanza ApiError 422 con `code` (y `errors[0].details.accessories` si fue un accesorio) si no es apta.
   */
  check(images: Blob[], allowHeadwear = false): Promise<FaceCheckResult> {
    // Varias capturas consecutivas: los accesorios se deciden por mayoría en el backend.
    const form = new FormData();
    images.slice(0, 3).forEach((image, i) => form.append('images', image, `check-${i + 1}.jpg`));
    form.append('allow_headwear', String(allowHeadwear));
    return apiRequest<FaceCheckResult>('/face/check', { method: 'POST', body: form, validate: isCheck });
  },
};
