import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/shifts/assign';

/** Textos de asignar un turno y del historial de turnos de un empleado en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  title: 'Assegna turno',
  appliesFrom: 'Si applica dal',
  prepareError: "Impossibile preparare l'assegnazione",
  error: 'Impossibile assegnare il turno',
  errors: {
    shiftRequired: 'Scegli il turno',
    dateRequired: 'Scegli la data da cui si applica',
    fromTomorrow: 'Scegli da domani: un cambio turno si programma con un giorno di anticipo.',
    notPast: 'Il turno non può iniziare in una data passata.',
  },
  hints: {
    hasShift: 'Ha già un turno: il cambio si applica da domani o dopo e il suo turno attuale termina il giorno precedente.',
    firstShift: 'Il suo primo turno può iniziare oggi.',
    scheduled: 'Ha già un cambio al turno {shift} dal {date}: scegli una data successiva o annullalo nel suo storico.',
  },
  confirm: {
    eyebrowChange: 'Cambio turno',
    title: 'Assegnare il turno {shift} a {employee}?',
    note: 'Il suo turno attuale termina il giorno precedente; ciò che è già registrato conserva il suo turno.',
  },
  done: {
    title: 'Turno assegnato',
    text: '{employee} avrà il turno {shift} dal {date}.',
    endsBefore: 'Il suo turno attuale termina il giorno precedente.',
    keepsRecords: 'Ciò che è già registrato conserva il suo turno.',
  },
  bulk: {
    title: 'Assegna a più dipendenti',
    subtitle: 'Lo stesso turno e la stessa data di inizio per più dipendenti.',
    dateHint: 'Chi ha già un turno cambia da domani o dopo; se scegli oggi, non gli viene assegnato. Il suo turno attuale termina il giorno precedente.',
    employees: 'Dipendenti',
    employeesLabel: 'Dipendenti a cui viene assegnato il turno',
    employeesHint: 'Chi ha già questa assegnazione non cambia; agli inattivi non viene assegnato.',
    employeesRequired: 'Scegli almeno un dipendente',
    submit_one: 'Assegna a {count} dipendente',
    submit_other: 'Assegna a {count} dipendenti',
    confirmTitle_one: 'Assegnare il turno {shift} a {count} dipendente?',
    confirmTitle_other: 'Assegnare il turno {shift} a {count} dipendenti?',
    confirmMessage: "Chi ce l'ha già non cambia e agli inattivi non viene assegnato. Il risultato mostrerà a chi è stato assegnato.",
    confirmNote: 'Chi ha già un turno cambia dalla data scelta; il suo turno attuale termina il giorno precedente.',
    result: {
      done: 'Assegnato',
      unchanged: 'Lo avevano già',
      skipped: 'Non assegnato',
    },
  },
  history: {
    title: 'Turni del dipendente',
    loadError: 'Impossibile caricare il dipendente',
    listError: 'Impossibile caricare i suoi turni',
    backLabel: 'Scheda',
    subtitle: 'Turni in vigore, programmati e precedenti',
    section: 'Turni assegnati',
    noun: { one: 'assegnazione', other: 'assegnazioni' },
    empty: {
      title: 'Nessun turno assegnato',
      active: 'Assegnagliene uno perché possa timbrare.',
      inactive: 'Attivalo dalla sua scheda per assegnargli un turno.',
    },
    cancel: 'Annulla il cambio',
    cancelConfirm: {
      eyebrow: 'Cambio programmato',
      title: 'Annullare il cambio di {employee} al turno {shift}?',
      message: '{employee} manterrà il turno che ha.',
      scheduledShift: 'Turno programmato',
      wasFrom: 'Si sarebbe applicato dal',
      keep: 'Mantieni il cambio',
    },
    cancelError: 'Impossibile annullare il cambio turno',
    canceled: {
      title: 'Cambio turno annullato',
      text: '{employee} mantiene il turno che aveva.',
    },
    restoreTitle: 'Ripristinare il cambio di {employee} al turno {shift}?',
  },
} satisfies Translation<typeof es>;
