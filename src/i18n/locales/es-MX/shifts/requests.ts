/** Textos de las solicitudes de cambio de turno: la bandeja, aprobar y rechazar (es-MX). */
export default {
  title: 'Solicitudes de cambio de turno',
  backLabel: 'Solicitudes',
  loadError: 'No se pudieron cargar las solicitudes',
  subtitle_one: '{count} solicitud de tus empleados',
  subtitle_other: '{count} solicitudes de tus empleados',
  all: 'Todas las solicitudes',
  filter: 'Filtrar por estado',
  noun: { one: 'solicitud', other: 'solicitudes' },
  empty: {
    pendingTitle: 'Todo al día',
    pendingDescription: 'No hay solicitudes de turno por revisar.',
    statusTitle: 'Sin solicitudes',
    /** Con un estado elegido (no «Pendiente»). */
    statusDescription: 'Prueba con otro estado.',
    /** Con «Todas»: aún nadie ha pedido un cambio. */
    allDescription: 'Aquí verás los cambios de turno que pida tu personal.',
  },
  item: {
    approve: 'Aprobar la solicitud de {name}',
    reject: 'Rechazar la solicitud de {name}',
    when: 'Desde el {date} · pedida {ago}',
    companyNote: 'Nota de la empresa: “{note}”',
  },
  /** Lo que pidió el empleado. */
  summary: {
    change: 'Cambio',
    from: 'Desde',
    requested: 'Pedida',
    noShift: 'Sin turno',
    changesTo: 'cambia a',
  },
  /** La solicitud ya se decidió (o no existe). */
  closed: {
    loadError: 'No se pudo cargar la solicitud',
    title: 'Esta solicitud ya no está pendiente',
    description: 'Ya se aprobó, se rechazó o el empleado la canceló.',
    action: 'Ver solicitudes',
  },
  approve: {
    title: 'Aprobar cambio de turno',
    request: 'Solicitud',
    requestedShift: 'Turno pedido',
    fromTomorrow: 'Elige desde mañana: el cambio de turno se programa con un día de anticipación.',
    dateHint: 'Pidió desde el {date}. Su turno actual termina el día anterior y lo ya registrado no cambia.',
    error: 'No se pudo aprobar el cambio de turno',
    confirmTitle: '¿Aprobar el cambio de {employee} al turno {shift}?',
    confirmMessage: 'Su turno actual termina el día anterior y lo ya registrado no cambia.',
    submit: 'Aprobar cambio',
    done: {
      title: 'Cambio de turno aprobado',
      text: '{employee} tendrá el turno {shift} desde el {date}.',
    },
  },
  reject: {
    title: 'Rechazar cambio de turno',
    intro: 'Pidió cambiar al turno {shift} desde el {date}. Conservará su turno actual y verá esta nota en su solicitud.',
    placeholder: 'Explica por qué no se puede hacer el cambio (p. ej. falta personal en ese horario)',
    confirmTitle: '¿Rechazar el cambio de {employee}?',
    confirmMessage: 'Conservará su turno actual y verá tu nota en su solicitud.',
    requestedValue: '{shift} desde el {date}',
    done: {
      title: 'Solicitud rechazada',
      text: '{employee} conserva su turno y verá tu nota.',
    },
  },
} as const;
