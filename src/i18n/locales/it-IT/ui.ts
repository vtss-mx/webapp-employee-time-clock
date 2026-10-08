import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/ui';

/** Textos de componentes base de components/ui (campos, listas, paginador, fechas, horas...) en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  loading: 'Caricamento',
  retry: 'Ricarica',
  formField: {
    confirmPassword: 'Conferma password',
    checking: 'Verifica in corso',
    showPassword: 'Mostra password',
    hidePassword: 'Nascondi password',
  },
  copyField: {
    copied: 'Copiato',
  },
  listToolbar: {
    filter: 'Filtra per stato',
    all: 'Tutti gli stati',
    active: 'Attivi',
    inactive: 'Inattivi',
    deleted: 'Eliminati',
    allRecords: 'Tutti',
  },
  paginator: {
    navigation: 'Paginazione',
    range: 'Visualizzazione di {range} su {total} {noun}',
    perPage: 'Per pagina',
    first: 'Prima pagina',
    previous: 'Pagina precedente',
    next: 'Pagina successiva',
    last: 'Ultima pagina',
    page: 'Pagina {page}',
    status: 'Pagina {page} di {pages}',
    noun: {
      one: 'risultato',
      other: 'risultati',
    },
  },
  phoneField: {
    country: 'Prefisso: {country} ({dialCode}). Cambia paese',
    search: 'Cerca paese o prefisso',
    searchPlaceholder: 'Paese o prefisso',
    countries: 'Paesi',
    noResults: 'Nessun risultato per «{query}»',
  },
  rangeMeter: {
    min: 'Minimo',
    max: 'Limite',
  },
  select: {
    placeholder: "Seleziona un'opzione",
    search: 'Cerca…',
    empty: 'Nessun risultato',
  },
  filePicker: {
    choose: 'Scegli file',
    drop: 'o trascinalo qui',
    change: 'Cambia',
    remove: 'Rimuovi file',
  },
  numberField: {
    decrement: 'Diminuisci',
    increment: 'Aumenta',
  },
  columnChart: {
    summary: '{title}. {count} {items}. Totale {totals}. Massimo per {item}: {max}.',
    latest: '{title}. {count} {items}. Alla fine: {totals}. Massimo: {max}.',
    day: {
      header: 'Giorno',
      one: 'giorno',
      other: 'giorni',
    },
  },
  timeField: {
    open: "Scegli l'ora",
    title: "Scegli l'ora",
    hours: 'Ora',
    minutes: 'Min',
    presets: 'Orari suggeriti',
    placeholder: 'hh:mm',
    invalid: "Inserisci un'ora tra le {min} e le {max}",
    outOfRange: "Scegli un'ora tra le {min} e le {max}",
  },
  dateField: {
    placeholder: 'gg/mm/aaaa',
    invalid: 'Inserisci una data valida (gg/mm/aaaa)',
    open: 'Apri il calendario',
    dialog: 'Scegli la data',
    chooseMonth: 'Scegli il mese, attuale: {month}',
    chooseYear: "Scegli l'anno, attuale: {year}",
    monthsOf: 'Mesi del {year}',
    years: 'Anni',
    nav: {
      days: { previous: 'Mese precedente', next: 'Mese successivo' },
      months: { previous: 'Anno precedente', next: 'Anno successivo' },
      years: { previous: 'Anni precedenti', next: 'Anni successivi' },
    },
  },
  trash: {
    mark: 'Eliminato',
    deletedBy: 'Eliminato il {date} da {email}',
    deletedOn: 'Eliminato il {date}',
    column: 'Eliminazione',
    actions: 'Azioni',
    restore: 'Ripristina',
    restoreLabel: 'Ripristina {name}',
    restoreError: 'Impossibile ripristinare',
    eyebrow: 'Eliminati',
    note: 'Passerà in «Eliminati»: potrai ripristinarlo per 1 anno.',
    personNote: 'I suoi dati del volto e le sue foto vengono cancellati per sempre.',
    faceAgain: 'Dovrà registrare di nuovo il proprio volto.',
    photosGone: 'Le sue foto non vengono recuperate.',
    empty: 'Nulla di eliminato',
    emptyDescription: 'Ciò che elimini resta qui per un anno.',
    count_one: '{count} eliminato',
    count_other: '{count} eliminati',
  },
  /** Reproductor de video propio (ui/VideoPlayer). */
  video: {
    position: 'Posizione del video',
  },
} satisfies Translation<typeof es>;
