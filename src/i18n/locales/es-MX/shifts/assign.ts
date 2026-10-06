/** Textos de asignar un turno (a uno o a varios) y del historial de turnos de un empleado (es-MX). */
export default {
  title: 'Asignar turno',
  appliesFrom: 'Aplica desde',
  prepareError: 'No se pudo preparar la asignación',
  error: 'No se pudo asignar el turno',
  errors: {
    shiftRequired: 'Elige el turno',
    dateRequired: 'Elige la fecha desde la que aplica',
    fromTomorrow: 'Elige desde mañana: un cambio de turno se programa con un día de anticipación.',
    notPast: 'El turno no puede empezar en una fecha pasada.',
  },
  hints: {
    hasShift: 'Ya tiene turno: el cambio aplica desde mañana o después y su turno actual termina el día anterior.',
    firstShift: 'Su primer turno puede empezar hoy.',
    scheduled: 'Ya tiene un cambio a {shift} desde el {date}: elige una fecha posterior o cancélalo en su historial.',
  },
  confirm: {
    eyebrowChange: 'Cambio de turno',
    title: '¿Asignar el turno {shift} a {employee}?',
    note: 'Su turno actual termina el día anterior; lo ya registrado conserva su turno.',
  },
  done: {
    title: 'Turno asignado',
    text: '{employee} tendrá el turno {shift} desde el {date}.',
    endsBefore: 'Su turno actual termina el día anterior.',
    keepsRecords: 'Lo ya registrado conserva su turno.',
  },
  /** Asignar el mismo turno a varios empleados. */
  bulk: {
    title: 'Asignar a varios empleados',
    subtitle: 'El mismo turno y fecha de inicio para varios empleados.',
    dateHint: 'Quien ya tiene turno cambia desde mañana o después; si eliges hoy, no se le asigna. Su turno actual termina el día anterior.',
    employees: 'Empleados',
    employeesLabel: 'Empleados a los que se asigna el turno',
    employeesHint: 'Quien ya tiene esta asignación no cambia; a los inactivos no se les asigna.',
    employeesRequired: 'Elige al menos un empleado',
    submit_one: 'Asignar a {count} empleado',
    submit_other: 'Asignar a {count} empleados',
    confirmTitle_one: '¿Asignar el turno {shift} a {count} empleado?',
    confirmTitle_other: '¿Asignar el turno {shift} a {count} empleados?',
    confirmMessage: 'Quien ya la tiene no cambia y a los inactivos no se les asigna. El resultado mostrará a quién sí.',
    confirmNote: 'Quien ya tiene turno cambia desde la fecha elegida; su turno actual termina el día anterior.',
    /** Resultado por empleado. */
    result: {
      done: 'Asignado',
      unchanged: 'Ya lo tenían',
      skipped: 'No se asignó',
    },
  },
  /** Turnos de un empleado: vigente, programados y anteriores. */
  history: {
    title: 'Turnos del empleado',
    loadError: 'No se pudo cargar el empleado',
    listError: 'No se pudieron cargar sus turnos',
    backLabel: 'Expediente',
    subtitle: 'Turnos vigentes, programados y anteriores',
    section: 'Turnos asignados',
    noun: { one: 'asignación', other: 'asignaciones' },
    empty: {
      title: 'Sin turno asignado',
      active: 'Asígnale uno para que pueda checar.',
      inactive: 'Actívalo desde su expediente para asignarle un turno.',
    },
    cancel: 'Cancelar cambio',
    cancelConfirm: {
      eyebrow: 'Cambio programado',
      title: '¿Cancelar el cambio de {employee} al turno {shift}?',
      message: '{employee} conservará el turno que tiene.',
      scheduledShift: 'Turno programado',
      wasFrom: 'Iba a aplicar desde',
      keep: 'Conservar el cambio',
    },
    cancelError: 'No se pudo cancelar el cambio de turno',
    canceled: {
      title: 'Cambio de turno cancelado',
      text: '{employee} conserva el turno que tenía.',
    },
    /** «Eliminados»: un cambio cancelado se vuelve a programar (con las reglas de asignar). */
    restoreTitle: '¿Restaurar el cambio de {employee} al turno {shift}?',
  },
} as const;
