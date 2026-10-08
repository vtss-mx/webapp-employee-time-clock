import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/checkpoint';

/** Textos de punto de control del validador en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  errorTitle: 'Impossibile caricare il punto di controllo',
  question: 'Scegli come identificare la prossima persona.',
  start: 'Inizia',
  footer: 'Vengono identificati solo i dipendenti attivi di {company} · Ogni tentativo viene registrato',
  notIdentified: 'Dipendente non identificato',
  failed: 'Impossibile identificare',
  invalidQr: "QR non valido. Chiedi al dipendente di mostrare il suo codice dall'applicazione",
  qrDisabled: {
    title: 'Identificazione con QR disattivata',
    text: 'Questo validatore usa la modalità «{mode}», ma la tua azienda ha disattivato il QR. Chiedi a un amministratore di attivarlo o di cambiare la modalità.',
  },
  face: {
    title: 'Riconosci il volto',
    submitting: 'Identificazione…',
    useQr: 'Usa il suo codice QR',
  },
  qr: {
    title: 'Scansiona il QR',
    text: 'Inquadra con la fotocamera il QR sul telefono del dipendente. Viene letto automaticamente e vale una sola volta.',
    busy: 'QR rilevato. Identificazione…',
  },
  qrFace: {
    qrTitle: 'Passo 1 di 2 · Codice QR',
    qrText: 'Scansiona il QR sul telefono del dipendente. Poi verrà confermato il suo volto.',
    busy: 'QR rilevato. Ricerca del dipendente…',
    faceTitle: 'Passo 2 di 2 · {name}',
  },
  recent: {
    title: 'Ultime identificazioni',
    errorTitle: 'Impossibile caricare le identificazioni recenti',
    emptyTitle: 'Nessuna identificazione',
    emptyDescription: 'Qui vedrai chi identifica questo dispositivo.',
    nounOne: 'identificazione',
    nounOther: 'identificazioni',
    identified: 'Identificato',
    notIdentified: 'Non identificato',
  },
} satisfies Translation<typeof es>;
