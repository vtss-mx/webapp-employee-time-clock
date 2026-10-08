import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/drift';

/** Dérive des signaux (ADMIN, antifraude phase 3) en français (fr-FR) : les mêmes clés que es-MX. */
export default {
  title: 'Dérive des signaux',
  subtitle: 'Chaque semaine, par signal et par plateforme : les tentatives authentiques face à la semaine précédente.',
  loadError: 'Impossible de charger la dérive',
  compute: 'Calculer maintenant',
  computeError: 'Impossible de calculer la dérive',
  computed: 'Dérive calculée',
  computeAsk: {
    eyebrow: 'Dérive des signaux',
    title: 'Calculer maintenant la dernière semaine complète ?',
    message: "Le calcul de la maintenance est répété : médiane, queue et PSI de chaque signal par plateforme, et le taux de cas et d'approbations rapides de chaque entreprise.",
    note: 'Cela mesure et alerte seulement : aucun seuil ni aucune politique ne change.',
    confirm: 'Calculer',
  },
  kpis: {
    alerts: 'Signaux en dérive',
    insufficient: 'Données insuffisantes',
    companies: 'Entreprises en alerte',
    weeks: 'Semaines calculées',
  },
  rule: 'Alerte si le PSI dépasse {psi} ou si la queue chute de plus de {drop} (avec au moins {samples} tentatives par signal et plateforme). Fenêtres de {days} jours.',
  sections: 'Sections de la dérive',
  tabs: {
    signals: 'Signaux',
    companies: 'Entreprises',
    versions: 'Versions',
  },
  filters: {
    week: 'Semaine',
    latest: 'Semaine la plus récente',
    platform: 'Plateforme',
    allPlatforms: 'Toutes les plateformes',
    status: 'État',
    allStatuses: 'Tous les états',
  },
  weekOf: 'Semaine du {date}',
  platforms: {
    IOS_SAFARI: 'iPhone et iPad (Safari)',
    ANDROID_CHROME: 'Android (Chrome)',
    DESKTOP: 'Ordinateur',
    OTHER: 'Autres',
  },
  status: {
    OK: 'Stable',
    ALERT: 'Dérive',
    INSUFFICIENT: 'Peu de données',
    NO_BASELINE: 'Sans référence',
    VERSION_CHANGE: 'Version changée',
  },
  columns: {
    signal: 'Signal',
    platform: 'Plateforme',
    samples: 'Tentatives',
    median: 'Médiane',
    tail: 'Queue',
    psi: 'PSI',
    status: 'État',
  },
  baseline: 'avant : {value}',
  samplesBaseline: 'avant : {count}',
  tailLow: '10 % les plus bas',
  tailHigh: '10 % les plus hauts',
  noun: {
    one: 'signal',
    other: 'signaux',
  },
  empty: {
    title: 'Aucune semaine calculée',
    description: 'La maintenance calcule la dérive à la clôture de chaque semaine.',
  },
  noMatch: {
    title: 'Aucun résultat',
    description: 'Essayez une autre semaine, plateforme ou un autre état.',
  },
  companies: {
    intro: 'Cas de fraude par tentative et vérifications approuvées en moins de {seconds} s après leur ouverture : une entreprise qui approuve tout sans regarder est un signe de fraude interne.',
    columns: {
      company: 'Entreprise',
      attempts: 'Tentatives',
      cases: 'Cas',
      caseRate: 'Cas par tentative',
      reviews: 'Vérifications',
      quick: 'Approuvées sans regarder',
      status: 'État',
    },
    quickDetail: '{quick} sur {approved} approuvées',
    status: {
      OK: 'Normal',
      ALERT: 'À examiner',
      INSUFFICIENT: 'Peu de vérifications',
    },
    noun: {
      one: 'entreprise',
      other: 'entreprises',
    },
    empty: {
      title: 'Aucune entreprise',
      description: 'Les cas et les approbations rapides de chaque entreprise apparaîtront ici.',
    },
  },
  versions: {
    intro: "Changements de version notés dans le journal du moteur : une semaine avec un moteur ou des modèles différents n'est pas comparée à la précédente.",
    columns: {
      component: 'Composant',
      version: 'Version',
      notedAt: 'Noté le',
    },
    components: {
      riskEngine: 'Moteur de risque',
      faceModels: 'Modèles faciaux',
      api: 'API',
      webapp: 'Application web',
    },
    empty: {
      title: 'Aucun changement de version',
      description: "Les changements du moteur, des modèles et de l'application web seront notés ici.",
    },
  },
} as const satisfies Translation<typeof es>;
