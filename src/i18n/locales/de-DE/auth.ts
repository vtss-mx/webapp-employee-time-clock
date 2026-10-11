import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/auth';

/** Textos de inicio de sesión, cuenta recordada, dispositivo, empresa suspendida y cierre de sesión en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  layout: {
    copyright: '© {year} {app}. Alle Rechte vorbehalten.',
  },
  login: {
    title: 'Anmelden',
    emailPlaceholder: 'name@unternehmen.de',
    password: 'Passwort',
    passwordRequired: 'Das Passwort ist erforderlich',
    remembered: 'Konto auf diesem Gerät gespeichert.',
    useOtherAccount: 'Anderes Konto verwenden',
    remember: 'Konto merken',
    rememberHint: 'Sie bleiben auf diesem Gerät angemeldet. Nicht auf gemeinsam genutzten Geräten verwenden.',
    submit: 'Anmelden',
    submitDisabled: 'Geben Sie Ihre E-Mail-Adresse und Ihr Passwort ein',
    locating: 'Ihre Position wird geprüft…',
    failed: 'Anmeldung fehlgeschlagen',
    switchFailed: 'Das Konto konnte nicht gewechselt werden',
    sessionEnded: 'Ihre Sitzung wurde beendet',
  },
  session: {
    expired: 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an.',
  },
  password: {
    new: 'Neues Passwort',
    hint: 'Mindestens 12 Zeichen mit Groß- und Kleinbuchstaben und einer Ziffer',
  },
  mfa: {
    eyebrow: 'Zweiter Faktor',
    title: 'Melden Sie sich mit Ihrem Zugangsschlüssel an',
    step: 'Verwenden Sie die Schaltfläche „Mit Zugangsschlüssel anmelden“.',
  },
  locked: {
    eyebrow: 'Konto gesperrt',
    title: 'Zu viele Versuche',
    wait: 'Warten Sie {value}, bevor Sie es erneut versuchen.',
    passkey: 'Mit einem Zugangsschlüssel können Sie sich jetzt anmelden.',
  },
  device: {
    eyebrow: 'Gerät',
    unsupported: 'Das Gerät konnte nicht registriert werden',
    titles: {
      DEVICE_PENDING_APPROVAL: 'Gerät wartet auf Freigabe',
      DEVICE_REJECTED: 'Gerät nicht freigegeben',
      DEVICE_REVOKED: 'Freigabe widerrufen',
      DEVICE_PROOF_INVALID: 'Das Gerät konnte nicht verifiziert werden',
    },
    pendingSteps: {
      ask: 'Bitten Sie einen Administrator Ihres Unternehmens, Prüfgeräte › Geräte zu öffnen.',
      authorize: 'Dort muss dieses Gerät freigegeben werden (es erscheint mit dem Namen dieses Browsers).',
      retry: 'Melden Sie sich anschließend hier erneut an.',
    },
  },
  deviceBlock: {
    eyebrow: 'Sie verwenden einen Computer',
    title: 'Fahren Sie auf einem Tabletcomputer oder Telefon fort',
    footnote: 'Brauchen Sie Hilfe? Wenden Sie sich an den Administrator Ihres Unternehmens.',
  },
  suspension: {
    badge: 'Zugang gesperrt',
    title: 'Ihr Unternehmen ist gesperrt',
    footnote: 'Wenden Sie sich zur Reaktivierung an den Administrator der Plattform.',
    exit: 'Zurück zur Anmeldung',
  },
  logout: {
    title: 'Abmelden?',
    thisDevice: 'Dieses Gerät',
    lastLogin: 'Letzte Anmeldung',
    stay: 'Angemeldet bleiben',
    everywhere: 'Von allen meinen Geräten abmelden',
    everywhereFailed: 'Die Abmeldung auf allen Geräten ist fehlgeschlagen',
    consequence: {
      EMPLOYEE: 'Sie müssen sich erneut anmelden, um sich zu identifizieren oder Ihren QR-Code anzuzeigen.',
      VALIDATOR: 'Dieser Kontrollpunkt identifiziert keine Mitarbeiter mehr, bis sich jemand auf diesem Gerät erneut anmeldet.',
      COMPANY: 'Ihre Arbeit ist gespeichert. Sie müssen sich erneut anmelden, um Ihr Unternehmen zu verwalten.',
      ADMIN: 'Ihre Arbeit ist gespeichert. Sie müssen sich erneut anmelden, um die Plattform zu verwalten.',
    },
  },
  companySelect: {
    title: 'Unternehmen auswählen',
    intro_one: 'Sie arbeiten mit dem Konto {email} für {count} Unternehmen.',
    intro_other: 'Sie arbeiten mit dem Konto {email} für {count} Unternehmen.',
    companyInactive: 'Unternehmen deaktiviert',
    accessInactive: 'Ihr Zugang ist deaktiviert',
    current: 'Aktuelles Unternehmen · {note}',
    entering: 'Wird geöffnet',
    enterFailed: '{company} konnte nicht geöffnet werden',
  },
} satisfies Translation<typeof es>;
