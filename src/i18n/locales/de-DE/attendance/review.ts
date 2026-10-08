import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/attendance/review';

/** Registros "en revisión" en alemán (de-DE): las mismas llaves que es-MX. El registro de asistencia es la «Zeitbuchung». */
export default {
  label: 'Prüfung',
  inReview: 'In Prüfung',
  pendingHint: 'Ihr Unternehmen muss sie bestätigen.',
  reasons: 'Gründe: {reasons}',
  note: 'Anmerkung des Unternehmens: {note}',
  decidedAt: 'Entschieden am {date}',
  intro: 'Bei der Aufnahme oder der Position war nicht alles ganz zuverlässig. Prüfen Sie die Nachweise und bestätigen oder lehnen Sie die Zeitbuchung ab.',
  eyebrow: 'Zeitbuchung in Prüfung',
  confirm: 'Zeitbuchung bestätigen',
  confirmTitle: 'Zeitbuchung von {name} bestätigen?',
  confirmMessage: 'Sie gilt dann als gültig. Der Mitarbeiter sieht sie in seinem Verlauf als bestätigt.',
  confirmError: 'Die Zeitbuchung konnte nicht bestätigt werden',
  reject: 'Ablehnen',
  onlyPending: 'Nur in Prüfung',
  onlyPendingHint: 'Arbeitstage zum Bestätigen oder Ablehnen.',
  rejectPage: {
    title: 'Zeitbuchung ablehnen',
    intro: 'Der Arbeitstag wird nicht gelöscht: Er wird als abgelehnt markiert und Sie können ihn korrigieren. Der Mitarbeiter sieht Ihre Anmerkung.',
    label: 'Anmerkung für den Mitarbeiter',
    placeholder: 'Warum die Zeitbuchung nicht akzeptiert wird',
    required: 'Schreiben Sie die Anmerkung (mindestens 3 Zeichen). Der Mitarbeiter sieht sie.',
    confirmTitle: 'Zeitbuchung von {name} ablehnen?',
    confirmMessage: 'Sie wird als abgelehnt markiert; der Mitarbeiter sieht die Anmerkung in seinem Verlauf.',
    decided: 'Über diese Zeitbuchung wurde bereits entschieden',
    error: 'Die Zeitbuchung konnte nicht abgelehnt werden',
    done: 'Zeitbuchung abgelehnt',
    doneText: '{name} sieht Ihre Anmerkung im Verlauf.',
  },
} satisfies Translation<typeof es>;
