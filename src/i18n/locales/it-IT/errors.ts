import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/errors';

/** Textos de los errores que arma el cliente en italiano (it-IT). */
export default {
  status: {
    network: 'Impossibile connettersi al server. Controlla la connessione.',
    ok: 'Fatto',
    badRequest: 'Richiesta non valida',
    unauthorized: 'La sessione non è più valida. Accedi di nuovo.',
    forbidden: "Non hai l'autorizzazione per questa azione",
    notFound: 'Non trovato',
    methodNotAllowed: 'Azione non consentita',
    timeout: 'Il server non ha risposto in tempo. Riprova.',
    conflict: 'Conflitto con dati esistenti',
    payloadTooLarge: 'Il file è troppo grande',
    unsupportedMedia: 'Formato non supportato',
    unprocessable: 'Dati non validi',
    rateLimited: 'Troppi tentativi. Attendi qualche secondo.',
    server: 'Si è verificato un errore imprevisto. Riprova.',
    unavailable: 'Servizio non disponibile. Riprova tra qualche secondo.',
  },
  invalidResponse: 'Risposta imprevista dal server. Riprova.',
  unexpected: 'Si è verificato un errore imprevisto',
  unexpectedRetry: 'Si è verificato un errore imprevisto. Riprova.',
  titles: {
    network: 'Nessuna connessione al server',
    unauthorized: "Impossibile verificare l'accesso",
    forbidden: 'Azione non consentita',
    notFound: 'Non trovato',
    timeout: 'Nessuna risposta dal server',
    conflict: 'Le informazioni esistono già',
    payloadTooLarge: 'Il file è troppo grande',
    unprocessable: 'Controlla i dati',
    rateLimited: 'Troppi tentativi',
    server: 'Errore del server',
    failed: "Impossibile completare l'operazione",
    generic: 'Si è verificato un problema',
  },
} satisfies Translation<typeof es>;
