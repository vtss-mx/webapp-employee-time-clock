import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/shifts';
import assign from './shifts/assign';
import form from './shifts/form';
import requests from './shifts/requests';

/** Textos de turnos, solicitudes de cambio y asignaciones en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  days: {
    all: 'Tutti i giorni',
    none: 'Nessun giorno',
    range: '{from}–{to}',
  },
  schedule: {
    overnight: '{range} (giorno successivo)',
  },
  moment: {
    dayBefore: '{time} del giorno precedente',
    dayAfter: '{time} del giorno successivo',
  },
  validation: {
    minutesRequired: 'Indica i minuti',
    minutesWhole: 'Inserisci minuti interi',
    minutesRange: 'Tra {min} e {max} min',
    nameRequired: 'Inserisci un nome (ad es. «{example}»)',
    nameMax: 'Massimo {max} caratteri',
  },
  breaks: {
    none: 'Nessuna pausa',
    each: '{count} × {minutes} min',
  },
  period: {
    from: 'Dal {from}',
    range: 'Dal {from} al {to}',
  },
  place: {
    none: 'Nessuno',
    noSites: 'Nessuna: tutti i suoi giorni sono da remoto',
    onSiteOnly: 'Solo in sede: {sites}',
    allRemote: 'Da remoto tutti i suoi giorni',
    mixed: 'Da remoto: {days} · In sede: {sites}',
    noSite: 'nessuna sede',
    siteRequired: 'Scegli almeno una sede per i giorni non da remoto',
    siteFallback: 'Sede {id}',
  },
  facts: {
    schedule: 'Orario',
    sites: 'Sedi in cui timbra',
    remoteDays: 'Giorni da remoto',
  },
  card: {
    label: 'Turno {name}: quando e dove si timbra',
    remote: 'Da remoto: {days}',
    remoteDetail: 'In quei giorni si timbra da qualsiasi luogo, con il volto e la posizione.',
    within: 'Entro {distance} dalla sua posizione',
  },
  list: {
    title: 'Turni',
    loadError: 'Impossibile caricare i turni',
    subtitle_one: '{count} turno · quando e dove si timbra',
    subtitle_other: '{count} turni · quando e dove si timbra',
    new: 'Nuovo turno',
    requests: 'Richieste di cambio',
    assignMany: 'Assegna a più dipendenti',
    searchPlaceholder: 'Cerca per nome',
    searchLabel: 'Cerca turni',
    noun: { one: 'turno', other: 'turni' },
    columns: {
      shift: 'Turno',
      days: 'Giorni',
      place: 'Dove si timbra',
      breaks: 'Pause',
      tolerance: 'Tolleranza',
      employees: 'Dipendenti oggi',
    },
    lateTolerance: '{minutes} min di ritardo',
    noLateTolerance: 'Nessun ritardo tollerato',
    noMatch: {
      title: 'Nessun risultato',
      description: "Prova con un'altra ricerca o un altro filtro.",
    },
    empty: {
      title: 'Nessun turno',
      description: 'Crea un turno per assegnarlo al tuo personale.',
    },
  },
  recordStatus: {
    activateError: 'Impossibile attivare {name}',
    deactivateError: 'Impossibile disattivare {name}',
    removeError: 'Impossibile eliminare {name}',
  },
  status: {
    title: 'Stato del turno',
    activeMeaning: 'Si può assegnare ai tuoi dipendenti e scegliere nelle richieste di cambio.',
    inactiveMeaning: 'Non si può assegnare e chi lo ha resta senza giornate programmate.',
    deactivateWarning: 'Non si potrà assegnare né richiedere e chi lo ha resterà senza giornate programmate finché non lo attivi. Ciò che è già registrato viene conservato.',
    removeWarning: 'Le sue richieste di cambio in sospeso verranno annullate. Se qualcuno lo ha o lo ha avuto, non si può eliminare: disattivalo.',
    activateQuestion: 'Attivare il turno {name}?',
    deactivateQuestion: 'Disattivare il turno {name}?',
    removeQuestion: 'Eliminare il turno {name}?',
    activated: 'Turno attivato',
    deactivated: 'Turno disattivato',
    removed: 'Turno eliminato',
    inUse: 'Il turno è in uso: disattivalo',
  },
  choice: {
    label: 'Turno',
    placeholder: 'Scegli un turno',
    chosenHint: "Per cambiare l'orario o dove si timbra, modifica il turno.",
    activeOnly: 'Vengono proposti solo i turni attivi.',
    since: 'Da quando',
    empty: {
      title: 'Nessun turno attivo',
      description: 'Crea o attiva un turno per assegnarlo.',
    },
  },
  sitePicker: {
    inactive: 'Disattivata: non accetta registrazioni. Toglila dal turno o attivala in Sedi di lavoro.',
    firstOnly_one: 'Viene mostrata la prima sede attiva (in ordine alfabetico).',
    firstOnly_other: 'Vengono mostrate le prime {count} sedi attive (in ordine alfabetico).',
    empty: {
      title: 'Nessuna sede attiva',
      description: 'Crea una sede per sceglierla in questo turno.',
      action: 'Crea sede',
    },
  },
  weekdayPicker: {
    blocked: 'Il turno non lavora in quel giorno',
    quick: 'Selezione rapida: {label}',
  },
  trash: {
    restoreTitle: 'Ripristinare il turno {name}?',
    banner: 'Turno eliminato',
  },
  form,
  assign,
  requests,
} satisfies Translation<typeof es>;
