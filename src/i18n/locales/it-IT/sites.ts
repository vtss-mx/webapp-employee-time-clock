import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/sites';

/** Testi delle sedi di verifica in italiano (it-IT): le stesse chiavi di es-MX. */
export default {
  list: {
    title: 'Sedi di verifica',
    loadError: 'Impossibile caricare le sedi',
    subtitle_one: "{count} sede · dove si verifica l'identità e con quale raggio",
    subtitle_other: "{count} sedi · dove si verifica l'identità e con quale raggio",
    new: 'Nuova sede',
    searchPlaceholder: 'Cerca per nome',
    searchLabel: 'Cerca sedi',
    noun: { one: 'sede', other: 'sedi' },
    columns: {
      site: 'Sede',
      address: 'Indirizzo',
      radius: 'Raggio',
      code: 'Codice',
    },
    kiosksOf_one: '{count} chiosco di {name}',
    kiosksOf_other: '{count} chioschi di {name}',
    noMatch: {
      title: 'Nessun risultato',
      description: "Prova con un'altra ricerca o un altro filtro.",
    },
    empty: {
      title: 'Nessuna sede di verifica',
      description: "Crea una sede per delimitare dove si verifica l'identità.",
    },
  },
  form: {
    loadError: 'Impossibile caricare la sede',
    newTitle: 'Nuova sede',
    editTitle: 'Modifica sede',
    newSubtitle: "Un luogo in cui si verifica l'identità: stabilimento, filiale, ufficio…",
    create: 'Crea sede',
    createError: 'Impossibile creare la sede',
    saveError: 'Impossibile salvare la sede',
    rule: 'Raggio per verificare: {distance}.',
    created: {
      title: 'Sede creata',
      text: '{name} si può ora usare durante la verifica. {rule}',
    },
    updated: {
      title: 'Sede aggiornata',
      text: '{name} · {rule}',
    },
    sections: {
      site: 'Sede',
      location: 'Posizione',
    },
    name: 'Nome della sede',
    nameExample: 'Stabilimento Hermosillo',
    nameHint: 'Unico nella tua azienda: ad es. «Stabilimento Hermosillo»',
    radius: 'Raggio per verificare (metri)',
    radiusHint: 'Tra {min} e {max} m: la dimensione del luogo più il margine del GPS.',
    suggestedRadii: 'Raggi suggeriti',
    onSiteNote: "In sede l'identità si verifica con il volto e la posizione del telefono, entro questo raggio.",
    locationIntro: 'Cerca il luogo o tocca la mappa. Il cerchio indica il raggio per verificare.',
    pointRequired: 'Segna sulla mappa il punto della sede',
  },
  fields: {
    address: 'Indirizzo',
    references: 'Riferimenti',
    point: 'Punto sulla mappa',
    radius: 'Raggio per verificare',
  },
  confirm: {
    createTitle: 'Creare la sede {name}?',
    createMessage: "Si potrà usare per delimitare dove si verifica l'identità.",
    willCreate: 'Verrà creata',
    editTitle: 'Salvare le modifiche della sede {name}?',
  },
  status: {
    title: 'Stato della sede',
    activeMeaning: "Accetta verifiche dell'identità in questo luogo.",
    inactiveMeaning: "Non accetta verifiche dell'identità in questo luogo.",
    deactivateWarning: 'Non accetterà verifiche qui finché non la attivi. Ciò che è già registrato non cambia.',
    removeWarning: 'Si può eliminare solo se nessuno vi è stato verificato. Se ci sono già verifiche, disattivala.',
    activateQuestion: 'Attivare la sede {name}?',
    deactivateQuestion: 'Disattivare la sede {name}?',
    removeQuestion: 'Eliminare la sede {name}?',
    activated: 'Sede attivata',
    deactivated: 'Sede disattivata',
    removed: 'Sede eliminata',
    inUse: 'La sede è in uso: disattivala',
  },
  recordStatus: {
    activateError: 'Impossibile attivare {name}',
    deactivateError: 'Impossibile disattivare {name}',
    removeError: 'Impossibile eliminare {name}',
  },
  validation: {
    nameRequired: 'Scrivi il nome della sede, ad es. «{example}»',
    nameMax: 'Al massimo {max} caratteri',
  },
  trash: {
    restoreTitle: 'Ripristinare la sede {name}?',
    banner: 'Sede eliminata',
  },
  presence: {
    label: 'Codice della sede',
    hint: 'Richiede durante la verifica il codice mostrato dal chiosco della sede.',
    on: 'Richiede il codice',
    off: 'Senza codice',
  },
} satisfies Translation<typeof es>;
