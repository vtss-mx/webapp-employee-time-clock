import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/employee';

/** Textos de pantallas del empleado (verificación, registro facial, mi QR) en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  menu: {
    eyebrow: 'Identificazione',
    hello: 'Ciao, {name}',
    helloAnonymous: 'Ciao',
    question: 'Come vuoi identificarti?',
    face: 'VERIFICA CON IL VOLTO',
    faceLiveness: 'Riconoscimento facciale con verifica di vivacità',
    faceOnly: 'Riconoscimento facciale',
    start: 'Inizia',
    qr: 'MOSTRA IL MIO QR',
    qrText: 'Mostralo al validatore: cambia ogni {seconds} s e vale una sola volta',
    show: 'Mostra',
    footer: 'Identità convalidata dalla tua azienda · Connessione protetta',
  },
  verify: {
    title: 'Verifica del volto',
    submitting: 'Verifica della tua identità…',
    failed: 'Impossibile verificare la tua identità',
    showQr: 'Mostra il mio codice QR',
  },
  enrollment: {
    title: 'Registrazione del volto',
    tips: {
      light: 'Mettiti in un luogo ben illuminato.',
      front: 'Guarda la fotocamera di fronte, con il volto scoperto.',
    },
    rejected: {
      title: 'La tua registrazione precedente è stata rifiutata',
      reason: 'Motivo: «{reason}».',
      noReason: 'La tua azienda non è riuscita a convalidare la tua identità con le acquisizioni inviate.',
    },
    reverify: {
      title: 'Verifica di nuovo la tua identità',
      eyebrow: 'Richiesta della tua azienda',
      step: 'Registra il tuo volto con la verifica di vivacità; richiede circa un minuto.',
    },
    confirm: {
      replaces: 'La tua registrazione precedente verrà sostituita da questa.',
      replacesPhoto: 'La tua prima foto precedente verrà sostituita da questa.',
      open: 'Apri la fotocamera',
      photo: {
        title: 'Scattare la tua prima foto?',
        message: 'Si aprirà la fotocamera per scattare una foto del tuo volto di fronte. Viene salvata cifrata per la tua registrazione.',
      },
      captures: {
        title: 'Avviare le acquisizioni?',
        message: 'Si aprirà la fotocamera per fare {count} acquisizioni del tuo volto e la verifica di vivacità.',
      },
      video: {
        title: 'Registrare il video?',
        message_one: 'Si apriranno la fotocamera e il microfono per rispondere a {count} domanda in video.',
        message_other: 'Si apriranno la fotocamera e il microfono per rispondere a {count} domande in video.',
      },
    },
    submitting: 'Invio della registrazione…',
    sent: {
      title: 'Registrazione inviata',
      text: 'La tua azienda convaliderà a breve la tua identità.',
      offline: 'La tua azienda convaliderà a breve la tua identità. La schermata si aggiornerà quando tornerà la connessione.',
    },
    fatal: 'Impossibile completare la registrazione',
    again: 'Registra di nuovo il tuo volto',
    welcome: 'Benvenuto, {name}',
    intro: 'Per proteggere la tua identità, registra il tuo volto. Si fa una sola volta e la tua azienda lo convaliderà.',
    after: {
      title: 'Dopo: convalida della tua azienda',
      text: "La tua azienda verifica e approva la tua identità; vedrai il risultato nell'applicazione.",
    },
    before: 'Prima di iniziare:',
    privacy: 'Le tue foto, il tuo video e la tua voce vengono salvati cifrati e li rivede solo la tua azienda; non vengono mai condivisi.',
    /** Los cuatro pasos del registro (decisión del dueño, 2026-10-06), en el indicador sobre el visor. */
    steps: {
      label: 'Passo {current} di {total}',
      photo: 'Prima foto',
      captures: 'Acquisizioni',
      video: 'Video',
      done: 'Fatto',
    },
    /** Mientras se guarda la foto inicial (paso 1). */
    photoSaving: 'Salvataggio della foto…',
    /** El índice de los pasos independientes (decisión del dueño, 2026-10-07): estado, aviso y botón de cada uno. */
    index: {
      steps_one: '{count} passo',
      steps_other: '{count} passi',
      resume: 'Completali in ordine. Puoi uscire dopo qualsiasi passo e continuare un altro giorno: quello che hai fatto resta salvato.',
      errorTitle: 'Impossibile caricare la tua registrazione',
      label: 'Passi della registrazione del volto',
      photo: {
        title: 'Prima foto',
        text: 'Una foto del tuo volto di fronte, con una buona luce.',
      },
      captures: {
        title: 'Acquisizioni e verifica di vivacità',
        text: '{count} acquisizioni del tuo volto e quattro movimenti della testa.',
      },
      video: {
        title: 'Video con domande',
        text: 'Rispondi ad alta voce a domande sui tuoi dati, guardando la fotocamera.',
      },
      state: {
        pending: 'Da fare',
        done: 'Completato · {date}',
        complete: 'Completato',
        locked: 'Bloccato',
        expired: 'Scaduto',
        exhausted: 'Tentativi esauriti',
        answered: '{answered} di {total} risposte',
      },
      hint: {
        validUntil: 'Valida fino al {date}',
        expired: 'La tua foto è scaduta. Scattala di nuovo.',
        needsPhoto: 'Inizia scattando la tua prima foto.',
        needsCaptures: 'Completa prima le acquisizioni.',
        exhausted: 'I tentativi sono esauriti. Ripeti la prima foto e le acquisizioni.',
      },
      action: {
        photo: 'Scatta la foto',
        retakePhoto: 'Ripeti la foto',
        captures: 'Avvia le acquisizioni',
        video: 'Registra il video',
        resumeVideo: 'Continua il video',
      },
    },
    /** Una pantalla de un paso que se abrió fuera de orden: qué falta (su vacío). */
    blocked: {
      back: 'Torna alla registrazione',
      photoUsed: {
        title: 'Prima foto pronta',
        text: 'È già stata usata nelle tue acquisizioni. Continua con il passo successivo.',
      },
      needsPhoto: {
        title: 'Manca la prima foto',
        text: 'Scatta la tua prima foto prima delle acquisizioni.',
      },
      capturesDone: {
        title: 'Acquisizioni pronte',
        text: 'Sono già state inviate. Continua con il passo successivo.',
      },
      needsCaptures: {
        title: 'Mancano le acquisizioni',
        text: 'Completa le acquisizioni prima del video.',
      },
      exhausted: {
        title: 'Tentativi esauriti',
        text: 'Ripeti la prima foto e le acquisizioni per riprovare.',
      },
      noVideo: {
        title: 'Nessun video',
        text: 'La tua azienda non richiede il video con domande.',
      },
    },
  },
  myQr: {
    errorTitle: 'Impossibile generare il tuo codice QR',
    alt: 'Codice QR di {name}',
    eyebrow: 'Badge digitale',
    title: 'Il mio codice QR',
    intro: 'Mostralo al validatore per identificarti. Cambia ogni {seconds} s e vale una sola volta.',
    validated: 'Identità convalidata',
    employeeNumber: 'Matricola {number}',
    enlarge: 'Mostra a schermo intero',
    another: 'Genera un altro codice',
    brightness: 'Aumenta la luminosità dello schermo perché venga letto più rapidamente.',
    singleUse: 'Ogni codice vale una sola volta e scade in pochi secondi: una foto o una cattura dello schermo non funzionano. Non contiene i tuoi dati personali né biometrici.',
    brightnessLarge: "Aumenta la luminosità perché venga letto all'istante.",
  },
  pending: {
    errorTitle: 'Impossibile aggiornare lo stato',
    title: 'La tua identità è in fase di convalida',
    text: '{name}, la tua registrazione del volto è stata inviata. Un amministratore della tua azienda la esaminerà; qui vedrai quando sarà approvata.',
    sent: {
      title: 'Registrazione del volto inviata',
      text: 'Volto, verifica di vivacità e qualità verificati.',
    },
    review: {
      title: 'Convalida della tua azienda',
      text: 'Un amministratore conferma che sei tu.',
    },
    access: {
      title: 'Accesso abilitato',
      text: 'Potrai identificarti con il tuo volto o con il tuo codice QR.',
    },
    refresh: 'Aggiorna lo stato',
    auto: 'Questa schermata si aggiorna automaticamente.',
  },
} satisfies Translation<typeof es>;
