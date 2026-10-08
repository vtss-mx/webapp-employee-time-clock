import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/qr';

/** Textos de QR dinámico del empleado y lector de QR en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  dynamic: {
    used: {
      title: 'Codice usato',
      text: 'Generazione di un nuovo codice…',
    },
    replaced: {
      title: 'Codice sostituito',
      text: 'Ne è stato generato un altro su un altro dispositivo oppure la tua azienda lo ha invalidato.',
      action: 'Mostra un nuovo codice',
    },
    paused: {
      title: 'In pausa',
      text: 'È scaduto mentre non lo guardavi.',
      action: 'Mostra il codice',
    },
    error: 'Impossibile generare il tuo codice',
    imageError: 'Impossibile mostrare il tuo codice QR',
    enlarge: 'Ingrandisci il codice QR',
    renewsIn: 'Si rinnova tra {seconds}',
    seconds: '{value} s',
  },
  scan: {
    aim: 'Inquadra il codice QR con la fotocamera',
    busy: 'QR rilevato. Verifica…',
    invalid: 'QR non valido. Usa il codice generato per il tuo account',
    noPersonalData: 'Il codice non contiene dati personali.',
  },
  panel: {
    title: 'Codice QR dinamico',
    errorTitle: "Impossibile caricare l'attività del QR",
    live: 'Sullo schermo',
    none: 'Nessun codice valido',
    intro: 'Il dipendente lo genera sul suo telefono (Il mio codice QR). Cambia ogni {seconds} s e vale una sola volta: non si scarica né si stampa.',
    liveUntil: 'Valido fino a',
    lastIssued: 'Ultimo generato',
    lastUsed: 'Ultimo utilizzo',
    never: 'Mai',
    revoke: {
      action: 'Invalida il codice valido',
      eyebrow: 'Codice QR',
      title: 'Invalidare il codice valido?',
      message: 'Il codice sullo schermo del dipendente smetterà di funzionare subito. Potrà mostrarne uno nuovo sul suo telefono.',
      confirm: 'Invalida',
      error: 'Impossibile invalidare il codice',
      done: 'Codice invalidato',
      doneText: 'Il dipendente può mostrarne uno nuovo sul suo telefono.',
    },
  },
  phoneGuide: {
    open: 'Apri il tablet o il telefono.',
    openHow: 'Usa il browser (Safari, Chrome…) o la fotocamera.',
    scanOrType: '{scan} o digita questo indirizzo:',
    scanCode: 'Scansiona il codice',
    copyAddress: "Copia l'indirizzo",
    enterAddress: '{address} che ti ha fornito la tua azienda.',
    accessAddress: "Apri l'indirizzo di accesso",
    signIn: '{action} con la stessa e-mail e la stessa password.',
    signInAction: 'Accedi',
    scan: 'Scansionalo con il tablet o il telefono',
    qrAlt: "Codice QR per aprire l'applicazione. Scansionalo con il tablet o il telefono",
    desktopSite: 'Sei già su un tablet o un telefono? Disattiva {option} nel menu del browser e riprova.',
    desktopSiteOption: '«Sito desktop»',
  },
} satisfies Translation<typeof es>;
