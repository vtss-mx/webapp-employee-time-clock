import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/feedback';

/** Textos de los popups de mensajes y de las confirmaciones en alemán (de-DE). */
export default {
  understood: 'Verstanden',
  queue: '{position} von {total}',
  trace: {
    label: 'Referenzcode',
    copy: 'Referenzcode kopieren',
    copied: 'Kopiert',
  },
  invalidForm: {
    title: 'Angaben prüfen',
    text: 'Korrigieren Sie die markierten Felder.',
  },
  noChanges: {
    title: 'Keine Änderungen',
    text: 'Es gibt nichts zu speichern.',
  },
} satisfies Translation<typeof es>;
