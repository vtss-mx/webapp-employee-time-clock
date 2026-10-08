import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/voice';

/** Voice and video check of the face enrollment (VoiceVerificationFlow). */
export default {
  title: 'Verifica vocale',
  stage: 'Domanda {current} di {total}',
  intro: 'Rispondi ad alta voce a ogni domanda guardando la fotocamera. Si registrano video e audio.',
  answerNow: 'Rispondi ora',
  recording: 'Registrazione',
  start: 'Rispondi',
  stop: 'Fatto',
  sending: 'Verifica della risposta…',
  retry: 'Ripeti la risposta',
  attemptsLeft_one: '{count} tentativo rimasto',
  attemptsLeft_other: '{count} tentativi rimasti',
  micLevel: 'Livello del microfono',
  micDenied: 'L\'accesso al microfono è bloccato. Consentilo nel browser per continuare.',
  unsupported: 'Il tuo browser non può registrare video con audio. Apri l\'applicazione in una versione aggiornata di Chrome, Safari, Edge o Firefox.',
  tooShort: 'La registrazione è troppo breve. Pronuncia la tua risposta completa.',
  seconds: '{seconds} s',
} satisfies Translation<typeof es>;
