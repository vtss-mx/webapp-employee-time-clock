/** Textos de los puntos de verificación: el listado, el alta y la edición, su estado y sus confirmaciones (es-MX). */
export default {
  list: {
    title: 'Sitios de verificación',
    loadError: 'No se pudieron cargar los sitios',
    subtitle_one: '{count} sitio · dónde se verifica la identidad y con qué radio',
    subtitle_other: '{count} sitios · dónde se verifica la identidad y con qué radio',
    new: 'Nuevo sitio',
    searchPlaceholder: 'Buscar por nombre',
    searchLabel: 'Buscar sitios',
    noun: { one: 'sitio', other: 'sitios' },
    columns: {
      site: 'Sitio',
      address: 'Domicilio',
      radius: 'Radio',
      code: 'Código',
    },
    /** Botón a los kioscos del sitio (lo lee el lector de pantalla). */
    kiosksOf_one: '{count} kiosco de {name}',
    kiosksOf_other: '{count} kioscos de {name}',
    noMatch: {
      title: 'Sin resultados',
      description: 'Prueba con otra búsqueda o filtro.',
    },
    empty: {
      title: 'Sin sitios de verificación',
      description: 'Crea un sitio para acotar dónde se verifica.',
    },
  },
  form: {
    loadError: 'No se pudo cargar el sitio',
    newTitle: 'Nuevo sitio',
    editTitle: 'Editar sitio',
    newSubtitle: 'Un lugar donde se verifica la identidad: planta, sucursal, oficina…',
    create: 'Crear sitio',
    createError: 'No se pudo crear el sitio',
    saveError: 'No se pudo guardar el sitio',
    /** La regla del radio, en el aviso al guardar. */
    rule: 'Radio para verificar: {distance}.',
    created: {
      title: 'Sitio creado',
      text: '{name} ya se puede usar al verificar. {rule}',
    },
    updated: {
      title: 'Sitio actualizado',
      text: '{name} · {rule}',
    },
    sections: {
      site: 'Sitio',
      location: 'Ubicación',
    },
    name: 'Nombre del sitio',
    nameExample: 'Planta Hermosillo',
    nameHint: 'Único en tu empresa: p. ej. “Planta Hermosillo”',
    radius: 'Radio para verificar (metros)',
    radiusHint: 'Entre {min} y {max} m: el tamaño del lugar más el margen del GPS.',
    suggestedRadii: 'Radios sugeridos',
    onSiteNote: 'En sitio se verifica con el rostro y la ubicación del teléfono, dentro de este radio.',
    locationIntro: 'Busca el lugar o toca el mapa. El círculo marca el radio para verificar.',
    pointRequired: 'Marca en el mapa el punto del sitio',
  },
  /** Lo que se confirma de un sitio (alta: lo que se crea; edición: "antes → después"). */
  fields: {
    address: 'Domicilio',
    references: 'Referencias',
    point: 'Punto en el mapa',
    radius: 'Radio para verificar',
  },
  confirm: {
    createTitle: '¿Crear el sitio {name}?',
    createMessage: 'Se podrá usar para acotar dónde se verifica la identidad.',
    willCreate: 'Se creará',
    editTitle: '¿Guardar los cambios del sitio {name}?',
  },
  /** Estado de un sitio (su sección en la edición). */
  status: {
    title: 'Estado del sitio',
    activeMeaning: 'Acepta verificaciones de identidad en este lugar.',
    inactiveMeaning: 'No acepta verificaciones de identidad en este lugar.',
    deactivateWarning: 'No aceptará verificaciones aquí hasta que lo actives. Lo ya registrado no cambia.',
    removeWarning: 'Solo se puede eliminar si nadie se ha verificado ahí. Si ya hay verificaciones, desactívalo.',
    activateQuestion: '¿Activar el sitio {name}?',
    deactivateQuestion: '¿Desactivar el sitio {name}?',
    removeQuestion: '¿Eliminar el sitio {name}?',
    activated: 'Sitio activado',
    deactivated: 'Sitio desactivado',
    removed: 'Sitio eliminado',
    inUse: 'El sitio está en uso: desactívalo',
  },
  /** Títulos de los popups cuando falla activar, desactivar o eliminar el registro. */
  recordStatus: {
    activateError: 'No se pudo activar {name}',
    deactivateError: 'No se pudo desactivar {name}',
    removeError: 'No se pudo eliminar {name}',
  },
  /** Errores de lo capturado (solo para guiar: el servidor vuelve a validar). */
  validation: {
    nameRequired: 'Escribe el nombre del sitio, p. ej. “{example}”',
    nameMax: 'A lo más {max} caracteres',
  },
  /** «Eliminados»: restaurar y el aviso de un sitio eliminado. */
  trash: {
    restoreTitle: '¿Restaurar el sitio {name}?',
    banner: 'Sitio eliminado',
  },
  /** Código de sitio (antifraude 2b): la verificación pide el código del kiosco del sitio. */
  presence: {
    label: 'Código de sitio',
    hint: 'Pide al verificar el código que muestra el kiosco del sitio.',
    on: 'Pide código',
    off: 'Sin código',
  },
} as const;
