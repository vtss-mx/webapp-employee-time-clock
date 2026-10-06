/**
 * Registros "en revisión" (es-MX): el motor de riesgo guardó la jornada pero la empresa la confirma o la rechaza (con
 * una nota que ve el empleado). Los nombres del estado y de los motivos vienen de los catálogos del backend.
 */
export default {
  label: 'Revisión',
  inReview: 'En revisión',
  pendingHint: 'Tu empresa debe confirmarlo.',
  reasons: 'Por qué: {reasons}',
  note: 'Nota de la empresa: {note}',
  decidedAt: 'Decidido el {date}',
  intro: 'Algo de la captura o la ubicación no fue del todo confiable. Revisa la evidencia y confirma o rechaza el registro.',
  eyebrow: 'Registro en revisión',
  confirm: 'Confirmar registro',
  confirmTitle: '¿Confirmar el registro de {name}?',
  confirmMessage: 'Queda como válido. El empleado lo verá confirmado en su historial.',
  confirmError: 'No se pudo confirmar el registro',
  reject: 'Rechazar',
  onlyPending: 'Solo en revisión',
  onlyPendingHint: 'Jornadas por confirmar o rechazar.',
  rejectPage: {
    title: 'Rechazar registro',
    intro: 'La jornada no se borra: queda rechazada y puedes corregirla. El empleado verá tu nota.',
    label: 'Nota para el empleado',
    placeholder: 'Por qué no se acepta el registro',
    required: 'Escribe la nota (al menos 3 caracteres). El empleado la verá.',
    confirmTitle: '¿Rechazar el registro de {name}?',
    confirmMessage: 'Queda marcado como rechazado; el empleado verá la nota en su historial.',
    decided: 'Este registro ya se decidió',
    error: 'No se pudo rechazar el registro',
    done: 'Registro rechazado',
    doneText: '{name} verá tu nota en su historial.',
  },
} as const;
