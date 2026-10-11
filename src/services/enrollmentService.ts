import type {
  EnrollmentPhotoResult,
  EnrollmentProgress,
  EnrollmentStatus,
  EnrollmentSubmitResponse,
  FaceEnrollmentDetail,
  FaceEnrollmentList,
  PageQuery,
  VoiceAnswerResult,
  VoiceChallenge,
  VoiceClip,
} from '../types';
import { config } from '../utils/config';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { postFaceCaptures, type FaceCaptures } from './http/faceUpload';

const isDetail = hasKeys<FaceEnrollmentDetail>('id', 'status', 'employee_id');
const isSubmit = hasKeys<EnrollmentSubmitResponse>('enrollment_id', 'face_status');
const isAnswer = hasKeys<VoiceAnswerResult>('token', 'position', 'done');
const isClip = hasKeys<VoiceClip>('content_type', 'data');
const isProgress = hasKeys<EnrollmentProgress>('face_status', 'complete', 'current', 'steps');
const isPhoto = hasKeys<EnrollmentPhotoResult>('checked_at', 'expires_at');
const isVoiceChallenge = hasKeys<VoiceChallenge>('token', 'questions', 'total');

/*
 * El registro de identidad del propio empleado (decisión del dueño, 2026-10-08): un flujo DINÁMICO cuyos pasos y orden
 * configura el ADMIN por empresa. `progress` entrega los pasos en su orden (el índice los dibuja tal cual) y cada
 * endpoint atiende el paso que le toca: la foto inicial (`photo`), las capturas con prueba de vida (`submit`) y el
 * video con preguntas (`startVoice` + `answerVoice`); los documentos de identidad son pasos y usan `/me/documents`
 * (`employeeDocumentService`). El ORDEN lo exige el servidor (409 `ENROLLMENT_STEP_BLOCKED` con el paso que falta y
 * `ENROLLMENT_STEP_DISABLED` si la empresa no pide ese paso).
 */
export const enrollmentService = {
  /** EMPLOYEE: los pasos de su registro, en el orden que pide su empresa, con el estado de cada uno (el índice). */
  progress(signal?: AbortSignal): Promise<EnrollmentProgress> {
    return apiRequest<EnrollmentProgress>('/enrollment/progress', { signal, validate: isProgress });
  },

  /** EMPLOYEE, paso `INITIAL_PHOTO`: la foto inicial (se valida y queda cifrada como borrador del registro). */
  photo(captures: FaceCaptures): Promise<EnrollmentPhotoResult> {
    return postFaceCaptures('/enrollment/photo', { frontal: captures.frontal }, isPhoto);
  },

  /** EMPLOYEE, paso `FACE_CAPTURES`: las capturas con la prueba de vida (queda en validación, o sigue el video). */
  submit(captures: FaceCaptures): Promise<EnrollmentSubmitResponse> {
    return postFaceCaptures('/enrollment/face', captures, isSubmit);
  },

  /** EMPLOYEE, paso `VOICE_VIDEO`: una sesión de preguntas (las aceptadas se conservan: trae solo las que faltan). */
  startVoice(): Promise<VoiceChallenge> {
    return apiRequest<VoiceChallenge>('/enrollment/voice/start', { method: 'POST', validate: isVoiceChallenge });
  },

  /**
   * EMPLOYEE: una respuesta en video de la verificación por voz (decisión del dueño, 2026-10-06): el token sellado de
   * la sesión, qué pregunta y el clip (WebM o MP4 con audio). Un 422 trae el token renovado en `details.token`.
   */
  answerVoice(token: string, position: number, clip: Blob): Promise<VoiceAnswerResult> {
    const form = new FormData();
    form.append('token', token);
    form.append('position', String(position));
    form.append('clip', clip, clip.type.includes('mp4') ? 'answer.mp4' : 'answer.webm');
    return apiRequest<VoiceAnswerResult>('/enrollment/voice/answer', { method: 'POST', body: form, timeoutMs: config.apiUploadTimeoutMs, validate: isAnswer });
  },

  /** COMPANY: el video de una respuesta, en base64 dentro del contrato (la app lo vuelve una URL `blob:` local). */
  voiceClip(enrollmentId: number, answerId: number, signal?: AbortSignal): Promise<VoiceClip> {
    return apiRequest<VoiceClip>(`/enrollments/${enrollmentId}/voice/${answerId}/clip`, { signal, validate: isClip });
  },

  list(status: EnrollmentStatus, query: PageQuery, signal?: AbortSignal): Promise<FaceEnrollmentList> {
    return apiRequest<FaceEnrollmentList>('/enrollments', {
      query: { status, ...query },
      signal,
      validate: isPage(hasKeys('id', 'status')),
    });
  },

  get(id: number, signal?: AbortSignal): Promise<FaceEnrollmentDetail> {
    return apiRequest<FaceEnrollmentDetail>(`/enrollments/${id}`, { signal, validate: isDetail });
  },

  approve(id: number): Promise<FaceEnrollmentDetail> {
    return apiRequest<FaceEnrollmentDetail>(`/enrollments/${id}/approve`, { method: 'POST', validate: isDetail });
  },

  reject(id: number, reason: string): Promise<FaceEnrollmentDetail> {
    return apiRequest<FaceEnrollmentDetail>(`/enrollments/${id}/reject`, { method: 'POST', body: { reason }, validate: isDetail });
  },
};
