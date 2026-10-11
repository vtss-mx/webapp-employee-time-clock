import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/consents';

/** Textos del consentimiento biométrico en alemán de Alemania (de-DE, trato de «Sie»): las mismas llaves que es-MX. */
export default {
  title: 'Biometrische Daten',
  intro: 'Ihre Einwilligung, Ihr Gesicht und Ihre Stimme bei der Prüfung Ihrer Identität zu verwenden.',
  loadError: 'Ihre Einwilligung konnte nicht geladen werden',
  granted: 'Erteilt',
  pending: 'Nicht erteilt',
  askedBy: 'Ihr Unternehmen verlangt sie',
  grantedOn: 'Erteilt am {date}',
  revokedOn: 'Widerrufen am {date}',
  version: 'Version {version}',
  read: 'Lesen und erteilen',
  review: 'Text ansehen',
  revoke: 'Widerrufen',
  back: 'Zurück zu Mein Profil',
  backToEnrollment: 'Zurück zu Ihrer Registrierung',
  pageTitle: 'Biometrische Einwilligung',
  pageSubtitle: 'Lesen Sie den vollständigen Text und entscheiden Sie, ob Sie sie erteilen',
  grant: 'Meine Einwilligung erteilen',
  empty: {
    title: 'Keine Einwilligungen',
    description: 'Hier sehen Sie, was Ihr Unternehmen von Ihnen verlangt.',
  },
  onlyEmployees: {
    title: 'Nur für Mitarbeiter',
    description: 'Ihr Konto speichert keine biometrischen Daten.',
  },
  grantAsk: {
    eyebrow: 'Ihre Einwilligung',
    title: 'Einwilligung erteilen?',
    message: 'Sie bestätigen, den vollständigen Text gelesen zu haben, und willigen in das Beschriebene ein.',
    note: 'Sie können sie jederzeit unter Mein Profil widerrufen.',
    confirm: 'Erteilen',
  },
  grantFailed: 'Ihre Einwilligung konnte nicht erteilt werden',
  grantedTitle: 'Einwilligung erteilt',
  revokeAsk: {
    eyebrow: 'Ihre Einwilligung',
    title: 'Biometrische Einwilligung widerrufen?',
    message: 'Ihr Gesicht, Ihre Fotos und Ihre Stimme werden sofort gelöscht und Ihre Gesichtsregistrierung besteht nicht mehr.',
    note: 'Dies kann nicht rückgängig gemacht werden. Ihr Unternehmen muss Ihre Identität dann anders prüfen.',
    confirm: 'Widerrufen',
  },
  revokeFailed: 'Ihre Einwilligung konnte nicht widerrufen werden',
  revokedTitle: 'Einwilligung widerrufen',
  revokedText: 'Ihre biometrischen Daten wurden gelöscht.',
  missingTitle: 'Ihre Einwilligung fehlt',
  inPersonTitle: 'Einwilligung von {name} fehlt',
  inPersonText: 'Die Einwilligung muss unter Mein Profil erteilt werden, bevor das Gesicht registriert wird.',
} satisfies Translation<typeof es>;
