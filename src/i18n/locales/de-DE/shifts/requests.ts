import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/shifts/requests';

/** Textos de las solicitudes de cambio de turno en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  title: 'Anträge auf Schichtwechsel',
  backLabel: 'Anträge',
  loadError: 'Die Anträge konnten nicht geladen werden',
  subtitle_one: '{count} Antrag Ihrer Mitarbeiter',
  subtitle_other: '{count} Anträge Ihrer Mitarbeiter',
  all: 'Alle Anträge',
  filter: 'Nach Status filtern',
  noun: { one: 'Antrag', other: 'Anträge' },
  empty: {
    pendingTitle: 'Alles erledigt',
    pendingDescription: 'Keine Schichtanträge zu prüfen.',
    statusTitle: 'Keine Anträge',
    statusDescription: 'Versuchen Sie es mit einem anderen Status.',
    allDescription: 'Hier sehen Sie die Schichtwechsel, die Ihr Personal beantragt.',
  },
  item: {
    approve: 'Antrag von {name} genehmigen',
    reject: 'Antrag von {name} ablehnen',
    when: 'Ab {date} · beantragt {ago}',
    companyNote: 'Anmerkung des Unternehmens: „{note}“',
  },
  summary: {
    change: 'Wechsel',
    from: 'Ab',
    requested: 'Beantragt',
    noShift: 'Keine Schicht',
    changesTo: 'wechselt zu',
  },
  closed: {
    loadError: 'Der Antrag konnte nicht geladen werden',
    title: 'Dieser Antrag ist nicht mehr offen',
    description: 'Er wurde bereits genehmigt, abgelehnt oder vom Mitarbeiter zurückgezogen.',
    action: 'Anträge anzeigen',
  },
  approve: {
    title: 'Schichtwechsel genehmigen',
    request: 'Antrag',
    requestedShift: 'Beantragte Schicht',
    fromTomorrow: 'Wählen Sie ein Datum ab morgen: Der Schichtwechsel wird einen Tag im Voraus geplant.',
    dateHint: 'Beantragt ab {date}. Die aktuelle Schicht endet am Vortag; bereits Erfasstes bleibt unverändert.',
    error: 'Der Schichtwechsel konnte nicht genehmigt werden',
    confirmTitle: 'Wechsel von {employee} zur Schicht {shift} genehmigen?',
    confirmMessage: 'Die aktuelle Schicht endet am Vortag; bereits Erfasstes bleibt unverändert.',
    submit: 'Wechsel genehmigen',
    done: {
      title: 'Schichtwechsel genehmigt',
      text: '{employee} hat ab dem {date} die Schicht {shift}.',
    },
  },
  reject: {
    title: 'Schichtwechsel ablehnen',
    intro: 'Beantragt wurde der Wechsel zur Schicht {shift} ab dem {date}. Die aktuelle Schicht bleibt bestehen, und diese Anmerkung erscheint im Antrag.',
    placeholder: 'Erklären Sie, warum der Wechsel nicht möglich ist (z. B. zu wenig Personal in dieser Schicht)',
    confirmTitle: 'Wechsel von {employee} ablehnen?',
    confirmMessage: 'Die aktuelle Schicht bleibt bestehen; Ihre Anmerkung erscheint im Antrag.',
    requestedValue: '{shift} ab dem {date}',
    done: {
      title: 'Antrag abgelehnt',
      text: '{employee} behält die Schicht und sieht Ihre Anmerkung.',
    },
  },
} satisfies Translation<typeof es>;
