import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/shifts/assign';

/** Textos de asignar un turno y del historial de turnos de un empleado en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  title: 'Schicht zuweisen',
  appliesFrom: 'Gültig ab',
  prepareError: 'Die Zuweisung konnte nicht vorbereitet werden',
  error: 'Die Schicht konnte nicht zugewiesen werden',
  errors: {
    shiftRequired: 'Wählen Sie die Schicht',
    dateRequired: 'Wählen Sie das Datum, ab dem sie gilt',
    fromTomorrow: 'Wählen Sie ein Datum ab morgen: Ein Schichtwechsel wird einen Tag im Voraus geplant.',
    notPast: 'Die Schicht kann nicht an einem vergangenen Datum beginnen.',
  },
  hints: {
    hasShift: 'Hat bereits eine Schicht: Der Wechsel gilt frühestens ab morgen, und die aktuelle Schicht endet am Vortag.',
    firstShift: 'Die erste Schicht kann heute beginnen.',
    scheduled: 'Ein Wechsel zu {shift} ab dem {date} ist bereits geplant: Wählen Sie ein späteres Datum oder stornieren Sie ihn im Verlauf.',
  },
  confirm: {
    eyebrowChange: 'Schichtwechsel',
    title: '{employee} die Schicht {shift} zuweisen?',
    note: 'Die aktuelle Schicht endet am Vortag; bereits Erfasstes behält seine Schicht.',
  },
  done: {
    title: 'Schicht zugewiesen',
    text: '{employee} hat ab dem {date} die Schicht {shift}.',
    endsBefore: 'Die aktuelle Schicht endet am Vortag.',
    keepsRecords: 'Bereits Erfasstes behält seine Schicht.',
  },
  bulk: {
    title: 'Mehreren Mitarbeitern zuweisen',
    subtitle: 'Dieselbe Schicht und dasselbe Startdatum für mehrere Mitarbeiter.',
    dateHint:
      'Wer bereits eine Schicht hat, wechselt frühestens ab morgen; wählen Sie heute, erhält diese Person keine Zuweisung. Die aktuelle Schicht endet am Vortag.',
    employees: 'Mitarbeiter',
    employeesLabel: 'Mitarbeiter, denen die Schicht zugewiesen wird',
    employeesHint: 'Wer diese Zuweisung bereits hat, bleibt unverändert; inaktive Mitarbeiter erhalten keine Zuweisung.',
    employeesRequired: 'Wählen Sie mindestens einen Mitarbeiter',
    submit_one: 'An {count} Mitarbeiter zuweisen',
    submit_other: 'An {count} Mitarbeiter zuweisen',
    confirmTitle_one: 'Schicht {shift} an {count} Mitarbeiter zuweisen?',
    confirmTitle_other: 'Schicht {shift} an {count} Mitarbeiter zuweisen?',
    confirmMessage: 'Wer sie bereits hat, bleibt unverändert, und inaktive Mitarbeiter erhalten keine Zuweisung. Das Ergebnis zeigt, wem sie zugewiesen wurde.',
    confirmNote: 'Wer bereits eine Schicht hat, wechselt ab dem gewählten Datum; die aktuelle Schicht endet am Vortag.',
    result: {
      done: 'Zugewiesen',
      unchanged: 'Bereits vorhanden',
      skipped: 'Nicht zugewiesen',
    },
  },
  history: {
    title: 'Schichten des Mitarbeiters',
    loadError: 'Der Mitarbeiter konnte nicht geladen werden',
    listError: 'Die Schichten konnten nicht geladen werden',
    backLabel: 'Personalakte',
    subtitle: 'Aktuelle, geplante und frühere Schichten',
    section: 'Zugewiesene Schichten',
    noun: { one: 'Zuweisung', other: 'Zuweisungen' },
    empty: {
      title: 'Keine Schicht zugewiesen',
      active: 'Weisen Sie eine zu, damit gestempelt werden kann.',
      inactive: 'Aktivieren Sie den Mitarbeiter in seiner Personalakte, um eine Schicht zuzuweisen.',
    },
    cancel: 'Wechsel stornieren',
    cancelConfirm: {
      eyebrow: 'Geplanter Wechsel',
      title: 'Wechsel von {employee} zur Schicht {shift} stornieren?',
      message: '{employee} behält die aktuelle Schicht.',
      scheduledShift: 'Geplante Schicht',
      wasFrom: 'Sollte gelten ab',
      keep: 'Wechsel beibehalten',
    },
    cancelError: 'Der Schichtwechsel konnte nicht storniert werden',
    canceled: {
      title: 'Schichtwechsel storniert',
      text: '{employee} behält die bisherige Schicht.',
    },
    restoreTitle: 'Wechsel von {employee} zur Schicht {shift} wiederherstellen?',
  },
} satisfies Translation<typeof es>;
