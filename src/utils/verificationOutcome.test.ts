import { describe, expect, it } from 'vitest';
import { LOCALES, setLocale, t } from '../i18n';
import { formatDuration } from './numbers';
import { ApiError } from '../services/apiClient';
import { verificationFailure } from './verificationOutcome';

describe('la captura nueva no sustituye arreglar una credencial', () => {
  it.each([401, 403, 422, 429, 503, 0])('un error HTTP %s conserva el mensaje y decide un reintento seguro', (statusCode) => {
    const failure = verificationFailure(new ApiError({ statusCode, code: 'SIGNATURE_KEY_MISMATCH', message: 'Mensaje del servidor' }));
    expect(failure.result).toBeNull();
    expect(failure.retryable).toBe(statusCode !== 401 && statusCode !== 403);
    expect(typeof failure.error === 'function' && failure.error()).toBe('Mensaje del servidor');
  });
  it.each(LOCALES)('429 conserva Retry-After y el aviso en %s sin repetir una escritura', async (locale) => {
    await setLocale(locale);
    const failure = verificationFailure(new ApiError({ statusCode: 429, code: 'RATE_LIMITED', message: 'Servidor' }, 2000));
    expect(failure.retryable).toBe(false);
    expect(typeof failure.error === 'function' && failure.error()).toBe(`Servidor ${t('auth.locked.wait', { value: formatDuration(2000) })}`);
  });
  it('una espera cero no impide empezar un reto nuevo', () => {
    expect(verificationFailure(new ApiError({ statusCode: 429, code: 'RATE_LIMITED', message: 'Servidor' }, 0)).retryable).toBe(true);
  });
  it('una falla de cámara sin respuesta permite una captura nueva', () => {
    expect(verificationFailure(new Error('camera')).retryable).toBe(true);
  });
});
