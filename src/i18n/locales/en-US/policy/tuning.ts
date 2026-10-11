import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/policy/tuning';

/** Ajustes de los candados de la política y su confirmación en inglés (en-US): las mismas llaves que es-MX. */
export default {
  title: 'Lock settings',
  hint: 'Stricter settings protect more but may ask people to retake the capture more often.',
  confirmTitle: 'Change “{label}” to {value}?',
  relaxes: 'This value offers less protection against identity spoofing.',
  confirmLabel: 'Save setting',
  antiSpoofing: {
    label: 'Anti-spoofing sensitivity',
    description: 'How strict it is when detecting photos, screens, and videos.',
    saved: 'Anti-spoofing: {level} level',
  },
  steps: {
    label: 'Liveness check moves',
    description: 'Random head moves (turn, look up or down, move closer).',
    one: 'One random move (faster, less secure).',
    two: 'Two random moves: a recorded video would have to match the sequence.',
    three: 'Three random moves: the hardest to fool, even for a generated video.',
    option_one: '{count} move',
    option_other: '{count} moves',
    saved: 'Liveness check updated',
    savedText_one: '{count} random head move will be requested.',
    savedText_other: '{count} random head moves will be requested.',
  },
  timeout: {
    label: 'Liveness check time',
    description: 'For the liveness moves; if it runs out, a new challenge is requested without repeating the scan.',
    saved: 'Liveness check time updated',
    savedText: 'Each challenge will expire after {time}.',
  },
  hold: {
    label: 'Time to hold each move',
    description: 'How long each move must be held before capturing; a bit longer avoids rejection at the end.',
    saved: 'Hold time updated',
    savedText: 'Each move is held {time} before capturing.',
  },
  retries: {
    label: 'Challenge retries',
    description: 'How many times a new challenge is requested, without repeating the scan, before restarting it.',
    saved: 'Challenge retries updated',
    savedText: 'Retries allowed before restarting: {count}.',
  },
  flash: {
    label: 'Color flash',
    retired: 'Turned off by product decision (2026-10-06): the screen no longer flashes colors. The movements, the burst, and the voice check cover the liveness test.',
  },
  quality: {
    label: 'Minimum capture quality',
    description: 'Dark or blurry captures compare poorly and make tricks easier; higher means more retries in bad light.',
    none: 'No minimum',
    basic: 'Basic',
    medium: 'Medium',
    high: 'High',
    saved: 'Minimum quality updated',
    savedText: 'Captures with quality below “{level}” will be rejected.',
    savedAny: 'Any capture that passes the basic checks is accepted.',
  },
  lockoutSaved: 'Lockout updated',
  lockoutFailures: {
    label: 'Attempts before lockout',
    description: 'Consecutive failed or suspicious attempts that temporarily lock face verification.',
    option_one: '{count} attempt',
    option_other: '{count} attempts',
    savedText_one: 'It will lock after {count} failed attempt.',
    savedText_other: 'It will lock after {count} consecutive failed attempts.',
  },
  lockoutMinutes: {
    label: 'Lockout duration',
    description: 'How long the person (or the validator) must wait before trying again.',
    savedText: 'The lockout will last {time}.',
  },
  qrLifetime: {
    label: 'QR code lifetime',
    description: "Each employee QR code renews on its own when this time is up and works only once. Less time, more secure.",
    saved: 'QR lifetime updated',
    savedText: 'Each QR code will last {time} and work only once.',
  },
  accuracy: {
    label: 'Location accuracy',
    description: 'Maximum margin the phone can report; stricter may require turning on precise location.',
    option: 'Up to {distance}',
    saved: 'Accuracy updated',
    savedText: 'Records with a location margin over {distance} will need to be retaken.',
  },
  speed: {
    label: 'Maximum credible speed',
    description: 'Between two consecutive records; anything faster is rejected as impossible travel.',
    saved: 'Speed updated',
    savedText: 'Records that require traveling faster than {speed} since the previous one will be rejected.',
  },
} satisfies Translation<typeof es>;
