/**
 * Documentos de una empresa (es-MX): la pantalla «Documentos» de la empresa, la sección de la ficha de la empresa
 * (ADMIN) y el formulario para subir uno. Los nombres de los tipos llegan del catálogo `company_document_types`.
 */
export default {
  title: 'Documentos',
  /** Subtítulo de la pantalla de la empresa: cuántos hay (vigentes) y para qué son. */
  count_one: '{count} documento · para la facturación de tu empresa',
  count_other: '{count} documentos · para la facturación de tu empresa',
  noun: {
    one: 'documento',
    other: 'documentos',
  },
  loadError: 'No se pudieron cargar los documentos',
  add: 'Subir documento',
  columns: {
    file: 'Documento',
    type: 'Tipo',
    size: 'Tamaño',
    uploaded: 'Subido',
    note: 'Nota',
    actions: 'Acciones',
  },
  /** Marca de lo que subió el administrador de la plataforma. */
  platform: 'Plataforma',
  platformHint: 'Lo subió el administrador de la plataforma',
  empty: {
    title: 'Sin documentos',
    description: 'Sube la constancia fiscal u otro documento para empezar.',
  },
  download: 'Descargar',
  downloadLabel: 'Descargar {name}',
  downloadError: 'No se pudo descargar el documento',
  deleteLabel: 'Eliminar {name}',
  deleteError: 'No se pudo eliminar el documento',
  /** Confirmaciones de eliminar y restaurar (con el tipo, el nombre y el tamaño). */
  remove: {
    title: '¿Eliminar {name}?',
    message: 'No se podrá descargar mientras esté en «Eliminados».',
  },
  restoreTitle: '¿Restaurar {name}?',
  upload: {
    title: 'Subir documento',
    /** Subtítulo en la pantalla de la empresa (en la del ADMIN, el nombre de la empresa). */
    subtitle: 'Se guarda cifrado y solo se descarga desde la aplicación.',
    fileSection: 'Archivo',
    fileLabel: 'Documento',
    hint: 'PDF, Word, Excel, XML, JPG o PNG de hasta {max}.',
    dataSection: 'Datos del documento',
    typeLabel: 'Tipo de documento',
    typePlaceholder: 'Elige el tipo',
    noteHint: 'Opcional · La ven la empresa y la plataforma.',
    uploading: 'Subiendo el documento…',
    error: 'No se pudo subir el documento',
    confirm: {
      title: '¿Subir {name}?',
      message: 'Se guardará cifrado en los documentos de la empresa.',
      detailsTitle: 'Se subirá',
      file: 'Archivo',
    },
    errors: {
      fileMissing: 'Elige el archivo que vas a subir.',
      type: 'Elige un archivo PDF, Word, Excel, XML, JPG o PNG.',
      empty: 'El archivo está vacío. Elige otro.',
      size: 'El archivo pesa {size} y el máximo es {max}.',
      typeMissing: 'Elige el tipo de documento.',
    },
  },
} as const;
