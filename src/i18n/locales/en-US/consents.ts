import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/consents';

/** Textos del consentimiento biométrico en inglés (en-US): las mismas llaves que es-MX. */
export default {
  title: 'Biometric data',
  intro: 'Your consent to use your face and voice when your identity is verified.',
  loadError: "Couldn't load your consent",
  granted: 'Granted',
  pending: 'Not granted',
  askedBy: 'Your company requires it',
  grantedOn: 'Granted on {date}',
  revokedOn: 'Revoked on {date}',
  version: 'Version {version}',
  read: 'Read and grant',
  review: 'View the text',
  revoke: 'Revoke',
  back: 'Back to My profile',
  backToEnrollment: 'Back to your enrollment',
  pageTitle: 'Biometric consent',
  pageSubtitle: 'Read the full text and decide whether to grant it',
  grant: 'Grant my consent',
  empty: {
    title: 'No consents',
    description: 'Anything your company asks you to authorize will appear here.',
  },
  onlyEmployees: {
    title: 'Employees only',
    description: 'Your account stores no biometric data.',
  },
  grantAsk: {
    eyebrow: 'Your consent',
    title: 'Grant your consent?',
    message: 'You confirm that you read the full text and authorize what it says.',
    note: 'You can revoke it at any time from My profile.',
    confirm: 'Grant',
  },
  grantFailed: "Couldn't grant your consent",
  grantedTitle: 'Consent granted',
  revokeAsk: {
    eyebrow: 'Your consent',
    title: 'Revoke your biometric consent?',
    message: 'Your face, your photos and your voice are deleted immediately and your face enrollment no longer exists.',
    note: "This can't be undone. Your company will have to verify your identity another way.",
    confirm: 'Revoke',
  },
  revokeFailed: "Couldn't revoke your consent",
  revokedTitle: 'Consent revoked',
  revokedText: 'Your biometric data was deleted.',
  missingTitle: 'Your consent is missing',
  inPersonTitle: 'Consent missing for {name}',
  inPersonText: 'It must be granted from My profile before the face enrollment.',
} satisfies Translation<typeof es>;
