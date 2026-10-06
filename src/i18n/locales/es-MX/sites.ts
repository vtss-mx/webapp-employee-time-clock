/** Textos de sitios donde se checa: el listado, el alta y la edición, su estado y sus confirmaciones (es-MX). */
export default {
  list: {
    title: 'Sitios de trabajo',
    loadError: 'No se pudieron cargar los sitios',
    subtitle_one: '{count} sitio · dónde se checa en persona y con qué radio',
    subtitle_other: '{count} sitios · dónde se checa en persona y con qué radio',
    new: 'Nuevo sitio',
    searchPlaceholder: 'Buscar por nombre',
    searchLabel: 'Buscar sitios',
    noun: { one: 'sitio', other: 'sitios' },
    columns: {
      site: 'Sitio',
      address: 'Domicilio',
      radius: 'Radio',
      employees: 'Empleados hoy',
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
      title: 'Sin sitios de trabajo',
      description: 'Crea un sitio para indicar dónde checa tu personal.',
    },
  },
  form: {
    loadError: 'No se pudo cargar el sitio',
    newTitle: 'Nuevo sitio',
    editTitle: 'Editar sitio',
    newSubtitle: 'Un lugar donde tu personal checa en persona: planta, sucursal, oficina…',
    create: 'Crear sitio',
    createError: 'No se pudo crear el sitio',
    saveError: 'No se pudo guardar el sitio',
    /** La regla del radio, en el aviso al guardar. */
    rule: 'Radio para checar: {distance}.',
    created: {
      title: 'Sitio creado',
      text: '{name} ya se puede agregar a tus turnos. {rule}',
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
    radius: 'Radio para checar (metros)',
    radiusHint: 'Entre {min} y {max} m: el tamaño del lugar más el margen del GPS.',
    suggestedRadii: 'Radios sugeridos',
    onSiteNote: 'En sitio se checa con el rostro y la ubicación del teléfono, dentro de este radio.',
    locationIntro: 'Busca el lugar o toca el mapa. El círculo marca el radio para checar.',
    pointRequired: 'Marca en el mapa el punto del sitio',
  },
  /** Lo que se confirma de un sitio (alta: lo que se crea; edición: "antes → después"). */
  fields: {
    address: 'Domicilio',
    references: 'Referencias',
    point: 'Punto en el mapa',
    radius: 'Radio para checar',
  },
  confirm: {
    createTitle: '¿Crear el sitio {name}?',
    createMessage: 'Se podrá agregar a tus turnos; quien los tenga checará aquí.',
    willCreate: 'Se creará',
    editTitle: '¿Guardar los cambios del sitio {name}?',
  },
  /** Estado de un sitio (su sección en la edición). */
  status: {
    title: 'Estado del sitio',
    activeMeaning: 'Se puede agregar a los turnos y quien los tenga puede checar aquí.',
    inactiveMeaning: 'Nadie puede checar en este sitio y no se puede agregar a un turno.',
    deactivateWarning: 'Nadie podrá checar aquí ni agregarlo a un turno hasta que lo actives. Los turnos que lo incluyen y lo ya registrado no cambian.',
    removeWarning: 'Solo se puede eliminar si ningún turno lo usa y nadie ha checado ahí. Si un turno lo usa, quítalo del turno; si ya se checó ahí, desactívalo.',
    activateQuestion: '¿Activar el sitio {name}?',
    deactivateQuestion: '¿Desactivar el sitio {name}?',
    removeQuestion: '¿Eliminar el sitio {name}?',
    activated: 'Sitio activado',
    deactivated: 'Sitio desactivado',
    removed: 'Sitio eliminado',
    inUse: 'El sitio está en uso: desactívalo',
  },
  /** «Eliminados»: restaurar y el aviso de un sitio eliminado. */
  trash: {
    restoreTitle: '¿Restaurar el sitio {name}?',
    banner: 'Sitio eliminado',
  },
  /** Código de sitio (antifraude 2b): la entrada y la salida piden el código del kiosco del sitio. */
  presence: {
    label: 'Código de sitio',
    hint: 'Pide en la entrada y la salida el código que muestra el kiosco del sitio.',
    on: 'Pide código',
    off: 'Sin código',
  },
} as const;
