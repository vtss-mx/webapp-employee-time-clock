/** Textos del alta y la edición de un turno: campos, vista previa de la jornada y confirmaciones (es-MX). */
export default {
  loadError: 'No se pudo cargar el turno',
  newTitle: 'Nuevo turno',
  editTitle: 'Editar turno',
  newSubtitle: 'Define el horario, los descansos y dónde se checa.',
  editSubtitle: '{affects}. Los cambios aplican a las jornadas que aún no empiezan.',
  assignThis: 'Asignar este turno a…',
  create: 'Crear turno',
  createError: 'No se pudo crear el turno',
  saveError: 'No se pudo guardar el turno',
  created: {
    title: 'Turno creado',
    text: '{name} ya se puede asignar a tus empleados.',
  },
  updated: {
    title: 'Turno actualizado',
    text: 'Los cambios de {name} aplican a las jornadas que aún no empiezan.',
  },
  /** "Afecta a 8 empleados asignados" (los que lo tienen hoy). */
  affects_one: 'Afecta a {count} empleado asignado',
  affects_other: 'Afecta a {count} empleados asignados',
  /** Nombres de los campos (en el formulario y en las confirmaciones). */
  fields: {
    name: 'Nombre del turno',
    startTime: 'Hora de entrada',
    endTime: 'Hora de salida',
    weekdays: 'Días en que empieza',
    breaksCount: 'Descansos por jornada',
    breakMinutes: 'Minutos de cada descanso',
    earlyCheckIn: 'Checar antes de la entrada',
    lateTolerance: 'Retardo tolerado',
    earlyCheckOut: 'Salida anticipada tolerada',
    lateCheckOut: 'Límite para checar la salida',
    sites: 'Sitios donde se checa',
    remoteDays: 'Días en que se checa remoto',
  },
  /** Ejemplo del nombre en su validación ("Escribe un nombre (p. ej. "Matutino")"). */
  nameExample: 'Matutino',
  nameHint: 'Único en tu empresa: p. ej. “Matutino” o “Nocturno planta 2”',
  endHint: 'Si es antes de la entrada, termina al día siguiente',
  weekdaysHint: 'Un turno nocturno cuenta el día en que se entra.',
  /** Selecciones rápidas de los días ("Lun a vie" y "Lun a sáb" los arma el formato de días). */
  allDays: 'Todos',
  errors: {
    startRequired: 'Indica la hora de entrada',
    endRequired: 'Indica la hora de salida',
    endSameAsStart: 'La salida debe ser distinta de la entrada',
    breaksTooLong: 'Los descansos no pueden sumar todo el turno',
    windowTooLong: 'La entrada temprana, el turno y el límite de salida deben sumar menos de 24 horas',
    weekdaysRequired: 'Elige al menos un día en que empieza el turno',
  },
  sections: {
    schedule: 'Horario',
    place: 'Dónde se checa',
    breaks: 'Descansos',
    tolerances: 'Tolerancias',
    summary: 'Así queda la jornada',
  },
  /** Opciones de "Descansos por jornada". */
  breaksOption_zero: 'Sin descansos',
  breaksOption_one: '{count} descanso',
  breaksOption_other: '{count} descansos',
  minutes: '{minutes} min',
  suggestedDurations: 'Duraciones sugeridas',
  tolerances: {
    earlyCheckIn: 'Minutos antes de la hora de entrada en que ya puede checar',
    lateTolerance: 'Minutos después de la entrada que aún no cuentan como retardo',
    earlyCheckOut: 'Minutos antes de la salida que no cuentan como salida anticipada',
    lateCheckOut: 'Minutos después de la hora de salida para checarla',
    /** La ayuda de cada tolerancia con su rango. */
    hint: '{hint} (0 a {max})',
  },
  businessTime: 'Las horas usan la zona horaria del negocio en todos los dispositivos.',
  /** "Dónde se checa": sitios y días remotos del turno. */
  place: {
    sitesLabel: 'Sitios donde se checa en persona',
    sitesRequired: 'Obligatorio: los días no remotos se checa dentro del radio de uno de estos sitios.',
    sitesOptional: 'Opcional: todos los días del turno son remotos.',
    remoteLabel: 'Días en que se checa remoto',
    allItsDays: 'Todos sus días',
    remoteHint: 'Esos días se checa desde cualquier lugar; los demás, en uno de sus sitios.',
  },
  /** Vista previa en vivo de la jornada. */
  summary: {
    empty: 'Elige la hora de entrada y la de salida para ver la jornada.',
    workday: 'de jornada',
    overnight: 'Termina al día siguiente',
    checkIn: 'Entrada',
    checkOut: 'Salida',
    breaks: 'Descansos',
    days: 'Días',
    checkInRule: 'Puede checar desde las {opens}; después de las {late} es retardo.',
    checkOutRule: 'Desde las {from} y a más tardar a las {until}.',
  },
  /** Confirmaciones de crear y editar. */
  confirm: {
    createTitle: '¿Crear el turno {name}?',
    createMessage: 'Se podrá asignar a tus empleados y elegir en las solicitudes de cambio.',
    willCreate: 'Se creará',
    editTitle: '¿Guardar los cambios del turno {name}?',
    editMessage: '{affects}: desde ahora checan con este horario y en estos lugares.',
    editNote: 'Aplica a las jornadas que aún no empiezan. Lo ya registrado no cambia.',
  },
} as const;
