import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/attendance/review';

/** Registros "en revisión" en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  label: 'Revisione',
  inReview: 'In revisione',
  pendingHint: 'La tua azienda deve confermarla.',
  reasons: 'Perché: {reasons}',
  note: "Nota dell'azienda: {note}",
  decidedAt: 'Deciso il {date}',
  intro: "Qualcosa nell'acquisizione o nella posizione non era del tutto affidabile. Esamina le prove e conferma o rifiuta la registrazione.",
  eyebrow: 'Registrazione in revisione',
  confirm: 'Conferma la registrazione',
  confirmTitle: 'Confermare la registrazione di {name}?',
  confirmMessage: 'Resta valida. Il dipendente la vedrà confermata nel suo storico.',
  confirmError: 'Impossibile confermare la registrazione',
  reject: 'Rifiuta',
  onlyPending: 'Solo in revisione',
  onlyPendingHint: 'Giornate da confermare o rifiutare.',
  rejectPage: {
    title: 'Rifiuta la registrazione',
    intro: 'La giornata non viene cancellata: resta rifiutata e puoi correggerla. Il dipendente vedrà la tua nota.',
    label: 'Nota per il dipendente',
    placeholder: 'Perché la registrazione non viene accettata',
    required: 'Scrivi la nota (almeno 3 caratteri). Il dipendente la vedrà.',
    confirmTitle: 'Rifiutare la registrazione di {name}?',
    confirmMessage: 'Viene segnata come rifiutata; il dipendente vedrà la nota nel suo storico.',
    decided: 'Su questa registrazione è già stato deciso',
    error: 'Impossibile rifiutare la registrazione',
    done: 'Registrazione rifiutata',
    doneText: '{name} vedrà la tua nota nel suo storico.',
  },
} satisfies Translation<typeof es>;
