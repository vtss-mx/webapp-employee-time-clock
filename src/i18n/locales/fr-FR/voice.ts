import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/voice';

/** Voice and video check of the face enrollment (VoiceVerificationFlow). */
export default {
  title: 'Vérification vocale',
  stage: 'Question {current} sur {total}',
  intro: 'Répondez à voix haute à chaque question en regardant la caméra. La vidéo et le son sont enregistrés.',
  answerNow: 'Répondez maintenant',
  recording: 'Enregistrement',
  start: 'Répondre',
  stop: 'Terminé',
  sending: 'Vérification de votre réponse…',
  retry: 'Répétez la réponse',
  attemptsLeft_one: '{count} essai restant',
  attemptsLeft_other: '{count} essais restants',
  micLevel: 'Niveau du microphone',
  micDenied: 'L\'accès au microphone est bloqué. Autorisez-le dans votre navigateur pour continuer.',
  unsupported: 'Votre navigateur ne peut pas enregistrer de vidéo avec du son. Ouvrez l\'application dans une version à jour de Chrome, Safari, Edge ou Firefox.',
  tooShort: 'L\'enregistrement est trop court. Dites votre réponse complète.',
  seconds: '{seconds} s',
} satisfies Translation<typeof es>;
