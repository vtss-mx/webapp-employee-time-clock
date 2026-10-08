import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/feedback';

/** Textos de los popups de mensajes y de las confirmaciones en italiano (it-IT). */
export default {
  understood: 'Ho capito',
  queue: '{position} di {total}',
  trace: {
    label: 'Codice di tracciamento',
    copy: 'Copia il codice di tracciamento',
    copied: 'Copiato',
  },
  invalidForm: {
    title: 'Controlla i dati',
    text: 'Correggi i campi evidenziati.',
  },
  noChanges: {
    title: 'Nessuna modifica',
    text: "Non c'è nulla da salvare.",
  },
} satisfies Translation<typeof es>;
