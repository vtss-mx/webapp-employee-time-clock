/**
 * Textos de seguridad facial de la plataforma (es-MX): la pantalla del ADMIN "Seguridad facial", sus
 * secciones (umbrales, empresas reforzadas, destello de colores) y "Recalcular ahora". Los nombres de
 * los umbrales y de los modos del destello vienen del backend.
 */
export default {
  loadError: 'No se pudo cargar la seguridad facial',
  title: 'Seguridad facial',
  subtitle: 'Umbrales endurecidos, empresas bajo ataque y mediciones de la captura.',
  recalibrate: 'Recalcular ahora',
  recalibrateError: 'No se pudieron recalcular los umbrales',
  recalibrated: 'Umbrales recalculados',
  kpis: {
    raised: 'Umbrales endurecidos',
    reinforced: 'Empresas reforzadas',
    measured: 'Destellos medidos',
    conclusive: 'Destellos concluyentes',
  },
  /** Cómo se calibra la plataforma (bajo los indicadores). */
  calibrationOff: 'La autocalibración está apagada en la configuración del servidor: los umbrales se quedan en su mínimo.',
  calibration_one:
    'Cada {hours} la plataforma mide los intentos exitosos del último día y sube cada umbral hasta donde casi todas las personas reales pasan con holgura (con al menos {samples} mediciones). Nunca lo baja.',
  calibration_other:
    'Cada {hours} la plataforma mide los intentos exitosos de los últimos {count} días y sube cada umbral hasta donde casi todas las personas reales pasan con holgura (con al menos {samples} mediciones). Nunca lo baja.',
  thresholdsSection: 'Umbrales que se endurecen solos',
  reinforcedSection: 'Empresas reforzadas por ataques',
  flashSection: 'Destello de colores',
  protocolSection: 'Protocolo de captura',
  ipSection: 'Base local de IP',
  /** Confirmación de "Recalcular ahora". */
  confirm: {
    eyebrow: 'Seguridad facial',
    title: '¿Recalcular ahora los umbrales?',
    message_one: 'Se recalculan con los intentos exitosos del último día, lo mismo que hace la plataforma cada {hours}.',
    message_other: 'Se recalculan con los intentos exitosos de los últimos {count} días, lo mismo que hace la plataforma cada {hours}.',
    window: 'Ventana',
    days_one: '{count} día',
    days_other: '{count} días',
    samples: 'Mediciones para mover un umbral',
    note: 'Solo endurece: ningún umbral baja de su mínimo ni sube de su tope (para no dejar fuera a personas reales).',
  },
  thresholds: {
    raised: 'Endurecido por la plataforma',
    atFloor: 'En el mínimo',
    atStart: 'En su valor de partida',
    tightest: 'Lo más estricto',
    start: 'De partida',
    measured_one: '{count} intento medido',
    measured_other: '{count} intentos medidos',
    computed: 'calculado {date}',
    notComputed: 'aún sin calcular',
  },
  reinforced: {
    /** La regla del refuerzo: con cuántos intentos sospechosos y en qué ventana (min). */
    rule_one: 'Con {count} intento sospechoso en {minutes} min, los retos de la empresa piden el máximo de movimientos hasta que la ventana quede limpia.',
    rule_other: 'Con {count} intentos sospechosos en {minutes} min, los retos de la empresa piden el máximo de movimientos hasta que la ventana quede limpia.',
    emptyTitle: 'Ninguna empresa bajo ataque',
    challenges: 'Retos reforzados',
    attempts_one: '{count} intento',
    attempts_other: '{count} intentos',
  },
  flash: {
    retired: 'Destello retirado por decisión del producto (2026-10-06): estas mediciones son históricas.',
    ready: 'Listo para exigirlo',
    calibrating: 'Calibrando',
    window_one: 'Intentos exitosos del último día.',
    window_other: 'Intentos exitosos de los últimos {count} días.',
    explain:
      'La respuesta mide qué tanto siguió el rostro los colores de la pantalla (1 = perfecto). Con demasiada luz ambiente, el destello casi no se nota y la medición no cuenta.',
    measured: 'Medidos',
    conclusive: 'Concluyentes',
    bright: 'Con demasiada luz',
    medianScore: 'Respuesta mediana',
    lowScore: 'Respuesta del 10 % más bajo',
    medianMagnitude: 'Intensidad mediana',
    medianRatio: 'Rostro contra fondo (mediana)',
    lowRatio: 'Rostro contra fondo (10 % más bajo)',
    canEnforce: 'Ya se puede exigir el destello',
    notYet: 'Aún no conviene exigirlo',
    /** `{enforce}` y `{observe}`: los nombres de los modos del destello (catálogo del backend). */
    advice:
      'Pasa una empresa a «{enforce}» en su política cuando haya suficientes mediciones concluyentes, el 10 % con menor respuesta supere el umbral vigente y pocas tengan demasiada luz. Mientras tanto, déjala en «{observe}»: no bloquea a nadie.',
    /** Lo que falta para exigir el destello. */
    pending: {
      samples: 'Reunir {required} mediciones concluyentes (van {current}).',
      score: 'Que el 10 % con menor respuesta supere {required} (hoy {current}).',
      bright: 'Menos mediciones con demasiada luz: hoy {current} (máximo {max}).',
    },
  },
  /** El protocolo de captura (antifraude 2a): destello dictado por el servidor y ráfaga de recortes del rostro. */
  protocol: {
    ready: 'Listo para exigirlo',
    calibrating: 'Midiendo',
    explain: 'El destello dictado revela cada color en el momento y la ráfaga envía unos segundos de recortes. Sirven contra videos inyectados.',
    flashAttempts: 'Destellos medidos',
    paced: 'Dictados por el servidor',
    late: 'Fuera de tiempo',
    paceTypical: 'Respuesta típica',
    paceSlow: 'Respuesta lenta (95 %)',
    window: 'Ventana por color',
    livenessAttempts: 'Intentos con prueba de vida',
    bursts: 'Con ráfaga',
    pulseMeasured: 'Pulso medido',
    pulseSeen: 'Pulso visible',
    pulseSnr: 'Nitidez del pulso (mediana)',
    pulseNote: 'El pulso solo se mide: nunca decide.',
    canEnforce: 'Ya se puede exigir el protocolo',
    notYet: 'Aún no conviene exigirlo',
    advice: 'Exige el protocolo en la política de cada empresa (señales «Destello sin dictar» y «Sin ráfaga de la captura») cuando casi todos los intentos lo cumplan. Mientras tanto solo se mide.',
    pending: {
      samples: 'Reunir {required} destellos dictados (van {current}).',
      paced: 'Que al menos el {min} de los destellos sea dictado (hoy {current}).',
      late: 'Menos respuestas fuera de tiempo: hoy {current} (máximo {max}).',
      bursts: 'Que al menos el {min} de los intentos traiga ráfaga (hoy {current}).',
    },
  },
  /** La base local de IP (antifraude 1b): con ella se miden la red y el país de cada intento. */
  ip: {
    country: 'País',
    asn: 'Red (sistema autónomo)',
    built: 'Archivo del {date}',
    missing: 'Sin archivo: las señales de red no se miden',
    refresh_one: 'Se actualiza sola cada {count} día.',
    refresh_other: 'Se actualiza sola cada {count} días.',
    refreshOff: 'La actualización automática está apagada en la configuración del servidor.',
    privacy: 'La IP nunca sale del servidor: se consulta en una base local.',
  },
} as const;
