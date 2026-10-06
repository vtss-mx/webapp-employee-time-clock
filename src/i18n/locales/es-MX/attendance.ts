import review from './attendance/review';

/** Textos de asistencia vista por la empresa: tablero, historial, jornadas y registro manual (es-MX). */
export default {
  /** Nombres de los datos de una jornada (columnas, etiquetas y confirmaciones). */
  fields: {
    shift: 'Turno',
    checkIn: 'Entrada',
    checkOut: 'Salida',
    breaks: 'Descansos',
    schedule: 'Horario',
    breakTime: 'Tiempo en descanso',
    workedTime: 'Tiempo trabajado',
    worked: 'Trabajado',
    day: 'Día',
  },
  /** Regresos y títulos que se repiten entre pantallas. */
  nav: {
    dayBoard: 'Asistencia del día',
    history: 'Historial de asistencia',
    session: 'Jornada',
  },
  /** Botón y título de registrar la asistencia de quien no checó. */
  record: 'Registrar asistencia',
  /** Una salida que aún no se registra. */
  pending: 'Pendiente',
  /** Insignias de minutos junto a una hora (lo que lee el lector de pantalla). */
  minutes: {
    late: '{time} de retardo',
    early: 'Salió {time} antes',
    exceeded: '{time} de descanso de más',
  },
  breaks: {
    item: 'Descanso {number}',
    start: 'Inicio',
    end: 'Fin',
    add: 'Agregar descanso',
    remove: 'Quitar el descanso {number}',
    empty: 'Sin descansos: agrega los que tomó.',
    missing: 'Indica la hora',
    none: 'Su turno no tiene descansos',
    limit_one: 'Su turno permite {count} descanso',
    limit_other: 'Su turno permite {count} descansos',
    /** Una jornada o un registro sin descansos. */
    noBreaks: 'Sin descansos',
    /** Usados de los permitidos en el tablero ("1/2 descansos"). */
    used: '{used}/{allowed} descansos',
  },
  /** Lo que registró o corrigió la empresa. */
  company: {
    reasonLabel: 'Motivo:',
  },
  /** La evidencia de cada registro de la bitácora. */
  evidence: {
    distance: 'a {distance} de {site}',
    accuracy: 'Precisión de la ubicación que informó el dispositivo',
    confidence: 'Confianza de la verificación facial',
    face: 'Rostro {confidence}',
    operator: 'Quién lo registró',
    noteTitle: 'Motivo de la empresa',
    note: 'Motivo: {note}',
    map: 'Ver en el mapa',
    timeline: 'Registros de la jornada',
  },
  summary: {
    deadlinePassed: 'El límite fue a las {time}',
    deadline: 'Se puede checar hasta las {time}',
    breakEach: 'De {duration} cada uno',
    breaksUsed: '{used} de {allowed}',
    workedPending: 'Se calcula al checar la salida',
  },
  timeline: {
    label: 'Jornada del turno {shift}',
    since: 'Desde {time}',
    breakLimit: 'Puede durar hasta {duration}',
    breakUsed: '{used} de {allowed} permitidos',
    scheduled: 'Programada {time} · {place}',
    worked: 'Tiempo trabajado: {duration}',
    missed: 'Programada {time} · el límite para checarla fue a las {deadline}',
    pending: 'Programada {time} · se puede checar hasta las {deadline}',
  },
  /** Tablero del día. */
  board: {
    title: 'Asistencia',
    today: 'Hoy, {date}',
    history: 'Historial',
    quickDays: 'Días rápidos',
    searchPlaceholder: 'Buscar por nombre o número de empleado',
    searchLabel: 'Buscar empleados',
    loadError: 'No se pudo cargar la asistencia del día',
    kpis: {
      matches: 'Coinciden con la búsqueda',
      withShift: 'Con turno',
      done: 'Completas',
    },
    noun: { one: 'empleado', other: 'empleados' },
    emptySearch: {
      title: 'Sin resultados',
      description: 'Prueba con otra búsqueda.',
    },
    empty: {
      title: 'Nadie tiene turno este día',
      description: 'Elige otro día o asigna turnos a tu personal.',
    },
    correct: 'Corregir',
    correctTitle: 'Corregir la jornada de {name}',
    recordTitle: 'Registrar la asistencia de {name}',
  },
  /** Historial de jornadas. */
  history: {
    allDates: 'Todas las fechas',
    quickRanges: 'Rangos rápidos',
    from: 'Desde',
    to: 'Hasta',
    allStatuses: 'Todas',
    invalidDate: 'Escribe una fecha válida',
    loadError: 'No se pudo cargar el historial de asistencia',
    count_one: '{count} jornada',
    count_other: '{count} jornadas',
    noun: { one: 'jornada', other: 'jornadas' },
    emptyFiltered: {
      title: 'Sin resultados',
      description: 'Prueba con otras fechas o filtros.',
    },
    empty: {
      title: 'Sin jornadas',
      description: 'Aquí verás las jornadas registradas de tu personal.',
    },
  },
  /** Detalle de una jornada. */
  detail: {
    loadError: 'No se pudo cargar la jornada',
    summary: 'Resumen',
    events: 'Registros y evidencia',
    eventCount_one: '{count} registro',
    eventCount_other: '{count} registros',
    noEvents: {
      title: 'Sin registros',
      description: 'Aquí verás las entradas, salidas y descansos.',
    },
  },
  /** Registrar o corregir una jornada (solo la empresa). */
  manual: {
    correctTitle: 'Corregir jornada',
    workDate: 'Día que trabajó',
    stillWorking: 'Aún no sale',
    stillWorkingHint: 'La jornada queda abierta para su salida; si ya venció el límite, queda «Sin salida».',
    breaksHint: 'Los que tomó, según su turno (máximo {max}).',
    reasonCreate: '¿Por qué la registras tú?',
    reasonCorrect: '¿Por qué la corriges?',
    reasonPlaceholder: 'Por ejemplo: olvidó checar su salida.',
    reasonHint: 'El empleado lo verá en su historial (5 a 500 caracteres).',
    saveCorrection: 'Guardar corrección',
    validation: {
      dateMissing: 'Elige el día que trabajó',
      dateFuture: 'No puede ser un día futuro',
      checkIn: 'Indica la hora de entrada',
      checkOut: 'Indica la hora de salida o marca «Aún no sale»',
      breaks: 'Indica el inicio y el fin de cada descanso (o quítalo)',
      reason: 'Explica el motivo (al menos {min} caracteres)',
    },
    dayHint: {
      pick: 'El día de su turno (hasta hoy).',
      loading: 'Consultando su turno…',
      failed: 'No se pudo consultar su turno; se validará al registrar.',
      noShift: 'No tiene turno ese día; elige un día de su turno.',
      schedule: 'Turno {shift}: {range}.',
      dayOff: 'Es día libre. Si trabajó, márcalo como laborable en Calendario.',
      dayOffReason: 'Es día libre ({reason}). Si trabajó, márcalo como laborable en Calendario.',
      registered: 'Ya tiene jornada registrada; corrígela en vez de registrar otra.',
      lookupError: 'No se pudo consultar su turno',
    },
    times: {
      title: 'Entrada y salida',
      checkIn: 'Hora de entrada',
      checkOut: 'Hora de salida',
      preset: '{time} (programada)',
      checkInHint: 'Programada a las {time}',
      checkOutHint: 'Programada a las {time}; de madrugada cuenta como el día siguiente',
      overnightHint: 'De madrugada cuenta como el día siguiente',
    },
    confirm: {
      reason: 'Motivo que verá',
      eyebrow: 'Registro de la empresa',
      createTitle: '¿Registrar la asistencia de {name}?',
      createMessage: 'Queda registrada por la empresa, sin rostro ni ubicación: la respalda el motivo.',
      editTitle: '¿Corregir la jornada de {name} del {date}?',
      editNote: 'Lo anterior queda en la bitácora y el empleado verá el motivo.',
    },
    success: {
      created: 'Asistencia registrada',
      createdText: 'La jornada de {name} del {date} quedó registrada.',
      corrected: 'Jornada corregida',
      correctedText: 'Lo anterior queda en la bitácora de {name}.',
    },
    errors: {
      create: 'No se pudo registrar la asistencia',
      correct: 'No se pudo corregir la jornada',
      employee: 'No se pudo cargar al empleado',
    },
    missing: {
      title: 'Elige a quién registrar',
      description: 'En el tablero, toca «Registrar asistencia» en la fila del empleado.',
      action: 'Ir al tablero',
    },
  },
  review,
} as const;
