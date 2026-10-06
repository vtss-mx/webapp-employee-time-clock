import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/shifts/assign';

/** Textos de asignar un turno y del historial de turnos de un empleado en inglés (en-US): las mismas llaves que es-MX. */
export default {
  title: 'Assign shift',
  appliesFrom: 'Effective from',
  prepareError: "Couldn't prepare the assignment",
  error: "Couldn't assign the shift",
  errors: {
    shiftRequired: 'Choose the shift',
    dateRequired: 'Choose the date it takes effect',
    fromTomorrow: 'Choose tomorrow or later: a shift change is scheduled one day in advance.',
    notPast: "The shift can't start on a past date.",
  },
  hints: {
    hasShift: 'Already has a shift: the change applies from tomorrow on, and their current shift ends the day before.',
    firstShift: 'Their first shift can start today.',
    scheduled: 'Already has a change to {shift} from {date}: choose a later date or cancel it in their history.',
  },
  confirm: {
    eyebrowChange: 'Shift change',
    title: 'Assign shift {shift} to {employee}?',
    note: "Their current shift ends the day before; what's already recorded keeps its shift.",
  },
  done: {
    title: 'Shift assigned',
    text: '{employee} will have the {shift} shift from {date}.',
    endsBefore: 'Their current shift ends the day before.',
    keepsRecords: "What's already recorded keeps its shift.",
  },
  bulk: {
    title: 'Assign to multiple employees',
    subtitle: 'The same shift and start date for several employees.',
    dateHint: "Anyone who already has a shift switches tomorrow or later; if you choose today, they aren't assigned. Their current shift ends the day before.",
    employees: 'Employees',
    employeesLabel: 'Employees to assign the shift to',
    employeesHint: "Anyone who already has this assignment stays the same; inactive employees aren't assigned.",
    employeesRequired: 'Choose at least one employee',
    submit_one: 'Assign to {count} employee',
    submit_other: 'Assign to {count} employees',
    confirmTitle_one: 'Assign shift {shift} to {count} employee?',
    confirmTitle_other: 'Assign shift {shift} to {count} employees?',
    confirmMessage: "Anyone who already has it stays the same, and inactive employees aren't assigned. The result will show who was.",
    confirmNote: 'Anyone who already has a shift switches on the chosen date; their current shift ends the day before.',
    result: {
      done: 'Assigned',
      unchanged: 'Already had it',
      skipped: 'Not assigned',
    },
  },
  history: {
    title: 'Employee shifts',
    loadError: "Couldn't load the employee",
    listError: "Couldn't load their shifts",
    backLabel: 'Employee file',
    subtitle: 'Current, scheduled, and past shifts',
    section: 'Assigned shifts',
    noun: { one: 'assignment', other: 'assignments' },
    empty: {
      title: 'No shift assigned',
      active: 'Assign one so they can check in.',
      inactive: 'Activate them from their file to assign a shift.',
    },
    cancel: 'Cancel change',
    cancelConfirm: {
      eyebrow: 'Scheduled change',
      title: "Cancel {employee}'s change to shift {shift}?",
      message: '{employee} will keep their current shift.',
      scheduledShift: 'Scheduled shift',
      wasFrom: 'Was going to start on',
      keep: 'Keep the change',
    },
    cancelError: "Couldn't cancel the shift change",
    canceled: {
      title: 'Shift change canceled',
      text: '{employee} keeps the shift they had.',
    },
    restoreTitle: "Restore {employee}'s change to shift {shift}?",
  },
} satisfies Translation<typeof es>;
