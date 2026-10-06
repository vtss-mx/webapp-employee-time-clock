import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/devices';

/** An employee's devices (antifraud 1b, decision D2) in English (en-US): the same keys as es-MX. */
export default {
  title: 'Devices',
  intro:
    "Browsers and phones they used to check in or verify their identity, each with a key that can't be copied. Depending on the policy, an unapproved one asks for one more step or sends their records to review.",
  mineTitle: 'My devices',
  mineIntro: 'The browsers or phones you used to check in or verify your identity. Your company can approve or revoke them.',
  empty: {
    title: 'No devices',
    description: 'Browsers and phones used to check in will appear here.',
  },
  noun: {
    one: 'device',
    other: 'devices',
  },
  firstSeen: 'First used: {date}',
  lastSeen: 'last used: {date}',
  uses_one: '{count} use',
  uses_other: '{count} uses',
  steppedUp: 'passed one more step on {date}',
  reviewedBy: 'Decided by {name}',
  loadError: "Couldn't load the devices",
  error: "Couldn't update the device",
  eyebrow: "Employee's device",
  actionLabel: '{action}: {name}',
  approve: {
    label: 'Approve',
    title: 'Approve “{name}”?',
    message: 'Its records will no longer go to review or ask for one more step because of the device. The rest of the risk engine stays the same.',
  },
  revoke: {
    label: 'Revoke',
    title: 'Revoke “{name}”?',
    message: 'It will be treated as an unknown device again: depending on the policy, its records will ask for one more step or go to review.',
  },
} satisfies Translation<typeof es>;
