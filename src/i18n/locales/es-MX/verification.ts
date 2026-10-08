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
  /** Mapa de solo lectura de dónde se hizo una verificación (VerificationMap). */
  map: {
    label: 'Mapa de verificaciones',
    pin: 'Lugar de la verificación',
    loading: 'Cargando el mapa…',
    failed: 'El mapa no está disponible.',
  },
  /** Pantalla «Verificaciones» de la empresa (lista con el mapa). */
  company: {
    title: 'Verificaciones',
    subtitle: 'Dónde y cuándo se verificó la identidad de tu gente.',
    loadError: 'No se pudieron cargar las verificaciones',
    mapHint: 'Elige una verificación con ubicación para verla en el mapa.',
    notIdentified: 'No identificado',
    noun: { one: 'verificación', other: 'verificaciones' },
    filters: { all: 'Todas', success: 'Exitosas', failed: 'Fallidas', from: 'Desde', to: 'Hasta' },
    columns: { when: 'Fecha y hora', result: 'Resultado', method: 'Método', place: 'Lugar' },
    place: { show: 'Ver en el mapa', none: 'Sin ubicación', accuracy: 'Precisión {distance}' },
    empty: { title: 'Sin verificaciones', description: 'Aquí verás dónde se hizo cada verificación.' },
    noMatch: { title: 'Sin resultados', description: 'Prueba con otro filtro o rango de fechas.' },
  },
} as const;
