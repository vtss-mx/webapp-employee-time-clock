import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/policy';
import antifraud from './policy/antifraud';
import tuning from './policy/tuning';

/** Textos de política de verificación y ajustes de la prueba de vida de una empresa en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  /** Control retirado por decisión del dueño del producto (2026-10-06): se muestra apagado y sin cambios. */
  retired: 'Disattivato per decisione di prodotto (2026-10-06).',
  loadError: 'Impossibile caricare i criteri di verifica',
  title: "Criteri di verifica dell'identità",
  saveError: 'Impossibile salvare',
  recommended: 'Consigliato',
  appliesTo: 'Si applica in pochi secondi a tutto il personale di {company}.',
  confidence: {
    title: 'Livello di affidabilità',
    intro: 'Probabilità minima che la persona davanti alla fotocamera sia il dipendente registrato.',
    identifyIntro:
      '{lead} (validatori): puoi richiedere di più, perché cercare tra molti aumenta le corrispondenze false. Non si applica mai al di sotto del livello precedente.',
    identifyLead: 'Quando si identifica tra tutti i dipendenti',
    identifyLabel: 'Livello di affidabilità per identificare tra tutti',
    saved: 'Livello di affidabilità aggiornato',
    savedText: 'In ogni verifica del volto verrà richiesto il {value}.',
    identifySaved: "Affidabilità per l'identificazione aggiornata",
    identifySavedText: 'I validatori richiederanno il {value} quando identificano tra tutti i dipendenti.',
  },
  sections: {
    face: {
      title: 'Requisiti del volto',
      hint: 'Cosa deve togliersi la persona prima della scansione. Coprire il volto riduce la precisione.',
    },
    security: {
      title: 'Sicurezza',
      hint: "Protezioni contro la contraffazione dell'identità; conviene mantenerle attive.",
    },
    locks: {
      title: 'Barriere contro la contraffazione',
      hint: 'Ogni barriera blocca un modo diverso di ingannare il riconoscimento facciale; conviene mantenerle tutte attive.',
    },
    learning: {
      title: 'Apprendimento continuo',
      hint: "Ogni identificazione sicura insegna l'aspetto attuale di ciascun dipendente. I campioni convalidati dall'azienda non vengono mai sostituiti.",
    },
    location: {
      title: 'Posizione delle presenze',
      hint: "Ogni registrazione della presenza include la posizione del telefono e l'ora del server; regola qui sotto la precisione e la velocità.",
    },
    methods: {
      title: 'Metodi di identificazione',
      hint: 'Modi in cui i dipendenti possono identificarsi.',
    },
    antifraud: {
      title: 'Antifrode',
      hint: "Nel dubbio, il motore chiede un passaggio in più o lascia la registrazione in revisione all'azienda. Le prove dei tentativi sospetti le vede solo l'amministratore in «Casi di frode».",
    },
    capture: {
      title: 'Protocollo di acquisizione',
      hint: 'Prove in tempo reale contro i video iniettati. Per ora si limitano a misurare.',
    },
    devices: {
      title: 'Dispositivi dei validatori',
      hint: 'Solo i validatori hanno restrizioni; dipendenti e amministratori usano qualsiasi dispositivo.',
    },
  },
  accessories: {
    remove: 'Togliere {phrase}',
    blockGlasses: {
      on: 'Verrà chiesto di togliere gli occhiali (inclusi quelli da sole).',
      off: 'È consentito identificarsi con gli occhiali.',
    },
    blockHeadwear: {
      on: 'Verrà chiesto di togliere berretti, cappelli e visiere (salvo i dipendenti esentati per motivi religiosi o medici).',
      off: 'È consentito identificarsi con un copricapo.',
    },
    blockMask: {
      on: 'Verrà chiesto di togliere la mascherina (verifica fisica di naso e guance).',
      off: 'È consentito identificarsi con la mascherina (precisione minore).',
    },
  },
  options: {
    livenessChallenge: {
      label: 'Verifica di vivacità',
      on: 'La persona fa movimenti casuali della testa.',
      off: 'Nessuna sfida di movimenti.',
    },
    antiSpoofing: {
      label: 'Rilevamento della contraffazione',
      on: 'Rileva foto stampate, schermi e video davanti alla fotocamera.',
      off: 'Foto e schermi non vengono analizzati.',
    },
    blockVirtualCameras: {
      label: 'Blocca le fotocamere virtuali',
      on: 'Vengono rifiutati i programmi che si spacciano per una fotocamera (OBS, ManyCam…).',
      off: 'Viene accettata qualsiasi fotocamera, comprese quelle virtuali.',
    },
    rejectForeignImages: {
      label: 'Solo acquisizioni dal vivo',
      on: 'Vengono rifiutate le immagini della galleria o modificate.',
      off: 'Vengono accettate le immagini della galleria o modificate.',
    },
    detectStaticCaptures: {
      label: 'Rileva le foto statiche',
      on: 'Un tentativo viene rifiutato se le sue acquisizioni sono identiche (una foto inviata più volte).',
      off: 'Le acquisizioni non vengono confrontate tra loro.',
    },
    detectReplays: {
      label: 'Rileva le acquisizioni riutilizzate',
      on: 'Ogni acquisizione vale una sola volta: il nuovo invio di acquisizioni salvate o intercettate viene rifiutato.',
      off: 'Le acquisizioni ricevute non vengono ricordate.',
    },
    checkCaptureContinuity: {
      label: "Richiedi un'unica ripresa",
      on: 'Tutte le acquisizioni devono provenire dalla stessa fotocamera, con volto e luce continui durante la rotazione.',
      off: 'Fotocamera, inquadratura e luce non vengono confrontate tra le acquisizioni.',
    },
    enforceHumanTiming: {
      label: 'Tempi umani nella verifica di vivacità',
      on: 'Vengono rifiutate le risposte alla sfida più rapide di quanto impiega una persona (programmi automatici).',
      off: 'Il tempo di risposta alla sfida non viene misurato.',
    },
    detectDuplicateFaces: {
      label: 'Rileva i volti duplicati',
      on: 'Quando si registra un volto già approvato per un altro dipendente: viene segnalato per la revisione o, di persona, bloccato.',
      off: 'La registrazione non viene confrontata con gli altri dipendenti.',
    },
    lockoutEnabled: {
      label: 'Blocco per tentativi falliti',
      on: 'Dopo vari tentativi falliti o sospetti consecutivi si blocca temporaneamente (regolalo qui sotto).',
      off: 'Si può riprovare senza limite (solo il limite generale di richieste).',
    },
    adaptiveLearning: {
      label: 'Apprendi da ogni identificazione sicura',
      on: 'Apprende solo da identificazioni con verifica di vivacità e ampio margine di affidabilità (altra luce, fotocamera, acconciatura o barba).',
      off: 'Ogni dipendente viene confrontato solo con i campioni della sua registrazione approvata.',
    },
    detectImpossibleTravel: {
      label: 'Rileva i viaggi impossibili',
      on: 'Viene rifiutata una registrazione troppo lontana dalla precedente per il tempo trascorso (posizione falsa o account condiviso).',
      off: 'La posizione di una registrazione non viene confrontata con quella precedente.',
    },
    qrEnabled: {
      label: 'Verifica con codice QR',
      on: 'I dipendenti mostrano sul telefono un QR dinamico: cambia da solo e ogni codice vale una sola volta.',
      off: 'Solo riconoscimento facciale.',
    },
    validatorDeviceApproval: {
      label: 'Autorizza i dispositivi dei validatori',
      on: 'Ogni tablet o telefono di un validatore resta da autorizzare in Validatori › Dispositivi.',
      off: 'I validatori possono accedere da qualsiasi dispositivo con la loro e-mail e la loro password.',
    },
    qrOnlyAttendance: {
      label: 'Presenza con il solo QR',
      on: "Un validatore in modalità QR registra l'entrata e l'uscita con il codice, senza volto.",
      off: 'Con il solo QR ci si identifica; per registrare la presenza serve il volto.',
    },
    riskEngine: {
      label: 'Motore di rischio',
      on: 'Ogni tentativo viene valutato in base ai suoi segnali e si decide secondo il livello di rischio (regolalo qui sotto).',
      off: 'Decidono solo le barriere; i segnali non si sommano.',
    },
    flashPaced: {
      label: 'Lampo dettato dal server',
      on: 'Ogni colore viene rivelato al momento: nessuno può preparare le acquisizioni.',
      off: 'I colori vengono inviati con la sfida.',
    },
    captureBurst: {
      label: 'Raffica di ritagli del volto',
      on: 'Vengono inviati alcuni secondi di ritagli per misurare il movimento naturale e la continuità.',
      off: 'Vengono inviate solo le acquisizioni singole.',
    },
    fraudEvidence: {
      label: 'Conserva le prove dei tentativi sospetti',
      on: 'Vengono conservati alcuni fotogrammi cifrati di ogni tentativo sospetto per esaminare il caso; si cancellano da soli alla scadenza.',
      off: 'I casi si aprono senza fotogrammi: solo con ciò che è stato misurato.',
    },
    voiceVerification: {
      label: 'Verifica vocale e video alla registrazione',
      on: 'Dopo le foto, il dipendente risponde in video a tre domande sui suoi dati; voce e volto vengono confrontati sul server e l\'azienda rivede il video.',
      off: 'La registrazione termina con le foto.',
    },
    voiceGuidance: {
      label: 'Guida vocale',
      on: 'Le indicazioni della registrazione vengono lette ad alta voce sul dispositivo.',
      off: 'La registrazione non legge le indicazioni ad alta voce.',
    },
    validatorMobileOnly: {
      label: 'Validatori solo da tablet o telefono',
      on: 'I validatori accedono solo da tablet e telefoni.',
      off: 'I validatori possono operare anche da un computer con fotocamera.',
    },
  },
  warnings: {
    spoofing: "Questo riduce la protezione contro la contraffazione dell'identità (foto, schermi o video).",
    impossibleTravel: 'Una registrazione con una posizione falsa o da un altro luogo non verrà rilevata in base alla distanza.',
    deviceApproval: "Chiunque abbia l'e-mail e la password di un validatore potrà operare da qualsiasi dispositivo.",
    mobileOnly: 'I validatori potranno operare dai computer, la cui fotocamera di solito è più facile da ingannare con foto o schermi.',
    qrOnly: 'Chi ha il telefono di un altro dipendente potrà registrarne la presenza senza mostrare il volto.',
    riskEngine: 'I segnali smetteranno di sommarsi: un tentativo con vari indizi di inganno passerà se nessuna barriera lo ferma da sola.',
    captureProtocol: 'Un video preparato in anticipo sarà più difficile da rilevare.',
    voiceVerification: 'Una registrazione con le foto di un\'altra persona non avrà più la seconda verifica di voce e volto in video.',
  },
  toggle: {
    eyebrow: 'Criteri di verifica',
    eyebrowSecurity: 'Protezione consigliata',
    activateTitle: 'Attivare «{label}»?',
    deactivateTitle: 'Disattivare «{label}»?',
    on: 'Attivato',
    off: 'Disattivato',
    activate: 'Attiva',
    deactivate: 'Disattiva',
    activated: '{label}: attivato',
    deactivated: '{label}: disattivato',
  },
  voice: {
    title: 'Guida vocale',
    hint: 'Legge ad alta voce le indicazioni della registrazione del volto, con la sintesi vocale del dispositivo.',
    profile: {
      label: 'Voce della guida',
      description: 'Voce con cui vengono lette le indicazioni durante la registrazione.',
      saved: 'Voce della guida aggiornata',
      savedText: 'Le indicazioni saranno lette con la voce «{name}».',
      confirmTitle: 'Usare la voce «{value}»?',
      confirmLabel: 'Salva voce',
    },
    preview: 'Prova voce',
  },
  tuning,
  ...antifraud,
} satisfies Translation<typeof es>;
