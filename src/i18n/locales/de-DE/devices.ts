import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/devices';

/** Dispositivos de un empleado (antifraude 1b, decisión D2) en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  title: 'Geräte',
  intro:
    'Browser und Telefone, mit denen gestempelt oder die Identität verifiziert wurde, jeweils mit einem Schlüssel, der sich nicht kopieren lässt. Je nach Richtlinie verlangt ein nicht freigegebenes Gerät einen zusätzlichen Schritt oder setzt die Zeitbuchungen in Prüfung.',
  mineTitle: 'Meine Geräte',
  mineIntro:
    'Die Browser oder Telefone, mit denen Sie Ihre Anwesenheit erfasst oder Ihre Identität verifiziert haben. Ihr Unternehmen kann sie freigeben oder widerrufen.',
  empty: {
    title: 'Keine Geräte',
    description: 'Hier sehen Sie die Browser und Telefone, mit denen gestempelt wurde.',
  },
  noun: {
    one: 'Gerät',
    other: 'Geräte',
  },
  firstSeen: 'Erste Nutzung: {date}',
  lastSeen: 'letzte Nutzung: {date}',
  uses_one: '{count} Nutzung',
  uses_other: '{count} Nutzungen',
  steppedUp: 'zusätzlichen Schritt am {date} bestanden',
  reviewedBy: 'Entschieden von {name}',
  loadError: 'Die Geräte konnten nicht geladen werden',
  error: 'Das Gerät konnte nicht aktualisiert werden',
  eyebrow: 'Gerät des Mitarbeiters',
  actionLabel: '{action}: {name}',
  approve: {
    label: 'Freigeben',
    title: '„{name}“ freigeben?',
    message:
      'Seine Zeitbuchungen kommen wegen des Geräts nicht mehr in Prüfung und verlangen keinen zusätzlichen Schritt mehr. Die übrige Risikobewertung bleibt unverändert.',
  },
  revoke: {
    label: 'Widerrufen',
    title: '„{name}“ widerrufen?',
    message:
      'Es wird wieder als unbekanntes Gerät behandelt: Je nach Richtlinie verlangen seine Zeitbuchungen einen zusätzlichen Schritt oder kommen in Prüfung.',
  },
} satisfies Translation<typeof es>;
