import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/shifts/requests';

/** Textos de las solicitudes de cambio de turno en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  title: 'Richieste di cambio turno',
  backLabel: 'Richieste',
  loadError: 'Impossibile caricare le richieste',
  subtitle_one: '{count} richiesta dei tuoi dipendenti',
  subtitle_other: '{count} richieste dei tuoi dipendenti',
  all: 'Tutte le richieste',
  filter: 'Filtra per stato',
  noun: { one: 'richiesta', other: 'richieste' },
  empty: {
    pendingTitle: 'Tutto in ordine',
    pendingDescription: 'Non ci sono richieste di turno da esaminare.',
    statusTitle: 'Nessuna richiesta',
    statusDescription: 'Prova con un altro stato.',
    allDescription: 'Qui vedrai i cambi turno richiesti dal tuo personale.',
  },
  item: {
    approve: 'Approva la richiesta di {name}',
    reject: 'Rifiuta la richiesta di {name}',
    when: 'Dal {date} · richiesta {ago}',
    companyNote: "Nota dell'azienda: «{note}»",
  },
  summary: {
    change: 'Cambio',
    from: 'Dal',
    requested: 'Richiesta',
    noShift: 'Nessun turno',
    changesTo: 'passa a',
  },
  closed: {
    loadError: 'Impossibile caricare la richiesta',
    title: 'Questa richiesta non è più in sospeso',
    description: 'È già stata approvata, rifiutata o annullata dal dipendente.',
    action: 'Visualizza le richieste',
  },
  approve: {
    title: 'Approva il cambio turno',
    request: 'Richiesta',
    requestedShift: 'Turno richiesto',
    fromTomorrow: 'Scegli da domani: il cambio turno si programma con un giorno di anticipo.',
    dateHint: 'Ha richiesto dal {date}. Il suo turno attuale termina il giorno precedente e ciò che è già registrato non cambia.',
    error: 'Impossibile approvare il cambio turno',
    confirmTitle: 'Approvare il cambio di {employee} al turno {shift}?',
    confirmMessage: 'Il suo turno attuale termina il giorno precedente e ciò che è già registrato non cambia.',
    submit: 'Approva il cambio',
    done: {
      title: 'Cambio turno approvato',
      text: '{employee} avrà il turno {shift} dal {date}.',
    },
  },
  reject: {
    title: 'Rifiuta il cambio turno',
    intro: 'Ha richiesto di passare al turno {shift} dal {date}. Manterrà il suo turno attuale e vedrà questa nota nella sua richiesta.',
    placeholder: "Spiega perché non è possibile fare il cambio (ad es. manca personale in quell'orario)",
    confirmTitle: 'Rifiutare il cambio di {employee}?',
    confirmMessage: 'Manterrà il suo turno attuale e vedrà la tua nota nella sua richiesta.',
    requestedValue: '{shift} dal {date}',
    done: {
      title: 'Richiesta rifiutata',
      text: '{employee} mantiene il suo turno e vedrà la tua nota.',
    },
  },
} satisfies Translation<typeof es>;
