import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/voice';

/** Voice and video check of the face enrollment (VoiceVerificationFlow). */
export default {
  title: 'Voice check',
  stage: 'Question {current} of {total}',
  intro: 'Answer each question out loud while looking at the camera. Video and audio are recorded.',
  answerNow: 'Answer now',
  recording: 'Recording',
  start: 'Answer',
  stop: 'Done',
  sending: 'Checking your answer…',
  retry: 'Answer again',
  attemptsLeft_one: '{count} try left',
  attemptsLeft_other: '{count} tries left',
  micLevel: 'Microphone level',
  micDenied: 'Microphone access is blocked. Allow it in your browser to continue.',
  unsupported: 'Your browser can\'t record video with audio. Open the app in an up-to-date Chrome, Safari, Edge, or Firefox.',
  tooShort: 'The recording was too short. Say your full answer.',
  seconds: '{seconds} s',
} satisfies Translation<typeof es>;
