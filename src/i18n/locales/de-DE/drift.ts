import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/drift';

/** Drift der Signale (ADMIN, Betrugsschutz Phase 3) auf Deutsch (de-DE): dieselben Schlüssel wie es-MX. */
export default {
  title: 'Drift der Signale',
  subtitle: 'Jede Woche, je Signal und Plattform: die echten Versuche im Vergleich zur Vorwoche.',
  loadError: 'Die Drift konnte nicht geladen werden',
  compute: 'Jetzt berechnen',
  computeError: 'Die Drift konnte nicht berechnet werden',
  computed: 'Drift berechnet',
  computeAsk: {
    eyebrow: 'Drift der Signale',
    title: 'Die letzte vollständige Woche jetzt berechnen?',
    message: 'Die Berechnung der Wartung wird wiederholt: Median, Rand und PSI jedes Signals je Plattform sowie die Fallquote und die schnellen Freigaben jedes Unternehmens.',
    note: 'Es wird nur gemessen und gewarnt: kein Schwellenwert und keine Richtlinie ändert sich.',
    confirm: 'Berechnen',
  },
  kpis: {
    alerts: 'Signale mit Drift',
    insufficient: 'Zu wenige Daten',
    companies: 'Unternehmen mit Warnung',
    weeks: 'Berechnete Wochen',
  },
  rule: 'Warnung bei einem PSI über {psi} oder einem Rand, der um mehr als {drop} fällt (mit mindestens {samples} Versuchen je Signal und Plattform). Fenster von {days} Tagen.',
  sections: 'Abschnitte der Drift',
  tabs: {
    signals: 'Signale',
    companies: 'Unternehmen',
    versions: 'Versionen',
  },
  filters: {
    week: 'Woche',
    latest: 'Neueste Woche',
    platform: 'Plattform',
    allPlatforms: 'Alle Plattformen',
    status: 'Status',
    allStatuses: 'Alle Status',
  },
  weekOf: 'Woche vom {date}',
  platforms: {
    IOS_SAFARI: 'iPhone und iPad (Safari)',
    ANDROID_CHROME: 'Android (Chrome)',
    DESKTOP: 'Computer',
    OTHER: 'Andere',
  },
  status: {
    OK: 'Stabil',
    ALERT: 'Drift',
    INSUFFICIENT: 'Wenige Daten',
    NO_BASELINE: 'Ohne Referenz',
    VERSION_CHANGE: 'Version geändert',
  },
  columns: {
    signal: 'Signal',
    platform: 'Plattform',
    samples: 'Versuche',
    median: 'Median',
    tail: 'Rand',
    psi: 'PSI',
    status: 'Status',
  },
  baseline: 'vorher: {value}',
  samplesBaseline: 'vorher: {count}',
  tailLow: 'niedrigste 10 %',
  tailHigh: 'höchste 10 %',
  noun: {
    one: 'Signal',
    other: 'Signale',
  },
  empty: {
    title: 'Keine berechneten Wochen',
    description: 'Die Wartung berechnet die Drift zum Ende jeder Woche.',
  },
  noMatch: {
    title: 'Keine Ergebnisse',
    description: 'Versuchen Sie eine andere Woche, Plattform oder einen anderen Status.',
  },
  companies: {
    intro: 'Betrugsfälle je Versuch und Prüfungen, die weniger als {seconds} s nach dem Öffnen freigegeben wurden: ein Unternehmen, das alles ungesehen freigibt, ist ein Zeichen für internen Betrug.',
    columns: {
      company: 'Unternehmen',
      attempts: 'Versuche',
      cases: 'Fälle',
      caseRate: 'Fälle je Versuch',
      reviews: 'Prüfungen',
      quick: 'Ungesehen freigegeben',
      status: 'Status',
    },
    quickDetail: '{quick} von {approved} freigegeben',
    status: {
      OK: 'Normal',
      ALERT: 'Prüfen',
      INSUFFICIENT: 'Wenige Prüfungen',
    },
    noun: {
      one: 'Unternehmen',
      other: 'Unternehmen',
    },
    empty: {
      title: 'Keine Unternehmen',
      description: 'Hier sehen Sie die Fälle und die schnellen Freigaben jedes Unternehmens.',
    },
  },
  versions: {
    intro: 'Im Protokoll des Motors vermerkte Versionswechsel: eine Woche mit einem anderen Motor oder anderen Modellen wird nicht mit der vorherigen verglichen.',
    columns: {
      component: 'Komponente',
      version: 'Version',
      notedAt: 'Vermerkt',
    },
    components: {
      riskEngine: 'Risikomotor',
      faceModels: 'Gesichtsmodelle',
      api: 'API',
      webapp: 'Web-App',
    },
    empty: {
      title: 'Keine Versionswechsel',
      description: 'Hier werden Wechsel des Motors, der Modelle und der Web-App vermerkt.',
    },
  },
} as const satisfies Translation<typeof es>;
