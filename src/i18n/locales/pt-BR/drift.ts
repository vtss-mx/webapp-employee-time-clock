import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/drift';

/** Desvio dos sinais (ADMIN, antifraude fase 3) em português do Brasil (pt-BR): as mesmas chaves que es-MX. */
export default {
  title: 'Desvio dos sinais',
  subtitle: 'Toda semana, por sinal e plataforma: as tentativas genuínas frente à semana anterior.',
  loadError: 'Não foi possível carregar o desvio',
  compute: 'Calcular agora',
  computeError: 'Não foi possível calcular o desvio',
  computed: 'Desvio calculado',
  computeAsk: {
    eyebrow: 'Desvio dos sinais',
    title: 'Calcular agora a última semana completa?',
    message: 'Repete o cálculo da manutenção: mediana, cauda e PSI de cada sinal por plataforma, e a taxa de casos e de aprovações rápidas de cada empresa.',
    note: 'Só mede e avisa: não altera nenhum limiar nem nenhuma política.',
    confirm: 'Calcular',
  },
  kpis: {
    alerts: 'Sinais com desvio',
    insufficient: 'Sem dados suficientes',
    companies: 'Empresas com alerta',
    weeks: 'Semanas calculadas',
  },
  rule: 'Alerta com um PSI maior que {psi} ou uma cauda que cai mais de {drop} (com pelo menos {samples} tentativas por sinal e plataforma). Janelas de {days} dias.',
  sections: 'Seções do desvio',
  tabs: {
    signals: 'Sinais',
    companies: 'Empresas',
    versions: 'Versões',
  },
  filters: {
    week: 'Semana',
    latest: 'Semana mais recente',
    platform: 'Plataforma',
    allPlatforms: 'Todas as plataformas',
    status: 'Situação',
    allStatuses: 'Todas as situações',
  },
  weekOf: 'Semana de {date}',
  platforms: {
    IOS_SAFARI: 'iPhone e iPad (Safari)',
    ANDROID_CHROME: 'Android (Chrome)',
    DESKTOP: 'Computador',
    OTHER: 'Outros',
  },
  status: {
    OK: 'Estável',
    ALERT: 'Desvio',
    INSUFFICIENT: 'Poucos dados',
    NO_BASELINE: 'Sem linha de base',
    VERSION_CHANGE: 'Versão alterada',
  },
  columns: {
    signal: 'Sinal',
    platform: 'Plataforma',
    samples: 'Tentativas',
    median: 'Mediana',
    tail: 'Cauda',
    psi: 'PSI',
    status: 'Situação',
  },
  baseline: 'antes: {value}',
  samplesBaseline: 'antes: {count}',
  tailLow: '10% mais baixos',
  tailHigh: '10% mais altos',
  noun: {
    one: 'sinal',
    other: 'sinais',
  },
  empty: {
    title: 'Sem semanas calculadas',
    description: 'A manutenção calcula o desvio ao fechar cada semana.',
  },
  noMatch: {
    title: 'Sem resultados',
    description: 'Tente outra semana, plataforma ou situação.',
  },
  companies: {
    intro: 'Casos de fraude por tentativa e revisões aprovadas em menos de {seconds} s desde que foram abertas: uma empresa que aprova tudo sem olhar é um sinal de fraude interna.',
    columns: {
      company: 'Empresa',
      attempts: 'Tentativas',
      cases: 'Casos',
      caseRate: 'Casos por tentativa',
      reviews: 'Revisões',
      quick: 'Aprovadas sem olhar',
      status: 'Situação',
    },
    quickDetail: '{quick} de {approved} aprovadas',
    status: {
      OK: 'Normal',
      ALERT: 'Revisar',
      INSUFFICIENT: 'Poucas revisões',
    },
    noun: {
      one: 'empresa',
      other: 'empresas',
    },
    empty: {
      title: 'Sem empresas',
      description: 'Aqui você verá os casos e as aprovações rápidas de cada empresa.',
    },
  },
  versions: {
    intro: 'Mudanças de versão anotadas no histórico do mecanismo: uma semana com um mecanismo ou modelos diferentes não se compara com a anterior.',
    columns: {
      component: 'Componente',
      version: 'Versão',
      notedAt: 'Anotado',
    },
    components: {
      riskEngine: 'Mecanismo de risco',
      faceModels: 'Modelos faciais',
      api: 'API',
      webapp: 'Aplicativo web',
    },
    empty: {
      title: 'Sem mudanças de versão',
      description: 'Aqui serão anotadas as mudanças do mecanismo, dos modelos e do aplicativo web.',
    },
  },
} as const satisfies Translation<typeof es>;
