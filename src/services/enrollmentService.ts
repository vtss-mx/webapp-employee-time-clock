import type { EnrollmentStatus, EnrollmentSubmitResponse, FaceEnrollmentDetail, FaceEnrollmentList } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { postFaceCaptures, type FaceChallengeCapture } from './http/faceUpload';

const isDetail = hasKeys<FaceEnrollmentDetail>('id', 'status', 'employee_id');
const isSubmit = hasKeys<EnrollmentSubmitResponse>('enrollment_id', 'face_status');

export const enrollmentService = {
  /** EMPLOYEE: envía su registro facial (queda en validación). */
  /** `accessoryReview`: el empleado indica que no usa el accesorio detectado (lo confirma COMPANY). */
  submit(frontal: Blob[], challenge?: FaceChallengeCapture, accessoryReview = false): Promise<EnrollmentSubmitResponse> {
    const extra: Record<string, string> = accessoryReview ? { accessory_review: 'true' } : {};
    return postFaceCaptures('/enrollment/face', frontal, challenge, isSubmit, extra);
  },

  list(status: EnrollmentStatus, page = 1, size = 20, signal?: AbortSignal): Promise<FaceEnrollmentList> {
    return apiRequest<FaceEnrollmentList>('/enrollments', {
      query: { status, page, size },
      signal,
      validate: isPage(hasKeys('id', 'status')),
    });
  },

  get(id: number): Promise<FaceEnrollmentDetail> {
    return apiRequest<FaceEnrollmentDetail>(`/enrollments/${id}`, { validate: isDetail });
  },

  approve(id: number): Promise<FaceEnrollmentDetail> {
    return apiRequest<FaceEnrollmentDetail>(`/enrollments/${id}/approve`, { method: 'POST', validate: isDetail });
  },

  reject(id: number, reason: string): Promise<FaceEnrollmentDetail> {
    return apiRequest<FaceEnrollmentDetail>(`/enrollments/${id}/reject`, { method: 'POST', body: { reason }, validate: isDetail });
  },
};
