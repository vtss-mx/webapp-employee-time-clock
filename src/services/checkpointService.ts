import type { CheckpointEmployee, CheckpointEventList, CheckpointProfile, PageQuery, VerificationResult } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { locationFormFields, locationJson, type LocationTake } from '../utils/locationPayload';
import { apiRequest } from './apiClient';
import { sha256Hex } from '../utils/digest';
import { postFaceCaptures, type FaceCaptures } from './http/faceUpload';
import { sendSigned, signingNonce } from './http/requestSigning';

const isProfile = hasKeys<CheckpointProfile>('id', 'name', 'mode', 'company');
const isHolder = hasKeys<CheckpointEmployee>('employee_id', 'name', 'employee_number');
const isEvents = isPage<CheckpointEventList>(hasKeys('id', 'created_at', 'success', 'method'));
const isResult = hasKeys<VerificationResult>('verified', 'method', 'message');

/** Huella del texto de un QR (UTF-8): lo que firma la identificación por QR. */
const textDigest = (text: string) => () => sha256Hex(new Blob([text]));

/** El reto que trae cada respuesta es el siguiente para firmar (antifraude 2b). */
const remembered = <T extends { device_nonce?: string | null }>(data: T): T => {
  signingNonce.remember(data.device_nonce);
  return data;
};

/**
 * Punto de control (rol VALIDATOR): identifica a los empleados de su empresa. Cada identificación va firmada por la
 * llave del dispositivo (`sendSigned`) y, si el validador requiere ubicación, lleva la última lectura y las recientes
 * (`location`: la mantiene "caliente" la pantalla, sin esperar en cada identificación).
 */
export const checkpointService = {
  /** El perfil también trae el reto para firmar (`device_nonce`; null si la empresa no pide firma). */
  async profile(signal?: AbortSignal): Promise<CheckpointProfile> {
    const profile = await apiRequest<CheckpointProfile>('/checkpoint/me', { signal, validate: isProfile });
    signingNonce.remember(profile.device_nonce ?? null);
    return profile;
  },

  /** Identificaciones de este validador, paginadas (la más reciente primero). */
  recent(query: PageQuery, signal?: AbortSignal): Promise<CheckpointEventList> {
    return apiRequest<CheckpointEventList>('/checkpoint/recent', { query: { ...query }, signal, validate: isEvents });
  },

  identifyQr(qrContent: string, location?: LocationTake | null): Promise<VerificationResult> {
    return sendSigned('qr', textDigest(qrContent), () => checkpointService.profile(), (signature) =>
      apiRequest<VerificationResult>('/checkpoint/identify/qr', {
        method: 'POST',
        body: { qr_content: qrContent, ...signature, ...(location ? locationJson(location) : {}) },
        validate: isResult,
      }).then(remembered),
    );
  },

  /** QR y rostro: de quién es el QR antes de pedir su rostro (no registra). */
  inspectQr(qrContent: string, location?: LocationTake | null): Promise<CheckpointEmployee> {
    return sendSigned('inspect', textDigest(qrContent), () => checkpointService.profile(), (signature) =>
      apiRequest<CheckpointEmployee>('/checkpoint/qr/inspect', {
        method: 'POST',
        body: { qr_content: qrContent, ...signature, ...(location ? locationJson(location) : {}) },
        validate: isHolder,
      }).then(remembered),
    );
  },

  /** Rostro: busca a la persona entre los empleados (1:N) o confirma al dueño del QR. Firma la primera captura frontal. */
  identifyFace(captures: FaceCaptures, qrContent?: string, location?: LocationTake | null): Promise<VerificationResult> {
    return sendSigned('face', () => sha256Hex(captures.frontal[0]), () => checkpointService.profile(), (signature) =>
      postFaceCaptures('/checkpoint/identify/face', captures, isResult, {
        ...(qrContent ? { qr_content: qrContent } : {}),
        ...signature,
        ...(location ? locationFormFields(location) : {}),
      }).then(remembered),
    );
  },
};
