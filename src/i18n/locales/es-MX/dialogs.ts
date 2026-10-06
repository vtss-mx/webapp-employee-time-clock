/** Textos de popups de mensajes y confirmaciones, formularios con motivo y resultados masivos (es-MX). */
export default {
  /** Etiqueta sobre el título de cada tipo de mensaje. */
  hero: {
    error: 'Error',
    warning: 'Atención',
    info: 'Información',
    success: 'Listo',
  },
  confirm: {
    /** Etiqueta sobre el título de cada tipo de confirmación (crear, editar, eliminar o una acción). */
    eyebrow: {
      create: 'Nuevo registro',
      edit: 'Confirmar cambios',
      delete: 'Eliminar',
      action: 'Confirmación',
    },
    changes: 'Cambios',
    changeCount_one: '{count} cambio',
    changeCount_other: '{count} cambios',
    /** Solo para lectores de pantalla: "Antes: Ana → Después: Ana María". */
    before: 'Antes:',
    after: 'Después:',
    details: 'Detalles',
    typeToConfirm: 'Escribe «{text}» para confirmar',
  },
  bulk: {
    employeeNumber: 'No. {number}',
    more: 'y {count} más',
    withOmissions: '{title} con omisiones',
  },
  reject: {
    back: 'Solicitudes',
    noteLabel: 'Nota para el empleado',
    noteShown: 'Nota que verá',
    noteTooShort: 'Explica el motivo (al menos {min} caracteres). El empleado lo verá.',
    errorTitle: 'No se pudo rechazar la solicitud',
  },
} as const;
