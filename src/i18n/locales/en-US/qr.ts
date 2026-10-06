import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/qr';

/** Textos de QR dinámico del empleado y lector de QR en inglés (en-US): las mismas llaves que es-MX. */
export default {
  dynamic: {
    used: {
      title: 'Code used',
      text: 'Generating a new one…',
    },
    replaced: {
      title: 'Code replaced',
      text: 'Another one was generated on a different device, or your company invalidated it.',
      action: 'Show a new code',
    },
    paused: {
      title: 'Paused',
      text: 'It expired while you were away.',
      action: 'Show code',
    },
    error: "Couldn't generate your code",
    imageError: "Couldn't display your QR code",
    enlarge: 'Enlarge QR code',
    renewsIn: 'Renews in {seconds}',
    seconds: '{value} s',
  },
  scan: {
    aim: 'Point the camera at the QR code',
    busy: 'QR detected. Verifying…',
    invalid: 'Invalid QR. Use the code generated for your account',
    noPersonalData: 'The code contains no personal data.',
  },
  panel: {
    title: 'Dynamic QR code',
    errorTitle: "Couldn't load the QR activity",
    live: 'On screen',
    none: 'No active code',
    intro: "The employee generates it on their phone (My QR code). It changes every {seconds} s and works only once: it can't be downloaded or printed.",
    liveUntil: 'Valid until',
    lastIssued: 'Last generated',
    lastUsed: 'Last used',
    never: 'Never',
    revoke: {
      action: 'Invalidate active code',
      eyebrow: 'QR code',
      title: 'Invalidate the active code?',
      message: "The employee's on-screen code will stop working immediately. They can show a new one on their phone.",
      confirm: 'Invalidate',
      error: "Couldn't invalidate the code",
      done: 'Code invalidated',
      doneText: 'The employee can show a new one on their phone.',
    },
  },
  phoneGuide: {
    open: 'Open the tablet or phone.',
    openHow: 'Use the browser (Safari, Chrome…) or the camera.',
    scanOrType: '{scan} or type this address:',
    scanCode: 'Scan the code',
    copyAddress: 'Copy address',
    enterAddress: '{address} your company gave you.',
    accessAddress: 'Go to the access address',
    signIn: '{action} with the same email and password.',
    signInAction: 'Sign in',
    scan: 'Scan it with the tablet or phone',
    qrAlt: 'QR code to open the app. Scan it with the tablet or phone',
    desktopSite: 'Already on a tablet or phone? Turn off {option} in your browser menu and try again.',
    desktopSiteOption: '“Desktop site”',
  },
} satisfies Translation<typeof es>;
