import type { CheckpointEmployee, CheckpointEvent, CheckpointProfile, VerificationResult } from '../types';
import { hasKeys, isArrayOf } from '../utils/guards';
import { apiRequest } from './apiClient';
import { postFaceCaptures, type FaceChallengeCapture } from './http/faceUpload';

const isProfile = hasKeys<CheckpointProfile>('id', 'name', 'mode', 'company');
const isHolder = hasKeys<CheckpointEmployee>('employee_id', 'name', 'employee_number');
const isEvents = isArrayOf<CheckpointEvent[]>(hasKeys('id', 'created_at', 'success', 'method'));
const isResult = hasKeys<VerificationResult>('verified', 'method', 'message');

/** Punto de control (rol VALIDATOR): identifica a los empleados de su empresa. */
export const checkpointService = {
  profile(signal?: AbortSignal): Promise<CheckpointProfile> {
    return apiRequest<CheckpointProfile>('/checkpoint/me', { signal, validate: isProfile });
  },

  recent(limit = 8, signal?: AbortSignal): Promise<CheckpointEvent[]> {
    return apiRequest<CheckpointEvent[]>('/checkpoint/recent', { query: { limit }, signal, validate: isEvents });
  },

  identifyQr(qrContent: string): Promise<VerificationResult> {
    return apiRequest<VerificationResult>('/checkpoint/identify/qr', {
      method: 'POST',
      body: { qr_content: qrContent },
      validate: isResult,
    });
  },

  /** QR y rostro: de quién es el QR antes de pedir su rostro (no registra). */
  inspectQr(qrContent: string): Promise<CheckpointEmployee> {
    return apiRequest<CheckpointEmployee>('/checkpoint/qr/inspect', {
      method: 'POST',
      body: { qr_content: qrContent },
      validate: isHolder,
    });
  },

  /** Rostro: busca a la persona entre los empleados (1:N) o confirma al dueño del QR. */
  identifyFace(frontal: Blob[], challenge?: FaceChallengeCapture, qrContent?: string): Promise<VerificationResult> {
    return postFaceCaptures('/checkpoint/identify/face', frontal, challenge, isResult, qrContent ? { qr_content: qrContent } : {});
  },
};
