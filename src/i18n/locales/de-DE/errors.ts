import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/errors';

/** Textos de los errores que arma el cliente en alemán (de-DE). */
export default {
  status: {
    network: 'Die Verbindung zum Server konnte nicht hergestellt werden. Prüfen Sie Ihre Verbindung.',
    ok: 'Erledigt',
    badRequest: 'Ungültige Anfrage',
    unauthorized: 'Ihre Sitzung ist nicht mehr gültig. Melden Sie sich erneut an.',
    forbidden: 'Sie haben keine Berechtigung für diese Aktion',
    notFound: 'Nicht gefunden',
    methodNotAllowed: 'Aktion nicht erlaubt',
    timeout: 'Der Server hat nicht rechtzeitig geantwortet. Versuchen Sie es erneut.',
    conflict: 'Konflikt mit vorhandenen Daten',
    payloadTooLarge: 'Die Datei ist zu groß',
    unsupportedMedia: 'Format nicht unterstützt',
    unprocessable: 'Ungültige Daten',
    rateLimited: 'Zu viele Versuche. Warten Sie einige Sekunden.',
    server: 'Ein unerwarteter Fehler ist aufgetreten. Versuchen Sie es erneut.',
    unavailable: 'Dienst nicht verfügbar. Versuchen Sie es in einigen Sekunden erneut.',
  },
  invalidResponse: 'Unerwartete Antwort des Servers. Versuchen Sie es erneut.',
  unexpected: 'Ein unerwarteter Fehler ist aufgetreten',
  unexpectedRetry: 'Ein unerwarteter Fehler ist aufgetreten. Versuchen Sie es erneut.',
  titles: {
    network: 'Keine Verbindung zum Server',
    unauthorized: 'Ihr Zugang konnte nicht bestätigt werden',
    forbidden: 'Aktion nicht erlaubt',
    notFound: 'Nicht gefunden',
    timeout: 'Keine Antwort vom Server',
    conflict: 'Diese Angaben existieren bereits',
    payloadTooLarge: 'Die Datei ist zu groß',
    unprocessable: 'Angaben prüfen',
    rateLimited: 'Zu viele Versuche',
    server: 'Serverfehler',
    failed: 'Der Vorgang konnte nicht abgeschlossen werden',
    generic: 'Ein Problem ist aufgetreten',
  },
} satisfies Translation<typeof es>;
