import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/verification';

/** Textos de resultados e historial de verificaciones de identidad en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  outcome: {
    success: 'Riuscita',
    failed: 'Non riuscita',
  },
  result: {
    kiosk: {
      title: 'Dipendente identificato',
      greeting: 'Identità confermata: {name}.',
      next: 'Persona successiva',
      home: "Torna all'inizio",
    },
    self: {
      title: 'Identità confermata',
      greeting: 'Ciao, {name}.',
      finish: 'Termina',
      changeMethod: 'Cambia metodo',
    },
    number: 'Numero',
    confidence: 'Affidabilità',
    dateTime: 'Data e ora',
    retry: 'Riprova',
  },
  history: {
    errorTitle: 'Impossibile caricare il registro',
    emptyTitle: 'Nessuna verifica',
    emptyDescription: 'Qui vedrai ogni tentativo di verificare la sua identità.',
    nounOne: 'tentativo',
    nounOther: 'tentativi',
    confidence: 'Affidabilità {value}',
  },
  map: {
    label: 'Mappa delle verifiche',
    pin: 'Luogo della verifica',
    loading: 'Caricamento della mappa…',
    failed: 'La mappa non è disponibile.',
  },
  company: {
    title: 'Verifiche',
    subtitle: "Dove e quando è stata verificata l'identità del tuo personale.",
    loadError: 'Impossibile caricare le verifiche',
    mapHint: 'Scegli una verifica con posizione per vederla sulla mappa.',
    notIdentified: 'Non identificato',
    noun: { one: 'verifica', other: 'verifiche' },
    filters: { all: 'Tutte', success: 'Riuscite', failed: 'Non riuscite', from: 'Da', to: 'A' },
    columns: { when: 'Data e ora', result: 'Esito', method: 'Metodo', place: 'Luogo' },
    place: { show: 'Vedi sulla mappa', none: 'Senza posizione', accuracy: 'Precisione {distance}' },
    empty: { title: 'Nessuna verifica', description: 'Qui vedrai dove è avvenuta ogni verifica.' },
    noMatch: { title: 'Nessun risultato', description: 'Prova un altro filtro o intervallo di date.' },
  },
} satisfies Translation<typeof es>;
