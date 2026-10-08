import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/location';

/** Textos de domicilios, mapas, búsqueda de lugares y ubicación en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  eyebrow: 'Posizione',
  problems: {
    unsupported: {
      title: 'Posizione non disponibile',
      text: 'Questo browser non consente di leggere la posizione. Usa Safari o Chrome aggiornati.',
    },
    insecure: {
      title: 'Connessione non sicura',
      text: "La posizione si può leggere solo da una connessione sicura (https). Apri l'applicazione con il suo indirizzo sicuro.",
    },
    denied: {
      title: "Consenti l'accesso alla tua posizione",
      text: "L'autorizzazione alla posizione è bloccata in questo browser.",
    },
    unavailable: {
      title: 'Impossibile ottenere la tua posizione',
      text: 'Attiva la posizione (GPS) e riprova, preferibilmente vicino a una finestra.',
    },
    timeout: {
      title: 'La posizione ha richiesto troppo tempo',
      text: 'Attiva la posizione esatta del dispositivo e riprova.',
    },
  },
  permissionSteps: {
    iphone: "iPhone: Impostazioni › Privacy e sicurezza › Localizzazione › Safari (o il tuo browser) › consenti l'accesso mentre usi l'applicazione.",
    android: "Android: tocca il lucchetto accanto all'indirizzo › Autorizzazioni › Posizione › Consenti.",
  },
  deniedFor: {
    login: {
      text: "Questo validatore può accedere solo nel suo luogo di attività e l'autorizzazione alla posizione è bloccata.",
      next: "Torna all'applicazione e accedi di nuovo.",
    },
    attendance: {
      text: "La registrazione della tua presenza richiede la tua posizione e l'autorizzazione è bloccata in questo browser.",
      next: 'Torna qui e tocca «Riprova».',
    },
    map: {
      text: "Per individuarti sulla mappa serve l'autorizzazione alla posizione, che è bloccata in questo browser.",
      next: 'Tocca di nuovo «La mia posizione» (o segna il punto sulla mappa).',
    },
    checkpoint: {
      text: "Questo validatore invia la sua posizione a ogni identificazione e l'autorizzazione è bloccata in questo browser.",
      next: 'Riapri il punto di controllo.',
    },
    verification: {
      text: "Questa verifica richiede la tua posizione e l'autorizzazione è bloccata in questo browser.",
      next: 'Torna qui e tocca «Riprova».',
    },
  },
  server: {
    outOfRange: 'Sei fuori dal luogo consentito',
    inaccurate: 'La tua posizione non è precisa',
    required: 'Serve la tua posizione',
    approach: "Avvicinati all'accesso in cui opera questo validatore.",
    gps: 'Attiva la posizione esatta (GPS) del dispositivo.',
    signInAgain: 'Accedi di nuovo.',
  },
  address: {
    country: {
      label: 'Paese',
      hint: "Paese in cui si trova l'indirizzo.",
      placeholder: 'Scegli il paese',
      search: 'Cerca paese',
      empty: 'Nessun paese corrisponde',
    },
    state: { label: 'Stato o provincia', hint: 'Stato federale o regione.' },
    municipality: { label: 'Comune o municipio', hint: 'Divisione amministrativa a cui appartiene.' },
    city: { label: 'Città o località', hint: 'Città, paese o località; può avere un nome diverso dal comune.' },
    neighborhood: { label: 'Quartiere o zona', hint: "Zona o insediamento all'interno della località." },
    postalCode: { label: 'Codice postale', hint: 'Codice della zona postale.' },
    street: { label: 'Via o strada', hint: 'Nome della via, del viale, della strada, eccetera.' },
    exteriorNumber: { label: 'Numero civico', hint: "Numero che identifica l'immobile; può contenere lettere." },
    interiorNumber: { label: 'Interno', hint: "Appartamento, ufficio o locale all'interno dell'immobile. È facoltativo." },
    referenceNotes: {
      label: 'Riferimenti',
      hint: 'Indicazioni aggiuntive per trovarlo, come le vie laterali o i punti vicini. Sono facoltative.',
      placeholder: 'Tra via Roma e via Milano, di fronte alla piazza',
    },
    interior: 'Interno {number}',
    required: {
      country: 'Scegli il paese',
      state: 'Inserisci lo stato o la provincia',
      municipality: 'Inserisci il comune o il municipio',
      city: 'Inserisci la città o la località',
      neighborhood: 'Inserisci il quartiere o la zona',
      postalCode: 'Inserisci il codice postale',
      street: 'Inserisci la via',
      exteriorNumber: 'Inserisci il numero civico (o s.n.c.)',
    },
    postalCodeMx: 'Il codice postale del Messico ha 5 cifre',
    postalCodeInvalid: 'Il codice postale non è valido',
    minLength: 'Inserisci almeno {min} caratteri',
    maxLength: 'Massimo {max} caratteri',
  },
  picker: {
    notices: {
      geocoding: "Impossibile completare l'indirizzo dalla mappa. Scrivilo a mano; il punto è stato comunque segnato.",
      geolocation: 'Impossibile ottenere la tua posizione. Segna il punto sulla mappa.',
      places: "La ricerca dei luoghi non è disponibile. Scrivi l'indirizzo e segna il punto sulla mappa.",
      maps: "La mappa non è disponibile. Scrivi l'indirizzo a mano.",
      offline: 'Google Maps non ha risposto. Controlla la connessione e riprova.',
      notFound: "Indirizzo non trovato. Controlla l'indirizzo o segna il punto sulla mappa.",
    },
    locateError: 'Impossibile individuare il punto',
    notConfigured: "La mappa non è configurata: l'indirizzo si inserisce a mano e non si può richiedere la posizione.",
    myLocation: 'La mia posizione',
    point: 'Punto: {point}',
    tapToMark: {
      access: "Tocca la mappa per segnare il punto dell'accesso",
      site: 'Tocca la mappa per segnare il punto della sede',
    },
    findingAddress: "ricerca dell'indirizzo…",
    locateWritten: "Individua l'indirizzo scritto",
    removePoint: 'Rimuovi il punto',
  },
  map: {
    label: 'Mappa: tocca per segnare il punto',
    pin: 'Punto segnato',
    loading: 'Caricamento della mappa…',
    failed: "La mappa non è disponibile. Scrivi l'indirizzo a mano.",
  },
  search: {
    label: 'Cerca un luogo o un indirizzo',
    clear: 'Cancella la ricerca',
    results: 'Luoghi trovati',
    credit: 'Risultati di Google',
    creditNearest: 'Prima i più vicini · Risultati di Google',
    failed: {
      title: 'Impossibile cercare',
      hint: 'Controlla la connessione o segna il punto sulla mappa.',
    },
    unavailable: {
      title: 'Nessun risultato',
      hint: "Scrivi l'indirizzo e segna il punto sulla mappa.",
    },
    none: {
      title: 'Nessun risultato',
      hint: 'Prova con un altro indirizzo o segna il punto sulla mappa.',
    },
  },
} satisfies Translation<typeof es>;
