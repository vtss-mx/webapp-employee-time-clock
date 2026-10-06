/** Textos de resultados e historial de verificaciones de identidad (es-MX). */
export default {
  /** Resultado de un intento (bitácora y punto de control). */
  outcome: {
    success: 'Exitosa',
    failed: 'Fallida',
  },
  /** Resultado de una identificación en un popup (VerificationResultCard). */
  result: {
    /** Punto de control: un operador identifica a otras personas. */
    kiosk: {
      title: 'Empleado identificado',
      greeting: 'Identidad confirmada: {name}.',
      next: 'Siguiente persona',
      home: 'Volver al inicio',
    },
    /** El propio empleado se identifica. `name`: su primer nombre. */
    self: {
      title: 'Identidad confirmada',
      greeting: 'Hola, {name}.',
      finish: 'Finalizar',
      changeMethod: 'Cambiar método',
    },
    number: 'Número',
    confidence: 'Confianza',
    dateTime: 'Fecha y hora',
    retry: 'Intentar de nuevo',
  },
  /** Bitácora de verificaciones de un empleado (VerificationHistory). */
  history: {
    errorTitle: 'No se pudo cargar la bitácora',
    emptyTitle: 'Sin verificaciones',
    emptyDescription: 'Aquí verás cada intento de verificar su identidad.',
    nounOne: 'intento',
    nounOther: 'intentos',
    confidence: 'Confianza {value}',
  },
} as const;
