import { derive } from '../../derive';
import es from '../es-MX/policy';

/**
 * Textos de la política de verificación (con su antifraude y los ajustes de los candados, `tuning`) en español de
 * España (es-ES): solo lo que cambia respecto de es-MX (vocabulario; glosario §3): «gafas», «mascarilla», «vídeo»,
 * «ordenador», «quiosco», «se aplica» (en España «aplicar» no se usa como intransitivo).
 */
export default derive(es, {
  appliesTo: 'Se aplica en segundos a todo el personal de {company}.',
  sections: {
    learning: {
      hint: 'Cada identificación segura enseña qué aspecto tiene hoy cada empleado. Las muestras que validó la empresa nunca se reemplazan.',
    },
    capture: {
      hint: 'Pruebas en tiempo real contra vídeos inyectados. Por ahora solo miden.',
    },
  },
  accessories: {
    blockGlasses: {
      on: 'Se pedirá quitarse las gafas (incluidas las de sol).',
      off: 'Se permite identificarse con gafas.',
    },
    blockMask: {
      on: 'Se pedirá quitarse la mascarilla (verificación física de nariz y mejillas).',
      off: 'Se permite identificarse con mascarilla (menor precisión).',
    },
  },
  options: {
    voiceVerification: {
      label: 'Verificación por voz y vídeo en el registro',
      on: 'Tras las fotos, el empleado responde en vídeo tres preguntas sobre sus datos; la voz y el rostro se comparan en el servidor y la empresa revisa el vídeo.',
    },
    antiSpoofing: {
      on: 'Detecta fotos impresas, pantallas y vídeos frente a la cámara.',
    },
    validatorMobileOnly: {
      off: 'Los validadores también pueden operar desde un ordenador con cámara.',
    },
  },
  warnings: {
    voiceVerification: 'Un registro con fotos de otra persona ya no tendrá la segunda comprobación de voz y rostro en vídeo.',
    spoofing: 'Esto reduce la protección contra suplantación de identidad (fotos, pantallas o vídeos).',
    mobileOnly: 'Los validadores podrán operar desde ordenadores, cuya cámara suele ser más fácil de engañar con fotos o pantallas.',
    captureProtocol: 'Un vídeo preparado de antemano será más difícil de detectar.',
  },
  tuning: {
    timeout: {
      savedText: 'Cada reto caducará a los {time}.',
    },
    antiSpoofing: {
      description: 'Nivel de exigencia al detectar fotos, pantallas y vídeos.',
    },
    steps: {
      two: 'Dos movimientos aleatorios: un vídeo grabado tendría que acertar la secuencia.',
      three: 'Tres movimientos aleatorios: lo más difícil de engañar, también para un vídeo generado.',
    },
    quality: {
      savedText: 'Se rechazarán las capturas con calidad inferior a «{level}».',
    },
    accuracy: {
      savedText: 'Se pedirá repetir el registro si la ubicación tiene un margen superior a {distance}.',
    },
  },
  governance: {
    relaxNote: 'Relaja la seguridad: otro administrador debe aprobarlo antes de que se aplique (regla de dos personas).',
  },
  presets: {
    hint: 'Un nivel fija los controles recomendados de una vez; si ajustas uno, la política queda «a medida».',
    custom: 'a medida',
    note: 'Se aplica en segundos a todo el personal; cada control cambiado queda en el historial.',
    noteTwoPerson: 'Lo que endurece se aplica en segundos; si algo relaja la seguridad, todo el nivel espera la aprobación de otro administrador.',
  },
  simulation: {
    genuine_one: '{count} intento sin fraude confirmado ya no pasaría directamente (molestias estimadas).',
    genuine_other: '{count} intentos sin fraude confirmado ya no pasarían directamente (molestias estimadas).',
  },
  changes: {
    approveNote: 'Relaja la seguridad de {company} y se aplica en segundos a todo su personal.',
  },
  presence: {
    signing: {
      enforceWarning: 'Un validador sin la clave de su dispositivo (ventana privada) no podrá identificar.',
    },
    siteCodes: {
      hint: 'En los sitios que lo activen, la entrada y la salida llevan el código del quiosco.',
      enforceWarning: 'Antes, instala un quiosco en cada sitio que lo active: sin el código no se registra.',
    },
  },
});
