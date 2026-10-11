/**
 * Documentos de identidad del empleado (es-MX): el onboarding del empleado (subir comprobante de domicilio e
 * identificación oficial, que el servidor lee con OCR) y el expediente que la empresa revisa y confirma junto al
 * registro facial. Los nombres de los tipos llegan del catálogo `employee_document_types`.
 */
export default {
  title: 'Mis documentos',
  add: 'Subir documento',
  loadError: 'No se pudieron cargar tus documentos',
  noun: {
    one: 'documento',
    other: 'documentos',
  },
  columns: {
    file: 'Documento',
    type: 'Tipo',
    status: 'Estado',
    uploaded: 'Subido',
    actions: 'Acciones',
  },
  /** Insignias de estado del documento. */
  status: {
    confirmed: 'Revisado',
    confirmedHint: 'Tu empresa ya revisó este documento',
    pending: 'En revisión',
    read: 'Datos leídos',
    notRead: 'Sin lectura automática',
  },
  empty: {
    title: 'Sin documentos',
    description: 'Sube tu primera identificación o comprobante para empezar.',
  },
  download: 'Descargar',
  downloadLabel: 'Descargar {name}',
  downloadError: 'No se pudo descargar el documento',
  deleteLabel: 'Eliminar {name}',
  deleteError: 'No se pudo eliminar el documento',
  remove: {
    title: '¿Eliminar {name}?',
    message: 'Podrás subir otro en su lugar.',
  },
  restoreTitle: '¿Restaurar {name}?',
  upload: {
    title: 'Subir documento',
    subtitle: 'Toma una foto o elige un archivo; lo leemos para rellenar tus datos.',
    fileSection: 'Documento',
    fileLabel: 'Foto o archivo',
    hint: 'Toma una foto o elige un PDF, JPG o PNG de hasta {max}.',
    dataSection: 'Tipo de documento',
    typeLabel: 'Tipo de documento',
    typePlaceholder: 'Elige el tipo',
    validating: 'Validando documento…',
    error: 'No se pudo subir el documento',
    confirm: {
      title: '¿Subir {name}?',
      message: 'Se guarda cifrado y tu empresa lo revisará.',
      detailsTitle: 'Se subirá',
      file: 'Archivo',
    },
    errors: {
      fileMissing: 'Elige o toma la foto del documento.',
      type: 'Elige una foto o un archivo PDF, JPG o PNG.',
      empty: 'El archivo está vacío. Elige otro.',
      size: 'El archivo pesa {size} y el máximo es {max}.',
      typeMissing: 'Elige el tipo de documento.',
    },
    /** 422: el servidor no reconoció un documento (no guardó nada). El motivo lo da el servidor; la app ofrece reintentar. */
    notRecognized: {
      title: 'Documento no reconocido',
      retake: 'Volver a tomar la foto',
      choose: 'Elegir otro archivo',
    },
  },
  /** Expediente del empleado que revisa la EMPRESA (junto al registro facial). */
  review: {
    title: 'Documentos del empleado',
    subtitle: 'Revisa los datos que leímos y confírmalos o corrígelos.',
    loadError: 'No se pudieron cargar los documentos del empleado',
    empty: {
      title: 'Sin documentos',
      description: 'El empleado todavía no sube documentos.',
    },
    confirmed: 'Confirmado',
    confirmedBy: 'Confirmado por {by}',
    pending: 'Por revisar',
    read: 'Lectura {value}',
    mrz: 'Dígitos MRZ correctos',
    mrzHelp: 'Los controles de lectura coinciden; no prueban la autenticidad del documento.',
    notRead: 'Sin lectura automática',
    download: 'Descargar',
    downloadError: 'No se pudo descargar el documento',
    dataTitle: 'Datos del documento',
    save: 'Confirmar datos',
    saved: 'Datos guardados',
    saveError: 'No se pudieron guardar los datos',
    confirm: {
      title: '¿Confirmar los datos de {name}?',
      message: 'Quedará registrado que tú los revisaste.',
    },
    fields: {
      fullName: 'Nombre completo',
      documentNumber: 'Número de documento',
      birthDate: 'Fecha de nacimiento',
      expiryDate: 'Vigencia',
      nationality: 'Nacionalidad',
      sex: 'Sexo',
      curp: 'CURP',
      voterKey: 'Clave de elector',
      postalCode: 'Código postal',
      address: 'Domicilio',
    },
  },
  /** Interruptor del ADMIN en la ficha de la empresa (módulo que concede la plataforma). */
  admin: {
    label: 'Documentos del registro',
    on: 'La empresa pide comprobante de domicilio e identificación oficial a su gente.',
    off: 'La empresa no pide documentos; enciéndelo para pedirlos en el registro.',
    giveTitle: '¿Pedir documentos a {name}?',
    giveMessage: 'Su gente deberá subir comprobante de domicilio e identificación oficial.',
    removeTitle: '¿Dejar de pedir documentos a {name}?',
    removeMessage: 'El empleado ya no verá la pantalla de documentos.',
    onNotice: 'Documentos activados',
    onText: 'La empresa ya pide documentos en el registro.',
    offNotice: 'Documentos desactivados',
    offText: 'La empresa ya no pide documentos.',
  },
} as const;
