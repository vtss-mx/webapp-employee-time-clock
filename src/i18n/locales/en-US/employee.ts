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
      replaces: 'Your previous enrollment will be replaced by this one.',
      replacesPhoto: 'Your previous first photo will be replaced by this one.',
      open: 'Open camera',
      photo: {
        title: 'Take your first photo?',
        message: "The camera will open to take a photo of your face, looking straight ahead. It's stored encrypted for your enrollment.",
      },
      captures: {
        title: 'Start the captures?',
        message: 'The camera will open to take {count} captures of your face and do the liveness check.',
      },
      video: {
        title: 'Record the video?',
        message_one: 'The camera and microphone will open so you can answer {count} question on video.',
        message_other: 'The camera and microphone will open so you can answer {count} questions on video.',
      },
    },
    submitting: 'Sending your enrollment…',
    sent: {
      title: 'Enrollment sent',
      text: 'Your company will validate your identity shortly.',
      offline: "Your company will validate your identity shortly. The screen will update when you're back online.",
    },
    fatal: "Couldn't complete the enrollment",
    again: 'Enroll your face again',
    welcome: 'Welcome, {name}',
    intro: 'To protect your identity, enroll your face. You only do it once, and your company will validate it.',
    after: {
      title: 'Next: validation by your company',
      text: "Your company reviews and approves your identity; you'll see the result in the app.",
    },
    before: 'Before you start:',
    privacy: 'Your photos, video, and voice are stored encrypted and reviewed only by your company; they are never shared.',
    /** El indicador sobre el visor: los pasos los manda el servidor y su nombre sale del catálogo; «Listo» es el final. */
    steps: {
      label: 'Step {current} of {total}',
      done: 'Done',
    },
    /** Mientras se guarda la foto inicial. */
    photoSaving: 'Saving your photo…',
    /** El índice del registro: estado, aviso y botón de cada paso (su nombre y descripción, del catálogo). */
    index: {
      steps_one: '{count} step',
      steps_other: '{count} steps',
      resume: 'Do them in order. You can leave after any step and continue another day: your progress is saved.',
      errorTitle: "Couldn't load your enrollment",
      label: 'Your enrollment steps',
      state: {
        pending: 'Pending',
        done: 'Completed · {date}',
        complete: 'Completed',
        locked: 'Locked',
        expired: 'Expired',
        exhausted: 'Out of tries',
        answered: '{answered} of {total} answered',
      },
      hint: {
        /** `step`: el nombre del paso que falta, del catálogo. */
        blocked: 'Complete “{step}” first.',
        validUntil: 'Valid until {date}',
        expired: 'Your photo expired. Take it again.',
        exhausted: 'You ran out of tries. Repeat the first photo and the captures.',
        unknown: 'Update the application to continue with this step.',
      },
      action: {
        photo: 'Take photo',
        retakePhoto: 'Retake photo',
        captures: 'Start captures',
        video: 'Record video',
        resumeVideo: 'Continue video',
        document: 'Upload document',
        replaceDocument: 'Replace document',
      },
    },
    /** La pantalla de un paso que ahora no se puede abrir: qué pasa (su vacío) y de vuelta al índice. */
    blocked: {
      back: 'Back to enrollment',
      blocked: {
        title: 'A step comes first',
        text: 'Complete “{step}” to continue with this step.',
      },
      done: {
        title: 'Step completed',
        text: 'It is already done. Continue with the next step.',
      },
      disabled: {
        title: 'Step not requested',
        text: 'Your company does not require this enrollment step.',
      },
      exhausted: {
        title: 'Out of tries',
        text: 'Repeat the first photo and the captures to try again.',
      },
      unknown: {
        title: 'Step unavailable',
        text: 'Update the application to continue with this step.',
      },
    },
    /** Un 409 del servidor: el paso ya no toca (lo bloquea otro o la empresa dejó de pedirlo). */
    stepGone: 'This step is no longer available',
    /** Un paso que se cumple con un documento de identidad: cómo va. */
    document: {
      pending: 'Your document is still missing.',
      done: 'Document received · {date}',
      doneNoDate: 'Document received.',
    },
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
    unavailable: {
      qrTitle: 'QR unavailable',
      faceTitle: 'Face enrollment pending',
    },
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
