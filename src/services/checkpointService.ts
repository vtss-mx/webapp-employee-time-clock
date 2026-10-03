import type { CheckpointEmployee, CheckpointEventList, CheckpointProfile, PageQuery, VerificationResult } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { postFaceCaptures, type FaceCaptures } from './http/faceUpload';

const isProfile = hasKeys<CheckpointProfile>('id', 'name', 'mode', 'company');
const isHolder = hasKeys<CheckpointEmployee>('employee_id', 'name', 'employee_number');
const isEvents = isPage<CheckpointEventList>(hasKeys('id', 'created_at', 'success', 'method'));
const isResult = hasKeys<VerificationResult>('verified', 'method', 'message');

/** Punto de control (rol VALIDATOR): identifica a los empleados de su empresa. */
export const checkpointService = {
  profile(signal?: AbortSignal): Promise<CheckpointProfile> {
    return apiRequest<CheckpointProfile>('/checkpoint/me', { signal, validate: isProfile });
  },

  /** Identificaciones de este validador, paginadas (la más reciente primero). */
  recent(query: PageQuery, signal?: AbortSignal): Promise<CheckpointEventList> {
    return apiRequest<CheckpointEventList>('/checkpoint/recent', { query: { ...query }, signal, validate: isEvents });
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
  identifyFace(captures: FaceCaptures, qrContent?: string): Promise<VerificationResult> {
    return postFaceCaptures('/checkpoint/identify/face', captures, isResult, qrContent ? { qr_content: qrContent } : {});
  },
};
