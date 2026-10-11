import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/auth';

/** Textos de inicio de sesión, cuenta recordada, dispositivo, empresa suspendida y cierre de sesión en italiano (it-IT). */
export default {
  layout: {
    copyright: '© {year} {app}. Tutti i diritti riservati.',
  },
  login: {
    title: 'Accedi',
    emailPlaceholder: 'nome@azienda.it',
    password: 'Password',
    passwordRequired: 'La password è obbligatoria',
    remembered: 'Account ricordato su questo dispositivo.',
    useOtherAccount: 'Usa un altro account',
    remember: 'Ricorda il mio account',
    rememberHint: 'Mantieni la sessione aperta su questo dispositivo. Non usarla su dispositivi condivisi.',
    submit: 'Accedi',
    submitDisabled: 'Inserisci la tua e-mail e la tua password',
    locating: 'Verifica della tua posizione…',
    failed: 'Impossibile accedere',
    switchFailed: 'Impossibile cambiare account',
    sessionEnded: 'La tua sessione è terminata',
  },
  session: {
    expired: 'La tua sessione è scaduta. Accedi di nuovo.',
  },
  password: {
    new: 'Nuova password',
    hint: 'Minimo 12 caratteri, con maiuscola, minuscola e numero',
  },
  mfa: {
    eyebrow: 'Secondo fattore',
    title: 'Accedi con la tua chiave di accesso',
    step: 'Usa il pulsante «Accedi con chiave di accesso».',
  },
  locked: {
    eyebrow: 'Account bloccato',
    title: 'Troppi tentativi',
    wait: 'Attendi {value} prima di riprovare.',
    passkey: 'Con una chiave di accesso puoi accedere ora.',
  },
  device: {
    eyebrow: 'Dispositivo',
    unsupported: 'Impossibile registrare il dispositivo',
    titles: {
      DEVICE_PENDING_APPROVAL: 'Dispositivo da autorizzare',
      DEVICE_REJECTED: 'Dispositivo non autorizzato',
      DEVICE_REVOKED: 'Autorizzazione revocata',
      DEVICE_PROOF_INVALID: 'Impossibile verificare il dispositivo',
    },
    pendingSteps: {
      ask: 'Chiedi a un amministratore della tua azienda di aprire Validatori › Dispositivi.',
      authorize: 'Deve autorizzare questo dispositivo (compare con il nome di questo browser).',
      retry: 'Accedi di nuovo da qui.',
    },
  },
  deviceBlock: {
    eyebrow: 'Stai usando un computer',
    title: 'Continua da un tablet o da un telefono',
    footnote: "Ti serve aiuto? Contatta l'amministratore della tua azienda.",
  },
  suspension: {
    badge: 'Accesso sospeso',
    title: 'La tua azienda è sospesa',
    footnote: "Per riattivarla, contatta l'amministratore della piattaforma.",
    exit: "Torna all'accesso",
  },
  logout: {
    title: 'Vuoi uscire?',
    thisDevice: 'Questo dispositivo',
    lastLogin: 'Ultimo accesso',
    stay: 'Resta qui',
    everywhere: 'Esci da tutti i miei dispositivi',
    everywhereFailed: 'Impossibile uscire da tutti i dispositivi',
    consequence: {
      EMPLOYEE: 'Dovrai accedere di nuovo per identificarti o mostrare il tuo codice QR.',
      VALIDATOR: 'Questo punto di controllo smetterà di identificare il personale finché qualcuno non accederà di nuovo su questo dispositivo.',
      COMPANY: 'Il tuo lavoro è salvato. Dovrai accedere di nuovo per gestire la tua azienda.',
      ADMIN: 'Il tuo lavoro è salvato. Dovrai accedere di nuovo per gestire la piattaforma.',
    },
  },
  companySelect: {
    title: 'Scegli la tua azienda',
    intro_one: "Lavori in {count} azienda con l'account {email}.",
    intro_other: "Lavori in {count} aziende con l'account {email}.",
    companyInactive: 'Azienda disattivata',
    accessInactive: 'Il tuo accesso è disattivato',
    current: 'Azienda attuale · {note}',
    entering: 'Accesso in corso',
    enterFailed: 'Impossibile entrare in {company}',
  },
} satisfies Translation<typeof es>;
