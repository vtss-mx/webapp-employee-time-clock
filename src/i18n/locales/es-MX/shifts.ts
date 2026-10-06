/**
 * Textos de turnos, solicitudes de cambio y asignaciones (es-MX). Lo general (días, horario, dónde
 * se checa, el listado, el estado y los selectores) vive aquí; el formulario, las asignaciones y las
 * solicitudes, en sus archivos (`./shifts/*`). Los nombres de los días salen de `Intl` (no se
 * escriben aquí); los estados de asignaciones y solicitudes vienen de los catálogos del backend.
 */
import assign from './shifts/assign';
import form from './shifts/form';
import requests from './shifts/requests';

export default {
  /** Días de un turno ("Lun a vie", "Todos los días"); los nombres de cada día los da `Intl`. */
  days: {
    all: 'Todos los días',
    none: 'Ningún día',
    /** Tres o más días seguidos: "Lun a vie". */
    range: '{from} a {to}',
  },
  schedule: {
    /** Horario que termina al día siguiente: "22:00 – 06:00 (día siguiente)". */
    overnight: '{range} (día siguiente)',
  },
  /** Una hora del turno que cae en otro día: "23:45 del día anterior". */
  moment: {
    dayBefore: '{time} del día anterior',
    dayAfter: '{time} del día siguiente',
  },
  validation: {
    minutesRequired: 'Indica los minutos',
    minutesWhole: 'Escribe minutos enteros',
    minutesRange: 'Entre {min} y {max} min',
    nameRequired: 'Escribe un nombre (p. ej. "{example}")',
    nameMax: 'Máximo {max} caracteres',
  },
  breaks: {
    none: 'Sin descansos',
    /** "2 × 15 min": cuántos descansos y cuánto dura cada uno. */
    each: '{count} × {minutes} min',
  },
  /** Vigencia de una asignación. */
  period: {
    from: 'Desde el {from}',
    range: 'Del {from} al {to}',
  },
  /** Dónde se checa con un turno. */
  place: {
    none: 'Ninguno',
    noSites: 'Ninguno: todos sus días son remotos',
    onSiteOnly: 'Solo en sitio: {sites}',
    allRemote: 'Remoto todos sus días',
    mixed: 'Remoto: {days} · En sitio: {sites}',
    noSite: 'ningún sitio',
    siteRequired: 'Elige al menos un sitio para los días no remotos',
    /** Un sitio que la pantalla no conoce por su nombre (solo su número). */
    siteFallback: 'Sitio {id}',
  },
  /** El turno en una confirmación (asignar, aprobar un cambio). */
  facts: {
    schedule: 'Horario',
    sites: 'Sitios donde checa',
    remoteDays: 'Días remotos',
  },
  /** Tarjeta del turno elegido y la lista de dónde se checa. */
  card: {
    label: 'Turno {name}: cuándo y dónde se checa',
    remote: 'Remoto: {days}',
    remoteDetail: 'Esos días se checa desde cualquier lugar, con el rostro y la ubicación.',
    within: 'Dentro de {distance} de su ubicación',
  },
  list: {
    title: 'Turnos',
    loadError: 'No se pudieron cargar los turnos',
    subtitle_one: '{count} turno · cuándo y dónde se checa',
    subtitle_other: '{count} turnos · cuándo y dónde se checa',
    new: 'Nuevo turno',
    requests: 'Solicitudes de cambio',
    assignMany: 'Asignar a varios',
    searchPlaceholder: 'Buscar por nombre',
    searchLabel: 'Buscar turnos',
    noun: { one: 'turno', other: 'turnos' },
    columns: {
      shift: 'Turno',
      days: 'Días',
      place: 'Dónde se checa',
      breaks: 'Descansos',
      tolerance: 'Tolerancia',
      employees: 'Empleados hoy',
    },
    lateTolerance: '{minutes} min de retardo',
    noLateTolerance: 'Sin retardo tolerado',
    noMatch: {
      title: 'Sin resultados',
      description: 'Prueba con otra búsqueda o filtro.',
    },
    empty: {
      title: 'Sin turnos',
      description: 'Crea un turno para asignarlo a tu personal.',
    },
  },
  /** Activar, desactivar y eliminar un turno o un sitio desde su edición (lo común a los dos). */
  recordStatus: {
    activateError: 'No se pudo activar {name}',
    deactivateError: 'No se pudo desactivar {name}',
    removeError: 'No se pudo eliminar {name}',
  },
  /** Estado de un turno (su sección en la edición). */
  status: {
    title: 'Estado del turno',
    activeMeaning: 'Se puede asignar a tus empleados y elegir en las solicitudes de cambio.',
    inactiveMeaning: 'No se puede asignar, y quienes lo tienen se quedan sin jornadas programadas.',
    deactivateWarning: 'No se podrá asignar ni pedir, y quienes lo tienen se quedarán sin jornadas programadas hasta que lo actives. Lo ya registrado se conserva.',
    removeWarning: 'Sus solicitudes de cambio pendientes se cancelarán. Si alguien lo tiene o lo tuvo, no se puede eliminar: desactívalo.',
    activateQuestion: '¿Activar el turno {name}?',
    deactivateQuestion: '¿Desactivar el turno {name}?',
    removeQuestion: '¿Eliminar el turno {name}?',
    activated: 'Turno activado',
    deactivated: 'Turno desactivado',
    removed: 'Turno eliminado',
    inUse: 'El turno está en uso: desactívalo',
  },
  /** Qué turno se asigna (a uno o a varios) y desde cuándo. */
  choice: {
    label: 'Turno',
    placeholder: 'Elige un turno',
    chosenHint: 'Para cambiar el horario o dónde se checa, edita el turno.',
    activeOnly: 'Solo se ofrecen los turnos activos.',
    since: 'Desde cuándo',
    empty: {
      title: 'Sin turnos activos',
      description: 'Crea o activa un turno para asignarlo.',
    },
  },
  /** Sitios donde se checa en persona con un turno. */
  sitePicker: {
    inactive: 'Desactivado: no acepta registros. Quítalo del turno o actívalo en Sitios de trabajo.',
    firstOnly_one: 'Se muestra el primer sitio activo (orden alfabético).',
    firstOnly_other: 'Se muestran los primeros {count} sitios activos (orden alfabético).',
    empty: {
      title: 'Sin sitios activos',
      description: 'Crea un sitio para elegirlo en este turno.',
      action: 'Crear sitio',
    },
  },
  weekdayPicker: {
    blocked: 'El turno no trabaja ese día',
    quick: 'Selección rápida: {label}',
  },
  /** «Eliminados»: restaurar y el aviso de un turno eliminado. */
  trash: {
    restoreTitle: '¿Restaurar el turno {name}?',
    banner: 'Turno eliminado',
  },
  form,
  assign,
  requests,
} as const;
