/** Textos de componentes base de components/ui (campos, listas, paginador, fechas, horas...) (es-MX). */
export default {
  /** Nombre accesible de lo que aún carga (indicador giratorio y esqueletos). */
  loading: 'Cargando',
  /** Botón del lugar del contenido que no se pudo cargar. */
  retry: 'Volver a cargar',
  formField: {
    confirmPassword: 'Confirmar contraseña',
    checking: 'Verificando',
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
  },
  copyField: {
    copied: 'Copiado',
  },
  listToolbar: {
    filter: 'Filtrar por estado',
    all: 'Todos los estados',
    active: 'Activos',
    inactive: 'Inactivos',
    /** La papelera del listado (se restaura durante 1 año). */
    deleted: 'Eliminados',
    /** Listados sin estados (departamentos, festivos): lo vigente, frente a «Eliminados». */
    allRecords: 'Todos',
  },
  paginator: {
    navigation: 'Paginación',
    /** "Mostrando 11–20 de 57 empleados" (`range` y `total` van resaltados). */
    range: 'Mostrando {range} de {total} {noun}',
    perPage: 'Por página',
    first: 'Primera página',
    previous: 'Página anterior',
    next: 'Página siguiente',
    last: 'Última página',
    page: 'Página {page}',
    /** "Página 2 de 6" (los números van resaltados). */
    status: 'Página {page} de {pages}',
    noun: {
      one: 'resultado',
      other: 'resultados',
    },
  },
  phoneField: {
    country: 'Lada: {country} ({dialCode}). Cambiar país',
    search: 'Buscar país o lada',
    searchPlaceholder: 'País o lada',
    countries: 'Países',
    noResults: 'Sin resultados para “{query}”',
  },
  rangeMeter: {
    min: 'Mínimo',
    max: 'Tope',
  },
  select: {
    placeholder: 'Selecciona una opción',
    search: 'Buscar…',
    empty: 'Sin resultados',
  },
  filePicker: {
    choose: 'Elegir archivo',
    drop: 'o arrástralo aquí',
    change: 'Cambiar',
    remove: 'Quitar archivo',
  },
  numberField: {
    decrement: 'Disminuir',
    increment: 'Aumentar',
  },
  columnChart: {
    /** Resumen para lectores de pantalla: "Peticiones por día. 30 días. Total Peticiones: 1,204. Máximo por día: 98.". */
    summary: '{title}. {count} {items}. Total {totals}. Máximo por {item}: {max}.',
    /** Líneas (una tendencia, p. ej. tiempos p50/p95/p99): sumar no tiene sentido; se dice el último valor de cada una. */
    latest: '{title}. {count} {items}. Al final: {totals}. Máximo: {max}.',
    day: {
      header: 'Día',
      one: 'día',
      other: 'días',
    },
  },
  timeField: {
    open: 'Elegir hora',
    title: 'Elegir hora',
    hours: 'Hora',
    minutes: 'Min',
    presets: 'Horas sugeridas',
    placeholder: 'hh:mm',
    /** Hora completa que no existe (los límites del día en el formato del idioma). */
    invalid: 'Escribe una hora entre {min} y {max}',
    outOfRange: 'Elige una hora entre {min} y {max}',
  },
  dateField: {
    /** Cómo se escribe la fecha (el orden de día, mes y año del idioma). */
    placeholder: 'dd/mm/aaaa',
    /** Validación de una fecha escrita que no existe (para los formularios que usan el campo). */
    invalid: 'Escribe una fecha válida (dd/mm/aaaa)',
    open: 'Abrir calendario',
    dialog: 'Elegir fecha',
    chooseMonth: 'Elegir mes, actual: {month}',
    chooseYear: 'Elegir año, actual: {year}',
    monthsOf: 'Meses de {year}',
    years: 'Años',
    nav: {
      days: { previous: 'Mes anterior', next: 'Mes siguiente' },
      months: { previous: 'Año anterior', next: 'Año siguiente' },
      years: { previous: 'Años anteriores', next: 'Años siguientes' },
    },
  },
  /** Papelera («Eliminados»): todo borrado se puede restaurar durante 1 año (decisión del dueño del producto). */
  trash: {
    /** Marca junto al nombre de un registro eliminado (asistencia, calendario, turnos y sitios). */
    mark: 'Eliminado',
    /** Cuándo y quién lo eliminó (filas de «Eliminados» y aviso del detalle). */
    deletedBy: 'Se eliminó el {date} por {email}',
    deletedOn: 'Se eliminó el {date}',
    /** Encabezados de las columnas de una tabla en «Eliminados». */
    column: 'Eliminación',
    actions: 'Acciones',
    restore: 'Restaurar',
    restoreLabel: 'Restaurar {name}',
    restoreError: 'No se pudo restaurar',
    /** Etiqueta sobre el título de la confirmación de restaurar. */
    eyebrow: 'Eliminados',
    /** Nota al eliminar: el registro va a «Eliminados». */
    note: 'Pasará a «Eliminados»: podrás restaurarlo durante 1 año.',
    /** Nota al eliminar a una persona (empleado, validador o las cuentas de una empresa). */
    personNote: 'Sus datos faciales y fotos se borran para siempre.',
    /** Nota al restaurar a un empleado (su rostro se borró al eliminarlo). */
    faceAgain: 'Deberá registrar su rostro de nuevo.',
    /** Nota al restaurar un validador o una empresa (sus fotos se borraron al eliminarlos). */
    photosGone: 'Sus fotos no se recuperan.',
    /** «Eliminados» sin nada (sin búsqueda). */
    empty: 'Nada eliminado',
    emptyDescription: 'Lo que elimines se guarda aquí durante un año.',
    /** Subtítulo de un listado en «Eliminados». */
    count_one: '{count} eliminado',
    count_other: '{count} eliminados',
  },
  /** Reproductor de video propio (ui/VideoPlayer). */
  video: {
    position: 'Posición del video',
  },
} as const;
