import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/shifts';
import assign from './shifts/assign';
import form from './shifts/form';
import requests from './shifts/requests';

/**
 * Textos de turnos, solicitudes de cambio y asignaciones en alemán (de-DE): las mismas llaves que es-MX. Los días
 * «remotos» se dicen «Telearbeit», como en los mensajes del backend (sin préstamo del inglés).
 */
export default {
  days: {
    all: 'Jeden Tag',
    none: 'Keine Tage',
    range: '{from}–{to}',
  },
  schedule: {
    overnight: '{range} (Folgetag)',
  },
  moment: {
    dayBefore: '{time} am Vortag',
    dayAfter: '{time} am Folgetag',
  },
  validation: {
    minutesRequired: 'Geben Sie die Minuten an',
    minutesWhole: 'Geben Sie ganze Minuten ein',
    minutesRange: 'Zwischen {min} und {max} min',
    nameRequired: 'Geben Sie einen Namen ein (z. B. „{example}“)',
    nameMax: 'Höchstens {max} Zeichen',
  },
  breaks: {
    none: 'Keine Pausen',
    each: '{count} × {minutes} min',
  },
  period: {
    from: 'Ab dem {from}',
    range: 'Vom {from} bis zum {to}',
  },
  place: {
    none: 'Keiner',
    noSites: 'Keiner: An allen Tagen Telearbeit',
    onSiteOnly: 'Nur vor Ort: {sites}',
    allRemote: 'An allen Tagen Telearbeit',
    mixed: 'Telearbeit: {days} · Vor Ort: {sites}',
    noSite: 'kein Standort',
    siteRequired: 'Wählen Sie mindestens einen Standort für die Tage ohne Telearbeit',
    siteFallback: 'Standort {id}',
  },
  facts: {
    schedule: 'Arbeitszeit',
    sites: 'Standorte zum Stempeln',
    remoteDays: 'Tage mit Telearbeit',
  },
  card: {
    label: 'Schicht {name}: wann und wo gestempelt wird',
    remote: 'Telearbeit: {days}',
    remoteDetail: 'An diesen Tagen wird von überall gestempelt, mit Gesicht und Position.',
    within: 'Im Umkreis von {distance} um den Standort',
  },
  list: {
    title: 'Schichten',
    loadError: 'Die Schichten konnten nicht geladen werden',
    subtitle_one: '{count} Schicht · wann und wo gestempelt wird',
    subtitle_other: '{count} Schichten · wann und wo gestempelt wird',
    new: 'Neue Schicht',
    requests: 'Wechselanträge',
    assignMany: 'Mehreren zuweisen',
    searchPlaceholder: 'Nach Name suchen',
    searchLabel: 'Schichten suchen',
    noun: { one: 'Schicht', other: 'Schichten' },
    columns: {
      shift: 'Schicht',
      days: 'Tage',
      place: 'Wo gestempelt wird',
      breaks: 'Pausen',
      tolerance: 'Toleranz',
      employees: 'Mitarbeiter heute',
    },
    lateTolerance: '{minutes} min Toleranz bei Verspätung',
    noLateTolerance: 'Keine Toleranz bei Verspätung',
    noMatch: {
      title: 'Keine Ergebnisse',
      description: 'Versuchen Sie es mit einer anderen Suche oder einem anderen Filter.',
    },
    empty: {
      title: 'Keine Schichten',
      description: 'Erstellen Sie eine Schicht, um sie Ihrem Personal zuzuweisen.',
    },
  },
  recordStatus: {
    activateError: '{name} konnte nicht aktiviert werden',
    deactivateError: '{name} konnte nicht deaktiviert werden',
    removeError: '{name} konnte nicht gelöscht werden',
  },
  status: {
    title: 'Status der Schicht',
    activeMeaning: 'Sie kann Ihren Mitarbeitern zugewiesen und in Wechselanträgen gewählt werden.',
    inactiveMeaning: 'Sie kann nicht zugewiesen werden, und wer sie hat, hat keine geplanten Arbeitstage.',
    deactivateWarning:
      'Sie kann weder zugewiesen noch beantragt werden, und wer sie hat, hat bis zur Aktivierung keine geplanten Arbeitstage. Bereits Erfasstes bleibt erhalten.',
    removeWarning: 'Ihre offenen Wechselanträge werden storniert. Hat oder hatte jemand diese Schicht, kann sie nicht gelöscht werden: Deaktivieren Sie sie.',
    activateQuestion: 'Schicht {name} aktivieren?',
    deactivateQuestion: 'Schicht {name} deaktivieren?',
    removeQuestion: 'Schicht {name} löschen?',
    activated: 'Schicht aktiviert',
    deactivated: 'Schicht deaktiviert',
    removed: 'Schicht gelöscht',
    inUse: 'Die Schicht wird verwendet: Deaktivieren Sie sie',
  },
  choice: {
    label: 'Schicht',
    placeholder: 'Schicht auswählen',
    chosenHint: 'Um die Arbeitszeit oder den Ort zum Stempeln zu ändern, bearbeiten Sie die Schicht.',
    activeOnly: 'Es werden nur aktive Schichten angeboten.',
    since: 'Ab wann',
    empty: {
      title: 'Keine aktiven Schichten',
      description: 'Erstellen oder aktivieren Sie eine Schicht, um sie zuzuweisen.',
    },
  },
  sitePicker: {
    inactive: 'Deaktiviert: nimmt keine Zeitbuchungen an. Entfernen Sie ihn aus der Schicht oder aktivieren Sie ihn unter Arbeitsstandorte.',
    firstOnly_one: 'Der erste aktive Standort wird angezeigt (alphabetisch).',
    firstOnly_other: 'Die ersten {count} aktiven Standorte werden angezeigt (alphabetisch).',
    empty: {
      title: 'Keine aktiven Standorte',
      description: 'Erstellen Sie einen Standort, um ihn für diese Schicht auszuwählen.',
      action: 'Standort erstellen',
    },
  },
  weekdayPicker: {
    blocked: 'An diesem Tag gibt es keine Schicht',
    quick: 'Schnellauswahl: {label}',
  },
  trash: {
    restoreTitle: 'Schicht {name} wiederherstellen?',
    banner: 'Schicht gelöscht',
  },
  form,
  assign,
  requests,
} satisfies Translation<typeof es>;
