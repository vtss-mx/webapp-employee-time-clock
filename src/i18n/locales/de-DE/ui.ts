import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/ui';

/** Textos de componentes base de components/ui (campos, listas, paginador, fechas, horas...) en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  loading: 'Wird geladen',
  retry: 'Neu laden',
  formField: {
    confirmPassword: 'Passwort bestätigen',
    checking: 'Wird geprüft',
    showPassword: 'Passwort anzeigen',
    hidePassword: 'Passwort verbergen',
  },
  copyField: {
    copied: 'Kopiert',
  },
  listToolbar: {
    filter: 'Nach Status filtern',
    all: 'Alle Status',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    deleted: 'Gelöscht',
    allRecords: 'Alle',
  },
  paginator: {
    navigation: 'Seitennavigation',
    range: 'Angezeigt: {range} von {total} {noun}',
    perPage: 'Pro Seite',
    first: 'Erste Seite',
    previous: 'Vorherige Seite',
    next: 'Nächste Seite',
    last: 'Letzte Seite',
    page: 'Seite {page}',
    status: 'Seite {page} von {pages}',
    noun: {
      one: 'Ergebnis',
      other: 'Ergebnisse',
    },
  },
  phoneField: {
    country: 'Vorwahl: {country} ({dialCode}). Land ändern',
    search: 'Land oder Vorwahl suchen',
    searchPlaceholder: 'Land oder Vorwahl',
    countries: 'Länder',
    noResults: 'Keine Ergebnisse für „{query}“',
  },
  rangeMeter: {
    min: 'Minimum',
    max: 'Obergrenze',
  },
  select: {
    placeholder: 'Option auswählen',
    search: 'Suchen…',
    empty: 'Keine Ergebnisse',
  },
  filePicker: {
    choose: 'Datei auswählen',
    drop: 'oder hierher ziehen',
    change: 'Ändern',
    remove: 'Datei entfernen',
  },
  numberField: {
    decrement: 'Verringern',
    increment: 'Erhöhen',
  },
  columnChart: {
    summary: '{title}. {count} {items}. Gesamt {totals}. Maximum pro {item}: {max}.',
    latest: '{title}. {count} {items}. Zuletzt: {totals}. Maximum: {max}.',
    day: {
      header: 'Tag',
      one: 'Tag',
      other: 'Tage',
    },
  },
  timeField: {
    open: 'Uhrzeit auswählen',
    title: 'Uhrzeit auswählen',
    hours: 'Stunde',
    minutes: 'Min.',
    presets: 'Vorgeschlagene Uhrzeiten',
    placeholder: 'hh:mm',
    invalid: 'Geben Sie eine Uhrzeit zwischen {min} und {max} ein',
    outOfRange: 'Wählen Sie eine Uhrzeit zwischen {min} und {max}',
  },
  dateField: {
    /** El campo escribe la fecha como el alemán: día, mes y año separados por punto (`DateField`, `dateLayout`). */
    placeholder: 'TT.MM.JJJJ',
    invalid: 'Geben Sie ein gültiges Datum ein (TT.MM.JJJJ)',
    open: 'Kalender öffnen',
    dialog: 'Datum auswählen',
    chooseMonth: 'Monat auswählen, aktuell: {month}',
    chooseYear: 'Jahr auswählen, aktuell: {year}',
    monthsOf: 'Monate des Jahres {year}',
    years: 'Jahre',
    nav: {
      days: { previous: 'Vorheriger Monat', next: 'Nächster Monat' },
      months: { previous: 'Vorheriges Jahr', next: 'Nächstes Jahr' },
      years: { previous: 'Vorherige Jahre', next: 'Nächste Jahre' },
    },
  },
  trash: {
    mark: 'Gelöscht',
    deletedBy: 'Gelöscht am {date} von {email}',
    deletedOn: 'Gelöscht am {date}',
    column: 'Löschung',
    actions: 'Aktionen',
    restore: 'Wiederherstellen',
    restoreLabel: '{name} wiederherstellen',
    restoreError: 'Die Wiederherstellung ist fehlgeschlagen',
    eyebrow: 'Gelöscht',
    note: 'Wird nach „Gelöscht“ verschoben: Sie können es 1 Jahr lang wiederherstellen.',
    personNote: 'Gesichtsdaten und Fotos werden endgültig gelöscht.',
    faceAgain: 'Das Gesicht muss erneut registriert werden.',
    photosGone: 'Die Fotos werden nicht wiederhergestellt.',
    empty: 'Nichts gelöscht',
    emptyDescription: 'Was Sie löschen, bleibt hier ein Jahr lang erhalten.',
    count_one: '{count} gelöscht',
    count_other: '{count} gelöscht',
  },
  /** Reproductor de video propio (ui/VideoPlayer). */
  video: {
    position: 'Videoposition',
  },
} satisfies Translation<typeof es>;
