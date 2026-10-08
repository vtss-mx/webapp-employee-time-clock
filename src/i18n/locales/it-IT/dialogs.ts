import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/dialogs';

/** Textos de popups de mensajes y confirmaciones, formularios con motivo y resultados masivos en italiano (it-IT): las mismas llaves que es-MX. */
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
  bulk: {
    employeeNumber: 'N. {number}',
    more: 'e altri {count}',
    withOmissions: '{title} con omissioni',
  },
  reject: {
    back: 'Richieste',
    noteLabel: 'Nota per il dipendente',
    noteShown: 'Nota che vedrà',
    noteTooShort: 'Spiega il motivo (almeno {min} caratteri). Il dipendente lo vedrà.',
    errorTitle: 'Impossibile rifiutare la richiesta',
  },
} satisfies Translation<typeof es>;
