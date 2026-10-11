import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/auth';

/** Textos de inicio de sesión, cuenta recordada, dispositivo, empresa suspendida y cierre de sesión en inglés (en-US): las mismas llaves que es-MX. */
export default {
  layout: {
    copyright: '© {year} {app}. All rights reserved.',
  },
  login: {
    title: 'Sign in',
    emailPlaceholder: 'you@company.com',
    password: 'Password',
    passwordRequired: 'Password is required',
    remembered: 'Account remembered on this device.',
    useOtherAccount: 'Use another account',
    remember: 'Remember my account',
    rememberHint: 'Keep the session open on this device. Do not use it on shared computers.',
    submit: 'Sign in',
    submitDisabled: 'Enter your email and password',
    locating: 'Verifying your location…',
    failed: "Couldn't sign in",
    switchFailed: "Couldn't switch accounts",
    sessionEnded: 'Your session ended',
  },
  session: {
    expired: 'Your session expired. Sign in again.',
  },
  password: {
    new: 'New password',
    hint: 'At least 12 characters, with an uppercase letter, a lowercase letter, and a number',
  },
  mfa: {
    eyebrow: 'Two-factor',
    title: 'Sign in with your passkey',
    step: 'Use the "Sign in with passkey" button.',
  },
  locked: {
    eyebrow: 'Account locked',
    title: 'Too many attempts',
    wait: 'Wait {value} before trying again.',
    passkey: 'With a passkey you can sign in now.',
  },
  device: {
    eyebrow: 'Device',
    unsupported: "Couldn't register the device",
    titles: {
      DEVICE_PENDING_APPROVAL: 'Device pending approval',
      DEVICE_REJECTED: 'Device not authorized',
      DEVICE_REVOKED: 'Authorization revoked',
      DEVICE_PROOF_INVALID: "Couldn't verify the device",
    },
    pendingSteps: {
      ask: 'Ask an administrator at your company to go to Validators › Devices.',
      authorize: "Have them authorize this device (it appears with this browser's name).",
      retry: 'Sign in again right here.',
    },
  },
  deviceBlock: {
    eyebrow: 'You are using a computer',
    title: 'Continue on a tablet or phone',
    footnote: "Need help? Contact your company's administrator.",
  },
  suspension: {
    badge: 'Access suspended',
    title: 'Your company is suspended',
    footnote: 'To reactivate it, contact the platform administrator.',
    exit: 'Back to sign in',
  },
  logout: {
    title: 'Sign out?',
    thisDevice: 'This device',
    lastLogin: 'Last sign-in',
    stay: 'Stay here',
    everywhere: 'Sign out of all my devices',
    everywhereFailed: "Couldn't sign out of all devices",
    consequence: {
      EMPLOYEE: "You'll need to sign in again to identify yourself or show your QR code.",
      VALIDATOR: 'This checkpoint will stop identifying staff until someone signs in again on this device.',
      COMPANY: "Your work is saved. You'll need to sign in again to manage your company.",
      ADMIN: "Your work is saved. You'll need to sign in again to manage the platform.",
    },
  },
  companySelect: {
    title: 'Choose your company',
    intro_one: 'You work at {count} company with the account {email}.',
    intro_other: 'You work at {count} companies with the account {email}.',
    companyInactive: 'Company deactivated',
    accessInactive: 'Your access is deactivated',
    current: 'Current company · {note}',
    entering: 'Opening',
    enterFailed: "Couldn't open {company}",
  },
} satisfies Translation<typeof es>;
