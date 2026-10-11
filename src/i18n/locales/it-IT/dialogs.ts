import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/dialogs';

/** Textos de popups de mensajes y confirmaciones, formularios con motivo en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  hero: {
    error: 'Errore',
    warning: 'Attenzione',
    info: 'Informazione',
    success: 'Fatto',
  },
  confirm: {
    eyebrow: {
      create: 'Nuovo inserimento',
      edit: 'Conferma le modifiche',
      delete: 'Elimina',
      action: 'Conferma',
    },
    changes: 'Modifiche',
    changeCount_one: '{count} modifica',
    changeCount_other: '{count} modifiche',
    before: 'Prima:',
    after: 'Dopo:',
    details: 'Dettagli',
    typeToConfirm: 'Scrivi «{text}» per confermare',
  },
} satisfies Translation<typeof es>;
