/**
 * Ajustes de los candados de la política (`PolicyTuning`) y su confirmación (es-MX): cada ajuste con
 * su nombre, su descripción, el texto de sus opciones y el aviso al guardarse. Los niveles del
 * anti-spoofing y los modos del destello (nombre y descripción) vienen de los catálogos del backend.
 */
export default {
  title: 'Ajustes de los candados',
  hint: 'Más estricto protege más, pero puede pedir repetir la captura con más frecuencia.',
  /** Confirmación de un ajuste. */
  confirmTitle: '¿Cambiar «{label}» a {value}?',
  relaxes: 'Este valor protege menos contra la suplantación de identidad.',
  confirmLabel: 'Guardar ajuste',
  antiSpoofing: {
    label: 'Sensibilidad del anti-spoofing',
    description: 'Qué tan estricto es al detectar fotos, pantallas y videos.',
    saved: 'Anti-spoofing: nivel {level}',
  },
  steps: {
    label: 'Movimientos de la prueba de vida',
    description: 'Movimientos de cabeza aleatorios (girar, mirar arriba o abajo, acercarse).',
    /** Qué tan difícil de engañar es la prueba de vida con 1, 2 o 3 movimientos. */
    one: 'Un movimiento aleatorio (más rápido, menos seguro).',
    two: 'Dos movimientos aleatorios: un video grabado tendría que acertar la secuencia.',
    three: 'Tres movimientos aleatorios: lo más difícil de engañar, también para un video generado.',
    option_one: '{count} movimiento',
    option_other: '{count} movimientos',
    saved: 'Prueba de vida actualizada',
    savedText_one: 'Se pedirá {count} movimiento de cabeza al azar.',
    savedText_other: 'Se pedirán {count} movimientos de cabeza al azar.',
  },
  timeout: {
    label: 'Tiempo para la prueba de vida',
    description: 'Para el destello y los movimientos; si se acaba, se pide otro reto sin repetir el escaneo.',
    saved: 'Tiempo de la prueba de vida actualizado',
    savedText: 'Cada reto vencerá a los {time}.',
  },
  flash: {
    label: 'Destello de colores',
    description: 'La pantalla destella colores y el rostro real debe reflejarlos.',
    saved: 'Destello de colores: {mode}',
    /** Exigir el destello sin calibrar puede pedir repetir a personas reales. */
    warning:
      'Hazlo después de calibrar con capturas reales (Seguridad facial › Destello de colores). Con luz del sol directa puede pedir repetir la prueba.',
  },
  quality: {
    label: 'Calidad mínima de la captura',
    description: 'Las capturas oscuras o borrosas comparan mal y facilitan engaños; más alta, más reintentos con mala luz.',
    none: 'Sin mínimo',
    basic: 'Básica',
    medium: 'Media',
    high: 'Alta',
    saved: 'Calidad mínima actualizada',
    savedText: 'Se rechazarán las capturas con calidad menor a «{level}».',
    savedAny: 'Se acepta cualquier captura que pase los controles básicos.',
  },
  /** Aviso al guardar el número de intentos o la duración del bloqueo. */
  lockoutSaved: 'Bloqueo actualizado',
  lockoutFailures: {
    label: 'Intentos antes del bloqueo',
    description: 'Intentos fallidos o sospechosos seguidos que bloquean temporalmente la verificación facial.',
    option_one: '{count} intento',
    option_other: '{count} intentos',
    savedText_one: 'Se bloqueará tras {count} intento fallido.',
    savedText_other: 'Se bloqueará tras {count} intentos fallidos seguidos.',
  },
  lockoutMinutes: {
    label: 'Duración del bloqueo',
    description: 'Tiempo que debe esperar la persona (o el validador) antes de volver a intentarlo.',
    savedText: 'El bloqueo durará {time}.',
  },
  qrLifetime: {
    label: 'Vigencia del código QR',
    description: 'Cada QR del empleado se renueva solo al cumplir este tiempo y sirve una sola vez. Menos tiempo, más seguro.',
    saved: 'Vigencia del QR actualizada',
    savedText: 'Cada código QR durará {time} y servirá una sola vez.',
  },
  accuracy: {
    label: 'Precisión de la ubicación',
    description: 'Margen máximo que puede informar el teléfono; más estricto puede pedir activar la ubicación precisa.',
    /** Una opción: "Hasta 50 m". */
    option: 'Hasta {distance}',
    saved: 'Precisión actualizada',
    savedText: 'Se pedirá repetir el registro si la ubicación tiene un margen mayor a {distance}.',
  },
  speed: {
    label: 'Velocidad máxima creíble',
    description: 'Entre dos registros seguidos; lo que exija ir más rápido se rechaza como viaje imposible.',
    saved: 'Velocidad actualizada',
    savedText: 'Se rechazarán registros que exijan viajar a más de {speed} desde el anterior.',
  },
} as const;
