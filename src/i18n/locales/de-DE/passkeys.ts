import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/passkeys';

/**
 * Zugangsschlüssel (WebAuthn) auf Deutsch (de-DE): dieselben Schlüssel wie es-MX. Glossar §2: „Zugangsschlüssel“
 * (das deutsche Wörterbuch kennt „Passkey“ nicht und das englische schon: es darf nicht in die Liste).
 */
export default {
  title: 'Zugangsschlüssel',
  intro: 'Melden Sie sich mit Gesicht, Fingerabdruck oder PIN Ihres Geräts an, ohne Ihr Passwort einzugeben. Der private Schlüssel verlässt nie Ihr Gerät oder Ihr Apple- oder Google-Konto.',
  unsupported: 'Dieser Browser unterstützt keine Zugangsschlüssel. Verwenden Sie einen aktuellen Safari, Chrome oder Edge.',
  loadError: 'Ihre Zugangsschlüssel konnten nicht geladen werden',
  add: 'Zugangsschlüssel hinzufügen',
  empty: {
    title: 'Keine Zugangsschlüssel',
    description: 'Fügen Sie einen hinzu, um sich mit Gesicht, Fingerabdruck oder PIN anzumelden.',
  },
  noun: {
    one: 'Zugangsschlüssel',
    other: 'Zugangsschlüssel',
  },
  created: 'Erstellt am {date}',
  lastUsed: 'Zuletzt verwendet: {date}',
  neverUsed: 'Noch nicht verwendet',
  synced: 'Über Ihr Konto synchronisiert',
  deviceOnly: 'Nur auf einem Gerät',
  rename: 'Umbenennen',
  revoke: 'Widerrufen',
  actionLabel: '{action}: {name}',
  revokeAsk: {
    eyebrow: 'Zugangsschlüssel',
    title: '„{name}“ widerrufen?',
    message: 'Mit diesem Schlüssel können Sie sich auf keinem Ihrer Geräte mehr anmelden.',
    note: 'Dies kann nicht rückgängig gemacht werden. Sie können jederzeit einen neuen registrieren.',
    confirm: 'Schlüssel widerrufen',
  },
  revoked: 'Zugangsschlüssel widerrufen',
  revokeFailed: 'Der Zugangsschlüssel konnte nicht widerrufen werden',
  form: {
    newTitle: 'Zugangsschlüssel hinzufügen',
    newSubtitle: 'Registrieren Sie dieses Gerät, um sich ohne Passwort anzumelden.',
    renameTitle: 'Zugangsschlüssel umbenennen',
    renameSubtitle: 'Ändern Sie den Namen, an dem Sie ihn erkennen.',
    section: 'Name des Schlüssels',
    intro: 'Bei der Registrierung fragt Ihr Gerät nach Gesicht, Fingerabdruck oder PIN. Ihr Passwort funktioniert weiterhin.',
    name: 'Name',
    nameHint: 'Zum Wiedererkennen: „Mein Telefon“, „Arbeitscomputer“',
    nameRequired: 'Geben Sie einen Namen ein',
    nameTooLong: 'Höchstens {max} Zeichen',
    submit: 'Schlüssel registrieren',
    renameSubmit: 'Namen speichern',
    back: 'Zurück zu Mein Profil',
    createAsk: {
      eyebrow: 'Zugangsschlüssel',
      title: 'Einen Zugangsschlüssel auf diesem Gerät registrieren?',
      message: 'Ihr Gerät fragt nach Gesicht, Fingerabdruck oder PIN, um ihn zu erstellen.',
      note: 'Sie können ihn jederzeit unter Mein Profil widerrufen.',
      confirm: 'Registrieren',
    },
    renameAsk: {
      title: 'Den Zugangsschlüssel umbenennen?',
    },
    registered: 'Zugangsschlüssel registriert',
    registeredText: 'Sie können sich jetzt damit auf der Anmeldeseite anmelden.',
    registerFailed: 'Der Zugangsschlüssel konnte nicht registriert werden',
    renamed: 'Name gespeichert',
    renameFailed: 'Der Zugangsschlüssel konnte nicht umbenannt werden',
    noChanges: 'Keine Änderungen',
  },
  errors: {
    unsupported: 'Dieser Browser unterstützt keine Zugangsschlüssel. Verwenden Sie einen aktuellen Safari, Chrome oder Edge.',
    failed: 'Ihr Gerät konnte den Vorgang nicht abschließen. Versuchen Sie es erneut.',
  },
  login: {
    divider: 'oder',
    button: 'Mit Zugangsschlüssel anmelden',
    waiting: 'Warten auf Ihr Gerät…',
    failed: 'Die Anmeldung mit dem Zugangsschlüssel ist fehlgeschlagen',
  },
} as const satisfies Translation<typeof es>;
