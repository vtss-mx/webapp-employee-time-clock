import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/dialogs';

/** Textos de popups de mensajes y confirmaciones, formularios con motivo y resultados masivos en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  hero: {
    error: 'Fehler',
    warning: 'Achtung',
    info: 'Information',
    success: 'Erledigt',
  },
  confirm: {
    eyebrow: {
      create: 'Neuer Eintrag',
      edit: 'Änderungen bestätigen',
      delete: 'Löschen',
      action: 'Bestätigung',
    },
    changes: 'Änderungen',
    changeCount_one: '{count} Änderung',
    changeCount_other: '{count} Änderungen',
    before: 'Vorher:',
    after: 'Nachher:',
    details: 'Details',
    typeToConfirm: 'Geben Sie zur Bestätigung „{text}“ ein',
  },
  bulk: {
    employeeNumber: 'Nr. {number}',
    more: 'und {count} weitere',
    withOmissions: '{title} (mit Auslassungen)',
  },
  reject: {
    back: 'Anträge',
    noteLabel: 'Anmerkung für den Mitarbeiter',
    noteShown: 'Sichtbare Anmerkung',
    noteTooShort: 'Nennen Sie den Grund (mindestens {min} Zeichen). Der Mitarbeiter sieht ihn.',
    errorTitle: 'Der Antrag konnte nicht abgelehnt werden',
  },
} satisfies Translation<typeof es>;
