import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/drift';

/** Deriva dei segnali (ADMIN, antifrode fase 3) in italiano (it-IT): le stesse chiavi di es-MX. */
export default {
  title: 'Deriva dei segnali',
  subtitle: 'Ogni settimana, per segnale e piattaforma: i tentativi autentici rispetto alla settimana precedente.',
  loadError: 'Impossibile caricare la deriva',
  compute: 'Calcola ora',
  computeError: 'Impossibile calcolare la deriva',
  computed: 'Deriva calcolata',
  computeAsk: {
    eyebrow: 'Deriva dei segnali',
    title: "Calcolare ora l'ultima settimana completa?",
    message: 'Ripete il calcolo della manutenzione: mediana, coda e PSI di ogni segnale per piattaforma, e il tasso di casi e di approvazioni rapide di ogni azienda.',
    note: 'Misura e avvisa soltanto: nessuna soglia e nessun criterio cambia.',
    confirm: 'Calcola',
  },
  kpis: {
    alerts: 'Segnali con deriva',
    insufficient: 'Dati insufficienti',
    companies: 'Aziende con avviso',
    weeks: 'Settimane calcolate',
  },
  rule: 'Avviso con un PSI superiore a {psi} o una coda che cala più di {drop} (con almeno {samples} tentativi per segnale e piattaforma). Finestre di {days} giorni.',
  sections: 'Sezioni della deriva',
  tabs: {
    signals: 'Segnali',
    companies: 'Aziende',
    versions: 'Versioni',
  },
  filters: {
    week: 'Settimana',
    latest: 'Settimana più recente',
    platform: 'Piattaforma',
    allPlatforms: 'Tutte le piattaforme',
    status: 'Stato',
    allStatuses: 'Tutti gli stati',
  },
  weekOf: 'Settimana del {date}',
  platforms: {
    IOS_SAFARI: 'iPhone e iPad (Safari)',
    ANDROID_CHROME: 'Android (Chrome)',
    DESKTOP: 'Computer',
    OTHER: 'Altri',
  },
  status: {
    OK: 'Stabile',
    ALERT: 'Deriva',
    INSUFFICIENT: 'Pochi dati',
    NO_BASELINE: 'Senza riferimento',
    VERSION_CHANGE: 'Versione cambiata',
  },
  columns: {
    signal: 'Segnale',
    platform: 'Piattaforma',
    samples: 'Tentativi',
    median: 'Mediana',
    tail: 'Coda',
    psi: 'PSI',
    status: 'Stato',
  },
  baseline: 'prima: {value}',
  samplesBaseline: 'prima: {count}',
  tailLow: '10% più bassi',
  tailHigh: '10% più alti',
  noun: {
    one: 'segnale',
    other: 'segnali',
  },
  empty: {
    title: 'Nessuna settimana calcolata',
    description: 'La manutenzione calcola la deriva alla chiusura di ogni settimana.',
  },
  noMatch: {
    title: 'Nessun risultato',
    description: "Prova con un'altra settimana, piattaforma o un altro stato.",
  },
  companies: {
    intro: "Casi di frode per tentativo e revisioni approvate in meno di {seconds} s dall'apertura: un'azienda che approva tutto senza guardare è un segnale di frode interna.",
    columns: {
      company: 'Azienda',
      attempts: 'Tentativi',
      cases: 'Casi',
      caseRate: 'Casi per tentativo',
      reviews: 'Revisioni',
      quick: 'Approvate senza guardare',
      status: 'Stato',
    },
    quickDetail: '{quick} su {approved} approvate',
    status: {
      OK: 'Normale',
      ALERT: 'Da verificare',
      INSUFFICIENT: 'Poche revisioni',
    },
    noun: {
      one: 'azienda',
      other: 'aziende',
    },
    empty: {
      title: 'Nessuna azienda',
      description: 'Qui vedrai i casi e le approvazioni rapide di ogni azienda.',
    },
  },
  versions: {
    intro: 'Cambi di versione annotati nel registro del motore: una settimana con un motore o modelli diversi non si confronta con la precedente.',
    columns: {
      component: 'Componente',
      version: 'Versione',
      notedAt: 'Annotato',
    },
    components: {
      riskEngine: 'Motore di rischio',
      faceModels: 'Modelli facciali',
      api: 'API',
      webapp: 'Applicazione web',
    },
    empty: {
      title: 'Nessun cambio di versione',
      description: "Qui saranno annotati i cambi del motore, dei modelli e dell'applicazione web.",
    },
  },
} as const satisfies Translation<typeof es>;
