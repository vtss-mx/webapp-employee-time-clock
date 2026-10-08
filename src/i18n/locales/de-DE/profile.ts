import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/profile';

/** Textos de Mi perfil: cuenta, idioma, contraseña y sesiones en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  title: 'Mein Profil',
  subtitle: 'Ihr Konto, Ihr Passwort und aktive Sitzungen',
  refreshFailed: 'Ihre Informationen konnten nicht aktualisiert werden',
  account: {
    title: 'Konto',
    lastLogin: 'Letzte Anmeldung',
    createdAt: 'Konto erstellt',
  },
  language: {
    title: 'Sprache',
  },
  photo: {
    title: 'Profilfoto',
    description:
      'Es kennzeichnet Sie im Menü, in Ihrem Profil und in den Listen Ihres Unternehmens. Es wird verschlüsselt und ohne Positions- und Kameradaten gespeichert.',
    saveAsk: {
      eyebrow: 'Ihr Profilfoto',
      titleNew: 'Dieses Profilfoto speichern?',
      titleReplace: 'Profilfoto ändern?',
      message: 'So wird es in Ihrem Profil, im Menü und in den Listen Ihres Unternehmens angezeigt.',
      file: 'Datei',
      note: 'Vor dem Speichern werden Positions- und Kameradaten entfernt.',
      replaceNote: 'Ihr bisheriges Foto wird gelöscht. Vor dem Speichern des neuen werden Positions- und Kameradaten entfernt.',
      confirm: 'Foto speichern',
    },
    removeAsk: {
      eyebrow: 'Ihr Profilfoto',
      title: 'Profilfoto entfernen?',
      message: 'Stattdessen werden Ihre Initialen angezeigt.',
      note: 'Das Foto wird gelöscht und kann nicht wiederhergestellt werden.',
      confirm: 'Foto entfernen',
    },
    saveFailed: 'Ihr Foto konnte nicht gespeichert werden',
    removeFailed: 'Ihr Foto konnte nicht entfernt werden',
  },
  password: {
    title: 'Passwort ändern',
    current: 'Aktuelles Passwort',
    new: 'Neues Passwort',
    confirm: 'Neues Passwort bestätigen',
    submit: 'Passwort aktualisieren',
    submitDisabled: 'Füllen Sie alle Pflichtfelder korrekt aus',
    currentRequired: 'Geben Sie Ihr aktuelles Passwort ein',
    mustDiffer: 'Muss sich vom aktuellen unterscheiden',
    failed: 'Das Passwort konnte nicht geändert werden',
    changed: 'Passwort aktualisiert',
    revoked_zero: 'Ihre aktuelle Sitzung bleibt aktiv.',
    revoked_one: 'Sie wurden auf {count} weiteren Gerät abgemeldet.',
    revoked_other: 'Sie wurden auf {count} weiteren Geräten abgemeldet.',
    ask: {
      eyebrow: 'Sicherheit Ihres Kontos',
      title: 'Passwort ändern?',
      message: 'Ab jetzt melden Sie sich mit dem neuen Passwort an.',
      otherDevices: 'Sie werden auf Ihren anderen Geräten abgemeldet.',
      thisDevice: 'Auf diesem Gerät bleiben Sie angemeldet.',
      confirm: 'Passwort ändern',
    },
  },
  sessions: {
    title: 'Aktive Sitzungen',
    loadFailed: 'Ihre Sitzungen konnten nicht geladen werden',
    empty: {
      title: 'Keine offenen Sitzungen',
      description: 'Hier sehen Sie die Geräte, auf denen Sie angemeldet sind.',
    },
    noun: {
      one: 'Sitzung',
      other: 'Sitzungen',
    },
    thisDevice: 'Dieses Gerät',
    unknownIp: 'Unbekannte IP',
    activity: '{ip} · Aktiv {ago} · Begonnen {started}',
    hint: 'Sie erkennen ein Gerät nicht? Melden Sie es ab und ändern Sie Ihr Passwort.',
    revokeAll: 'Auf allen Geräten abmelden',
    revoke: {
      eyebrow: 'Aktive Sitzung',
      title: 'Sitzung auf {device} beenden?',
      message: 'Dieses Gerät muss sich erneut anmelden, um Ihr Konto zu verwenden.',
      ip: 'IP',
      unknown: 'Unbekannt',
      started: 'Begonnen',
      failed: 'Die Sitzung konnte nicht beendet werden',
      done: 'Sitzung beendet',
      doneText: 'Dieses Gerät muss sich erneut anmelden.',
    },
    revokeAllAsk: {
      eyebrow: 'Alle Ihre Sitzungen',
      title: 'Auf allen Ihren Geräten abmelden?',
      message: 'Einschließlich dieses Geräts: Sie müssen sich erneut anmelden.',
      confirm: 'Alle abmelden',
      failed: 'Die Abmeldung auf allen Geräten ist fehlgeschlagen',
    },
  },
} satisfies Translation<typeof es>;
