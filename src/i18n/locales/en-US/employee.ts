import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/employee';

/** Textos de pantallas del empleado (verificación, registro facial, mi QR) en inglés (en-US): las mismas llaves que es-MX. */
export default {
  menu: {
    eyebrow: 'Identification',
    hello: 'Hi, {name}',
    helloAnonymous: 'Hi',
    question: 'How would you like to identify yourself?',
    face: 'VERIFY WITH FACE',
    faceLiveness: 'Face recognition with a liveness check',
    faceOnly: 'Face recognition',
    start: 'Start',
    qr: 'SHOW MY QR',
    qrText: 'Show it to the validator: it changes every {seconds} s and works only once',
    show: 'Show',
    footer: 'Identity validated by your company · Secure connection',
  },
  verify: {
    title: 'Face verification',
    submitting: 'Verifying your identity…',
    failed: "Couldn't verify your identity",
    showQr: 'Show my QR code',
  },
  enrollment: {
    title: 'Face enrollment',
    tips: {
      light: 'Find a well-lit place.',
      front: 'Look straight at the camera with your face uncovered.',
    },
    rejected: {
      title: 'Your previous enrollment was rejected',
      reason: 'Reason: “{reason}”.',
      noReason: "Your company couldn't validate your identity with the captures sent.",
    },
    reverify: {
      title: 'Verify your identity again',
      eyebrow: 'Request from your company',
      step: 'Enroll your face with a liveness check; it takes about a minute.',
    },
    confirm: {
      title: 'Enroll your face?',
      message: 'The camera will open to capture your face with a liveness check. When you finish, your company will validate your identity.',
      replaces: 'Your previous enrollment will be replaced by this one.',
      open: 'Open camera',
    },
    submitting: 'Sending your enrollment…',
    sent: {
      title: 'Enrollment sent',
      text: 'Your company will validate your identity shortly.',
      offline: "Your company will validate your identity shortly. The screen will update when you're back online.",
    },
    fatal: "Couldn't complete the enrollment",
    duration_one: '{count} step · 1 minute',
    duration_other: '{count} steps · 1 minute',
    again: 'Enroll your face again',
    welcome: 'Welcome, {name}',
    intro: 'To protect your identity, enroll your face. You only do it once, and your company will validate it.',
    after: {
      title: 'Next: validation by your company',
      text: "Your company reviews and approves your identity; you'll see the result in the app.",
    },
    before: 'Before you start:',
    privacy: "Only encrypted data is stored; it's never shared.",
    start: 'Start enrollment',
  },
  myQr: {
    errorTitle: "Couldn't generate your QR code",
    alt: 'QR code for {name}',
    eyebrow: 'Digital badge',
    title: 'My QR code',
    intro: 'Show it to the validator to identify yourself. It changes every {seconds} s and works only once.',
    validated: 'Identity validated',
    employeeNumber: 'Employee no. {number}',
    enlarge: 'Show full screen',
    another: 'Generate another',
    brightness: 'Turn up your screen brightness so it scans faster.',
    singleUse: "Each code works only once and expires in seconds: a photo or screenshot won't work. It contains none of your personal or biometric data.",
    brightnessLarge: 'Turn up the brightness so it scans instantly.',
  },
  pending: {
    errorTitle: "Couldn't update the status",
    title: 'Your identity is being validated',
    text: "{name}, your face enrollment was sent. An administrator at your company will review it; you'll see here when it's approved.",
    sent: {
      title: 'Face enrollment sent',
      text: 'Face, liveness check, and quality verified.',
    },
    review: {
      title: 'Validation by your company',
      text: "An administrator confirms it's you.",
    },
    access: {
      title: 'Access enabled',
      text: "You'll be able to identify yourself with your face or your QR code.",
    },
    refresh: 'Refresh status',
    auto: 'This screen updates automatically.',
  },
} satisfies Translation<typeof es>;
