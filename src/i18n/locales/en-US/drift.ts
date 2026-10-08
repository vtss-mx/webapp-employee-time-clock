import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/drift';

/** Signal drift (ADMIN, antifraud phase 3) in English (en-US): the same keys as es-MX. */
export default {
  title: 'Signal drift',
  subtitle: 'Every week, by signal and platform: genuine attempts against the previous week.',
  loadError: "Couldn't load the drift",
  compute: 'Compute now',
  computeError: "Couldn't compute the drift",
  computed: 'Drift computed',
  computeAsk: {
    eyebrow: 'Signal drift',
    title: 'Compute the last complete week now?',
    message: "This repeats the maintenance job: median, tail and PSI of each signal by platform, and each company's case rate and quick approvals.",
    note: 'It only measures and alerts: no threshold or policy changes.',
    confirm: 'Compute',
  },
  kpis: {
    alerts: 'Drifting signals',
    insufficient: 'Not enough data',
    companies: 'Companies with alerts',
    weeks: 'Weeks computed',
  },
  rule: 'Alerts when the PSI is above {psi} or the tail drops more than {drop} (with at least {samples} attempts per signal and platform). Windows of {days} days.',
  sections: 'Drift sections',
  tabs: {
    signals: 'Signals',
    companies: 'Companies',
    versions: 'Versions',
  },
  filters: {
    week: 'Week',
    latest: 'Most recent week',
    platform: 'Platform',
    allPlatforms: 'All platforms',
    status: 'Status',
    allStatuses: 'All statuses',
  },
  weekOf: 'Week of {date}',
  platforms: {
    IOS_SAFARI: 'iPhone and iPad (Safari)',
    ANDROID_CHROME: 'Android (Chrome)',
    DESKTOP: 'Desktop',
    OTHER: 'Other',
  },
  status: {
    OK: 'Stable',
    ALERT: 'Drift',
    INSUFFICIENT: 'Little data',
    NO_BASELINE: 'No baseline',
    VERSION_CHANGE: 'Version changed',
  },
  columns: {
    signal: 'Signal',
    platform: 'Platform',
    samples: 'Attempts',
    median: 'Median',
    tail: 'Tail',
    psi: 'PSI',
    status: 'Status',
  },
  baseline: 'before: {value}',
  samplesBaseline: 'before: {count}',
  tailLow: 'lowest 10%',
  tailHigh: 'highest 10%',
  noun: {
    one: 'signal',
    other: 'signals',
  },
  empty: {
    title: 'No weeks computed',
    description: 'Maintenance computes the drift when each week closes.',
  },
  noMatch: {
    title: 'No results',
    description: 'Try another week, platform or status.',
  },
  companies: {
    intro: 'Fraud cases per attempt and reviews approved in under {seconds} s after they opened: a company that approves everything without looking is a sign of internal fraud.',
    columns: {
      company: 'Company',
      attempts: 'Attempts',
      cases: 'Cases',
      caseRate: 'Cases per attempt',
      reviews: 'Reviews',
      quick: 'Approved without looking',
      status: 'Status',
    },
    quickDetail: '{quick} of {approved} approved',
    status: {
      OK: 'Normal',
      ALERT: 'Review',
      INSUFFICIENT: 'Few reviews',
    },
    noun: {
      one: 'company',
      other: 'companies',
    },
    empty: {
      title: 'No companies',
      description: "Each company's cases and quick approvals will appear here.",
    },
  },
  versions: {
    intro: 'Version changes noted in the engine log: a week with a different engine or models is not compared with the previous one.',
    columns: {
      component: 'Component',
      version: 'Version',
      notedAt: 'Noted',
    },
    components: {
      riskEngine: 'Risk engine',
      faceModels: 'Face models',
      api: 'API',
      webapp: 'Web app',
    },
    empty: {
      title: 'No version changes',
      description: 'Changes to the engine, the models and the web app will be noted here.',
    },
  },
} as const satisfies Translation<typeof es>;
