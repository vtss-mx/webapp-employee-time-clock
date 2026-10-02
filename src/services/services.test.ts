import { describe, expect, it } from 'vitest';
import { apiOk, mockFetch } from '../test/http';
import { detectedAccessories, isRetryableFaceError } from '../utils/faceErrors';
import { ApiError } from './apiClient';
import { authService } from './authService';
import { employeeService } from './employeeService';
import { enrollmentService } from './enrollmentService';
import { meService } from './meService';
import { settingsService } from './settingsService';
import { faceService, verificationService } from './verificationService';

const employee = { id: 1, employee_number: 'EMP-1', first_name: 'Ana', last_name: 'Ruiz' };
const qr = { image_base64: 'data:', employee_number: 'EMP-1', file_name: 'qr.png' };
const detail = { id: 3, status: 'PENDING', employee_id: 1 };
const result = { verified: true, method: 'FACE', message: 'ok' };
const policy = { block_glasses: true, block_headwear: true, block_mask: false, liveness_challenge: true, anti_spoofing: true, qr_enabled: true };

/** Cada servicio llama al endpoint y método correctos y valida la forma de la respuesta. */
describe('servicios', () => {
  it.each([
    ['employees.list', () => employeeService.list({ search: 'ana' }), { items: [employee], total: 1 }, 'GET', '/api/employees?search=ana'],
    ['employees.get', () => employeeService.get(1), employee, 'GET', '/api/employees/1'],
    ['employees.create', () => employeeService.create({ first_name: ' Ana ', last_name: 'R', birth_date: '1990-01-01', employee_number: 'E', rfc: 'RUAA900101AB1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '6621234567', email: 'a@e.com', password: 'x', headwear_exempt: false }), employee, 'POST', '/api/employees'],
    ['employees.update', () => employeeService.update(1, { first_name: 'B' }), employee, 'PUT', '/api/employees/1'],
    ['employees.setStatus', () => employeeService.setStatus(1, false), employee, 'PATCH', '/api/employees/1/status'],
    ['employees.remove', () => employeeService.remove(1), null, 'DELETE', '/api/employees/1'],
    ['employees.resetFace', () => employeeService.resetFace(1), employee, 'POST', '/api/employees/1/face/reset'],
    ['employees.getQr', () => employeeService.getQr(1), qr, 'GET', '/api/employees/1/qr'],
    ['employees.regenerateQr', () => employeeService.regenerateQr(1), qr, 'POST', '/api/employees/1/qr/regenerate'],
    ['employees.history', () => employeeService.history(1, 5), [{ id: 1, method: 'QR', success: true }], 'GET', '/api/employees/1/verifications?limit=5'],
    ['enrollments.submit', () => enrollmentService.submit([new Blob(['a'])]), { enrollment_id: 1, face_status: 'PENDING_REVIEW' }, 'POST', '/api/enrollment/face'],
    ['enrollments.list', () => enrollmentService.list('PENDING'), { items: [detail], total: 1 }, 'GET', '/api/enrollments?status=PENDING&page=1&size=20'],
    ['enrollments.get', () => enrollmentService.get(3), detail, 'GET', '/api/enrollments/3'],
    ['enrollments.approve', () => enrollmentService.approve(3), detail, 'POST', '/api/enrollments/3/approve'],
    ['enrollments.reject', () => enrollmentService.reject(3, 'foto borrosa'), detail, 'POST', '/api/enrollments/3/reject'],
    ['verification.face', () => verificationService.verifyFace([new Blob(['a'])], { id: 'c', image: new Blob(['t']) }), result, 'POST', '/api/verification/face'],
    ['verification.qr', () => verificationService.verifyQr('TCQR1:x'), result, 'POST', '/api/verification/qr'],
    ['face.challenge', () => faceService.getChallenge(), { liveness_required: true }, 'POST', '/api/face/challenge'],
    ['face.check', () => faceService.check([new Blob(['a']), new Blob(['b'])], true), { detection_score: 0.9 }, 'POST', '/api/face/check'],
    ['me.qr', () => meService.getMyQr(), qr, 'GET', '/api/users/me/qr'],
    ['settings.get', () => settingsService.getVerificationPolicy(), policy, 'GET', '/api/settings/verification'],
    ['settings.update', () => settingsService.updateVerificationPolicy({ block_mask: false }), policy, 'PUT', '/api/settings/verification'],
    ['enrollments.submitReview', () => enrollmentService.submit([new Blob(['a'])], undefined, true), { enrollment_id: 1, face_status: 'PENDING_REVIEW' }, 'POST', '/api/enrollment/face'],
    ['auth.sessions', () => authService.sessions(), [{ id: 's', created_at: 'x', current: true }], 'GET', '/api/auth/sessions'],
    ['auth.revokeSession', () => authService.revokeSession('s/1'), null, 'DELETE', '/api/auth/sessions/s%2F1'],
    ['auth.logoutAll', () => authService.logoutAll(), { revoked: 1 }, 'POST', '/api/auth/logout-all'],
    ['auth.remembered', () => authService.remembered(), { email: 'ana@empresa.com' }, 'GET', '/api/auth/remembered'],
    ['auth.rememberedNone', () => authService.remembered(), null, 'GET', '/api/auth/remembered'],
    ['auth.forgetRemembered', () => authService.forgetRemembered(), null, 'DELETE', '/api/auth/remembered'],
    ['me.updatePreferences', () => meService.updatePreferences({ sidebar_collapsed: true }), { sidebar_collapsed: true }, 'PATCH', '/api/users/me/preferences'],
  ])('%s', async (_name, call, data, method, url) => {
    const { calls } = mockFetch(apiOk(data));
    await call();
    expect(calls[0].init.method ?? 'GET').toBe(method);
    expect(calls[0].url).toBe(url);
  });

  it('rechaza respuestas con forma inesperada', async () => {
    mockFetch(apiOk({ id: 'sin-campos' }));
    await expect(employeeService.get(1)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('errores faciales', () => {
  it('identifica errores corregibles y accesorios', () => {
    const accessories = new ApiError({
      statusCode: 422,
      code: 'ACCESSORIES_DETECTED',
      message: 'Quita lentes',
      errors: [{ code: 'ACCESSORIES_DETECTED', message: 'm', field: null, details: { accessories: ['GLASSES'] } }],
    });
    expect(isRetryableFaceError(accessories)).toBe(true);
    expect(detectedAccessories(accessories)).toEqual(['GLASSES']);
    expect(isRetryableFaceError(new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'x' }))).toBe(true);
    expect(isRetryableFaceError(new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'x' }))).toBe(false);
    expect(isRetryableFaceError(new Error('x'))).toBe(false);
    expect(detectedAccessories(new Error('x'))).toEqual([]);
    expect(detectedAccessories(new ApiError({ statusCode: 422, code: 'ACCESSORIES_DETECTED', message: 'x' }))).toEqual([]);
  });
});
