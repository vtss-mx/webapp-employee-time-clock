import type { VerificationOutcome } from '../components/VerificationAttempt';
import { t } from '../i18n';
import { ApiError, errorMessage } from '../services/apiClient';
import { formatDuration } from './numbers';

/** Una denegación o una espera del servidor no se resuelve repitiendo inmediatamente la captura. */
export function verificationFailure(error: unknown): VerificationOutcome {
  const wait = error instanceof ApiError && error.status === 429 && error.retryAfterMs !== null && error.retryAfterMs > 0 ? error.retryAfterMs : null;
  return {
    result: null,
    error: () => wait === null ? errorMessage(error) : `${errorMessage(error)} ${t('auth.locked.wait', { value: formatDuration(wait) })}`,
    retryable: wait === null && !(error instanceof ApiError && (error.status === 401 || error.status === 403)),
  };
}
