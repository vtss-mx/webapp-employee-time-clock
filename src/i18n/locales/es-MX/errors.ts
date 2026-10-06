/** Textos de los errores que arma el cliente: sin respuesta del servidor y títulos de los popups (es-MX). */
export default {
  /** Mensaje por estado HTTP cuando la respuesta no trae uno (o no hubo respuesta). */
  status: {
    network: 'No se pudo conectar con el servidor. Revisa tu conexión.',
    ok: 'Listo',
    badRequest: 'Solicitud inválida',
    unauthorized: 'Tu sesión no es válida. Inicia sesión de nuevo.',
    forbidden: 'No tienes permiso para esta acción',
    notFound: 'No se encontró',
    methodNotAllowed: 'Acción no permitida',
    timeout: 'El servidor no respondió a tiempo. Intenta de nuevo.',
    conflict: 'Conflicto con datos existentes',
    payloadTooLarge: 'El archivo es demasiado grande',
    unsupportedMedia: 'Formato no compatible',
    unprocessable: 'Datos no válidos',
    rateLimited: 'Demasiados intentos. Espera unos segundos.',
    server: 'Ocurrió un error inesperado. Intenta de nuevo.',
    unavailable: 'Servicio no disponible. Intenta de nuevo en unos segundos.',
  },
  invalidResponse: 'Respuesta inesperada del servidor. Intenta de nuevo.',
  unexpected: 'Ocurrió un error inesperado',
  unexpectedRetry: 'Ocurrió un error inesperado. Intenta de nuevo.',
  /** Título del popup según el tipo de falla (si la pantalla no da uno propio). */
  titles: {
    network: 'Sin conexión con el servidor',
    unauthorized: 'No se pudo validar tu acceso',
    forbidden: 'Acción no permitida',
    notFound: 'No se encontró',
    timeout: 'Sin respuesta del servidor',
    conflict: 'La información ya existe',
    payloadTooLarge: 'El archivo es demasiado grande',
    unprocessable: 'Revisa los datos',
    rateLimited: 'Demasiados intentos',
    server: 'Error del servidor',
    failed: 'No se pudo completar',
    generic: 'Ocurrió un problema',
  },
} as const;
