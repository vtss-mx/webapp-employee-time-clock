import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/policy';
import antifraud from './policy/antifraud';
import tuning from './policy/tuning';

/** Textos de política de verificación y ajustes de la prueba de vida de una empresa en inglés (en-US): las mismas llaves que es-MX. */
export default {
  /** Control retirado por decisión del dueño del producto (2026-10-06): se muestra apagado y sin cambios. */
  retired: 'Turned off by product decision (2026-10-06).',
  loadError: "Couldn't load the verification policy",
  title: 'Identity verification policy',
  saveError: "Couldn't save",
  recommended: 'Recommended',
  appliesTo: 'Applies within seconds to all {company} staff.',
  confidence: {
    title: 'Confidence level',
    intro: 'Minimum probability that the person in front of the camera is the enrolled employee.',
    identifyIntro: '{lead} (validators): you can require more, since searching among many raises false matches. It never applies below the previous level.',
    identifyLead: 'When identifying among all employees',
    identifyLabel: 'Confidence level to identify among all employees',
    saved: 'Confidence level updated',
    savedText: '{value} will be required for each face verification.',
    identifySaved: 'Identification confidence updated',
    identifySavedText: 'Validators will require {value} when identifying among all employees.',
  },
  sections: {
    face: {
      title: 'Face requirements',
      hint: 'What the person must remove before scanning. Covering the face lowers accuracy.',
    },
    security: {
      title: 'Security',
      hint: 'Protections against identity spoofing; keeping them on is recommended.',
    },
    locks: {
      title: 'Anti-spoofing locks',
      hint: 'Each lock blocks a different way to fool face recognition; keeping them all on is recommended.',
    },
    learning: {
      title: 'Continuous learning',
      hint: 'Each secure identification teaches how each employee looks today. Samples validated by the company are never replaced.',
    },
    location: {
      title: 'Attendance location',
      hint: "Each attendance record carries the phone's location and the server's time; adjust accuracy and speed below.",
    },
    methods: {
      title: 'Identification methods',
      hint: 'Ways employees can identify themselves.',
    },
    antifraud: {
      title: 'Anti-fraud',
      hint: 'When in doubt, the engine asks for one more step or leaves the record for the company to review. Evidence of suspicious attempts is visible only to the admin in “Fraud cases.”',
    },
    capture: {
      title: 'Capture protocol',
      hint: 'Real-time checks against injected video. For now they only measure.',
    },
    devices: {
      title: 'Validator devices',
      hint: 'Only validators have restrictions; employees and admins can use any device.',
    },
  },
  accessories: {
    remove: 'Remove {phrase}',
    blockGlasses: {
      on: 'People will be asked to take off glasses (including sunglasses).',
      off: 'People can identify themselves wearing glasses.',
    },
    blockHeadwear: {
      on: 'People will be asked to take off caps, hats, and visors (except employees exempt for religious or medical reasons).',
      off: 'People can identify themselves wearing headwear.',
    },
    blockMask: {
      on: 'People will be asked to take off face masks (physical check of nose and cheeks).',
      off: 'People can identify themselves wearing a face mask (lower accuracy).',
    },
  },
  options: {
    livenessChallenge: {
      label: 'Liveness check',
      on: 'The person makes random head moves.',
      off: 'No head-move challenge.',
    },
    antiSpoofing: {
      label: 'Anti-spoofing',
      on: 'Detects printed photos, screens, and videos in front of the camera.',
      off: 'Photos and screens are not analyzed.',
    },
    blockVirtualCameras: {
      label: 'Block virtual cameras',
      on: 'Programs posing as a camera (OBS, ManyCam…) are rejected.',
      off: 'Any camera is accepted, including virtual ones.',
    },
    rejectForeignImages: {
      label: 'Live captures only',
      on: 'Gallery or edited images are rejected.',
      off: 'Gallery or edited images are accepted.',
    },
    detectStaticCaptures: {
      label: 'Detect still photos',
      on: 'An attempt is rejected if its captures are identical (one photo sent several times).',
      off: 'Captures are not compared with each other.',
    },
    detectReplays: {
      label: 'Detect reused captures',
      on: 'Each capture works only once: resending saved or intercepted captures is rejected.',
      off: 'Received captures are not remembered.',
    },
    checkCaptureContinuity: {
      label: 'Require a single take',
      on: 'All captures must come from the same camera, with the face and lighting continuous while turning.',
      off: 'The camera, framing, and lighting are not compared between captures.',
    },
    enforceHumanTiming: {
      label: 'Human timing in the liveness check',
      on: 'Challenge responses faster than a person can manage are rejected (automated programs).',
      off: 'Response time to the challenge is not measured.',
    },
    detectDuplicateFaces: {
      label: 'Detect duplicate faces',
      on: 'When enrolling a face already approved for another employee: it is flagged for review or, in person, blocked.',
      off: 'The enrollment is not compared with other employees.',
    },
    lockoutEnabled: {
      label: 'Lockout after failed attempts',
      on: 'After several consecutive failed or suspicious attempts, it locks temporarily (adjust it below).',
      off: 'Unlimited attempts (only the general request limit).',
    },
    adaptiveLearning: {
      label: 'Learn from each secure identification',
      on: 'Learns only from identifications with a liveness check and ample confidence (new lighting, camera, hairstyle, or beard).',
      off: 'Each employee is compared only with the samples from their approved enrollment.',
    },
    detectImpossibleTravel: {
      label: 'Detect impossible travel',
      on: 'A record too far from the previous one for the time elapsed is rejected (fake location or shared account).',
      off: 'A record’s location is not compared with the previous one.',
    },
    qrEnabled: {
      label: 'QR code verification',
      on: 'Employees show a dynamic QR code on their phone: it changes on its own and each code works only once.',
      off: 'Face recognition only.',
    },
    validatorDeviceApproval: {
      label: 'Approve validator devices',
      on: 'Each validator tablet or phone must be approved in Validators › Devices.',
      off: 'Validators can sign in on any device with their email and password.',
    },
    qrOnlyAttendance: {
      label: 'Attendance with the QR code alone',
      on: 'A validator in QR mode records check-in and check-out with the code, without a face.',
      off: 'The QR code alone only identifies; recording attendance requires the face.',
    },
    riskEngine: {
      label: 'Risk engine',
      on: 'Each attempt is scored with its signals and decided by its risk level (adjust it below).',
      off: 'Only the locks decide; signals aren’t added up.',
    },
    flashPaced: {
      label: 'Server-paced flash',
      on: 'Each color is revealed live, so captures can’t be prepared in advance.',
      off: 'Colors are sent with the challenge.',
    },
    captureBurst: {
      label: 'Burst of face crops',
      on: 'A few seconds of crops are sent to measure natural motion and continuity.',
      off: 'Only single captures are sent.',
    },
    fraudEvidence: {
      label: 'Keep evidence of suspicious attempts',
      on: 'A few encrypted frames of each suspicious attempt are kept to review the case; they’re deleted automatically when they expire.',
      off: 'Cases open without frames: only with what was measured.',
    },
    voiceVerification: {
      label: 'Voice and video check at enrollment',
      on: 'After the photos, the employee answers three questions about their data on video; voice and face are compared on the server and the company reviews the video.',
      off: 'Enrollment ends with the photos.',
    },
    voiceGuidance: {
      label: 'Voice guidance',
      on: 'Enrollment prompts are read aloud on the device.',
      off: "The enrollment doesn't read the prompts aloud.",
    },
    validatorMobileOnly: {
      label: 'Validators on tablet or phone only',
      on: 'Validators sign in only on tablets and phones.',
      off: 'Validators can also operate from a computer with a camera.',
    },
  },
  warnings: {
    spoofing: 'This reduces protection against identity spoofing (photos, screens, or videos).',
    impossibleTravel: "A record with a fake location or from another place won't be detected by distance.",
    deviceApproval: "Anyone with a validator's email and password will be able to operate from any device.",
    mobileOnly: 'Validators will be able to operate from computers, whose cameras are usually easier to fool with photos or screens.',
    qrOnly: 'Anyone holding another employee’s phone will be able to record their attendance without showing a face.',
    riskEngine: 'Signals will no longer add up: an attempt with several signs of spoofing will pass if no single lock stops it.',
    captureProtocol: 'Video prepared in advance will be harder to detect.',
    voiceVerification: 'An enrollment with someone else\'s photos will no longer get the second voice-and-face check on video.',
  },
  toggle: {
    eyebrow: 'Verification policy',
    eyebrowSecurity: 'Recommended protection',
    activateTitle: 'Turn on “{label}”?',
    deactivateTitle: 'Turn off “{label}”?',
    on: 'On',
    off: 'Off',
    activate: 'Turn on',
    deactivate: 'Turn off',
    activated: '{label}: on',
    deactivated: '{label}: off',
  },
  voice: {
    title: 'Voice guidance',
    hint: 'Reads the face enrollment prompts aloud, using the device’s own speech synthesis.',
    profile: {
      label: 'Guidance voice',
      description: 'Voice that reads the prompts during enrollment.',
      saved: 'Guidance voice updated',
      savedText: 'Prompts will be read with the “{name}” voice.',
      confirmTitle: 'Use the “{value}” voice?',
      confirmLabel: 'Save voice',
    },
    preview: 'Test voice',
  },
  tuning,
  ...antifraud,
} satisfies Translation<typeof es>;
