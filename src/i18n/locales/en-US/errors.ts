import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/errors';

/** Textos de los errores que arma el cliente en inglés (en-US). */
export default {
  status: {
    network: "Couldn't reach the server. Check your connection.",
    ok: 'Done',
    badRequest: 'Invalid request',
    unauthorized: 'Your session is no longer valid. Sign in again.',
    forbidden: "You don't have permission for this action",
    notFound: 'Not found',
    methodNotAllowed: 'Action not allowed',
    timeout: "The server didn't respond in time. Try again.",
    conflict: 'Conflict with existing data',
    payloadTooLarge: 'The file is too large',
    unsupportedMedia: 'Unsupported format',
    unprocessable: 'Invalid data',
    rateLimited: 'Too many attempts. Wait a few seconds.',
    server: 'An unexpected error occurred. Try again.',
    unavailable: 'Service unavailable. Try again in a few seconds.',
  },
  invalidResponse: 'Unexpected response from the server. Try again.',
  unexpected: 'An unexpected error occurred',
  unexpectedRetry: 'An unexpected error occurred. Try again.',
  titles: {
    network: "Can't reach the server",
    unauthorized: "Couldn't verify your access",
    forbidden: 'Action not allowed',
    notFound: 'Not found',
    timeout: 'No response from the server',
    conflict: 'This information already exists',
    payloadTooLarge: 'The file is too large',
    unprocessable: 'Check the details',
    rateLimited: 'Too many attempts',
    server: 'Server error',
    failed: "Couldn't complete the action",
    generic: 'Something went wrong',
  },
} satisfies Translation<typeof es>;
