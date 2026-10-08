import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/voice';

/** Voice and video check of the face enrollment (VoiceVerificationFlow). */
export default {
  title: 'Sprachprüfung',
  stage: 'Frage {current} von {total}',
  intro: 'Beantworten Sie jede Frage laut und blicken Sie dabei in die Kamera. Video und Ton werden aufgezeichnet.',
  answerNow: 'Antworten Sie jetzt',
  recording: 'Aufnahme',
  start: 'Antworten',
  stop: 'Fertig',
  sending: 'Ihre Antwort wird geprüft …',
  retry: 'Wiederholen Sie die Antwort',
  attemptsLeft_one: '{count} Versuch übrig',
  attemptsLeft_other: '{count} Versuche übrig',
  micLevel: 'Mikrofonpegel',
  micDenied: 'Der Mikrofonzugriff ist blockiert. Erlauben Sie ihn im Browser, um fortzufahren.',
  unsupported: 'Ihr Browser kann kein Video mit Ton aufzeichnen. Öffnen Sie die Anwendung in einem aktuellen Chrome, Safari, Edge oder Firefox.',
  tooShort: 'Die Aufnahme war zu kurz. Sagen Sie Ihre vollständige Antwort.',
  seconds: '{seconds} s',
} satisfies Translation<typeof es>;
