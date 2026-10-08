import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/policy/tuning';

/** Ajustes de los candados de la política y su confirmación en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  title: 'Regolazioni delle barriere',
  hint: "Più rigoroso protegge di più, ma può chiedere di ripetere l'acquisizione più spesso.",
  confirmTitle: 'Cambiare «{label}» in {value}?',
  relaxes: "Questo valore protegge meno dalla contraffazione dell'identità.",
  confirmLabel: 'Salva la regolazione',
  antiSpoofing: {
    label: 'Sensibilità del rilevamento della contraffazione',
    description: 'Quanto è rigoroso nel rilevare foto, schermi e video.',
    saved: 'Rilevamento della contraffazione: livello {level}',
  },
  steps: {
    label: 'Movimenti della verifica di vivacità',
    description: 'Movimenti casuali della testa (girarsi, guardare in alto o in basso, avvicinarsi).',
    one: 'Un movimento casuale (più rapido, meno sicuro).',
    two: 'Due movimenti casuali: un video registrato dovrebbe indovinare la sequenza.',
    three: 'Tre movimenti casuali: il più difficile da ingannare, anche per un video generato.',
    option_one: '{count} movimento',
    option_other: '{count} movimenti',
    saved: 'Verifica di vivacità aggiornata',
    savedText_one: 'Verrà richiesto {count} movimento casuale della testa.',
    savedText_other: 'Verranno richiesti {count} movimenti casuali della testa.',
  },
  timeout: {
    label: 'Tempo per la verifica di vivacità',
    description: "Per i movimenti della verifica di vivacità; se scade, viene chiesta un'altra sfida senza ripetere la scansione.",
    saved: 'Tempo della verifica di vivacità aggiornato',
    savedText: 'Ogni sfida scadrà dopo {time}.',
  },
  flash: {
    label: 'Lampo di colori',
    retired: 'Disattivato per decisione di prodotto (2026-10-06): lo schermo non lampeggia più a colori. I movimenti, la raffica e la verifica vocale coprono la verifica di vivacità.',
  },
  quality: {
    label: "Qualità minima dell'acquisizione",
    description: 'Le acquisizioni scure o sfocate si confrontano male e facilitano gli inganni; più alta, più nuovi tentativi con poca luce.',
    none: 'Nessun minimo',
    basic: 'Di base',
    medium: 'Media',
    high: 'Alta',
    saved: 'Qualità minima aggiornata',
    savedText: 'Verranno rifiutate le acquisizioni con qualità inferiore a «{level}».',
    savedAny: 'Viene accettata qualsiasi acquisizione che superi i controlli di base.',
  },
  lockoutSaved: 'Blocco aggiornato',
  lockoutFailures: {
    label: 'Tentativi prima del blocco',
    description: 'Tentativi falliti o sospetti consecutivi che bloccano temporaneamente la verifica del volto.',
    option_one: '{count} tentativo',
    option_other: '{count} tentativi',
    savedText_one: 'Si bloccherà dopo {count} tentativo fallito.',
    savedText_other: 'Si bloccherà dopo {count} tentativi falliti consecutivi.',
  },
  lockoutMinutes: {
    label: 'Durata del blocco',
    description: 'Tempo che la persona (o il validatore) deve attendere prima di riprovare.',
    savedText: 'Il blocco durerà {time}.',
  },
  qrLifetime: {
    label: 'Validità del codice QR',
    description: 'Ogni QR del dipendente si rinnova da solo allo scadere di questo tempo e vale una sola volta. Meno tempo, più sicurezza.',
    saved: 'Validità del QR aggiornata',
    savedText: 'Ogni codice QR durerà {time} e varrà una sola volta.',
  },
  accuracy: {
    label: 'Precisione della posizione',
    description: 'Margine massimo che può indicare il telefono; più rigoroso può chiedere di attivare la posizione esatta.',
    option: 'Fino a {distance}',
    saved: 'Precisione aggiornata',
    savedText: 'Verrà chiesto di ripetere la registrazione se la posizione ha un margine superiore a {distance}.',
  },
  speed: {
    label: 'Velocità massima credibile',
    description: 'Tra due registrazioni consecutive; ciò che richiederebbe di andare più veloce viene rifiutato come viaggio impossibile.',
    saved: 'Velocità aggiornata',
    savedText: 'Verranno rifiutate le registrazioni che richiederebbero di viaggiare a più di {speed} dalla precedente.',
  },
} satisfies Translation<typeof es>;
