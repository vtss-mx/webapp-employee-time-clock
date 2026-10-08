/**
 * Deriva de las señales del motor facial (antifraude fase 3, pantalla «Deriva de señales» del ADMIN), es-MX: cada
 * semana, por señal y plataforma, los intentos genuinos frente a la semana anterior (mediana, cola y PSI), la tasa
 * de casos y de aprobaciones rápidas por empresa y la bitácora de versiones. Los nombres de las señales vienen del
 * backend.
 */
export default {
  title: 'Deriva de señales',
  subtitle: 'Cada semana, por señal y plataforma: los intentos genuinos frente a la semana anterior.',
  loadError: 'No se pudo cargar la deriva',
  compute: 'Calcular ahora',
  computeError: 'No se pudo calcular la deriva',
  computed: 'Deriva calculada',
  computeAsk: {
    eyebrow: 'Deriva de señales',
    title: '¿Calcular ahora la última semana completa?',
    message: 'Se repite el cálculo del mantenimiento: mediana, cola y PSI de cada señal por plataforma, y la tasa de casos y de aprobaciones rápidas de cada empresa.',
    note: 'Solo mide y avisa: no cambia ningún umbral ni ninguna política.',
    confirm: 'Calcular',
  },
  kpis: {
    alerts: 'Señales con deriva',
    insufficient: 'Sin datos suficientes',
    companies: 'Empresas con alerta',
    weeks: 'Semanas calculadas',
  },
  /** La regla de la alerta y la ventana (todo configurado en el servidor). */
  rule: 'Alerta con un PSI mayor que {psi} o una cola que cae más de {drop} (con al menos {samples} intentos por señal y plataforma). Ventanas de {days} días.',
  sections: 'Secciones de la deriva',
  tabs: {
    signals: 'Señales',
    companies: 'Empresas',
    versions: 'Versiones',
  },
  filters: {
    week: 'Semana',
    latest: 'Semana más reciente',
    platform: 'Plataforma',
    allPlatforms: 'Todas las plataformas',
    status: 'Estado',
    allStatuses: 'Todos los estados',
  },
  weekOf: 'Semana del {date}',
  platforms: {
    IOS_SAFARI: 'iPhone y iPad (Safari)',
    ANDROID_CHROME: 'Android (Chrome)',
    DESKTOP: 'Escritorio',
    OTHER: 'Otros',
  },
  status: {
    OK: 'Estable',
    ALERT: 'Deriva',
    INSUFFICIENT: 'Pocos datos',
    NO_BASELINE: 'Sin línea base',
    VERSION_CHANGE: 'Cambió la versión',
  },
  columns: {
    signal: 'Señal',
    platform: 'Plataforma',
    samples: 'Intentos',
    median: 'Mediana',
    tail: 'Cola',
    psi: 'PSI',
    status: 'Estado',
  },
  /** Bajo cada valor: el de la semana anterior. */
  baseline: 'antes: {value}',
  samplesBaseline: 'antes: {count}',
  /** La cola que vigila cada señal: el 10 % más bajo de un mínimo o el 10 % más alto de un máximo. */
  tailLow: '10 % más bajo',
  tailHigh: '10 % más alto',
  noun: {
    one: 'señal',
    other: 'señales',
  },
  empty: {
    title: 'Sin semanas calculadas',
    description: 'El mantenimiento calcula la deriva al cerrar cada semana.',
  },
  noMatch: {
    title: 'Sin resultados',
    description: 'Prueba con otra semana, plataforma o estado.',
  },
  companies: {
    intro: 'Casos de fraude por intento y revisiones aprobadas en menos de {seconds} s desde que se abrieron: una empresa que aprueba todo sin mirar es una señal de fraude interno.',
    columns: {
      company: 'Empresa',
      attempts: 'Intentos',
      cases: 'Casos',
      caseRate: 'Casos por intento',
      reviews: 'Revisiones',
      quick: 'Aprobadas sin mirar',
      status: 'Estado',
    },
    quickDetail: '{quick} de {approved} aprobadas',
    status: {
      OK: 'Normal',
      ALERT: 'Revisar',
      INSUFFICIENT: 'Pocas revisiones',
    },
    noun: {
      one: 'empresa',
      other: 'empresas',
    },
    empty: {
      title: 'Sin empresas',
      description: 'Aquí verás los casos y las aprobaciones rápidas de cada empresa.',
    },
  },
  versions: {
    intro: 'Cambios de versión anotados en la bitácora del motor: una semana con un motor o unos modelos distintos no se compara con la anterior.',
    columns: {
      component: 'Componente',
      version: 'Versión',
      notedAt: 'Anotado',
    },
    components: {
      riskEngine: 'Motor de riesgo',
      faceModels: 'Modelos faciales',
      api: 'API',
      webapp: 'Aplicación web',
    },
    empty: {
      title: 'Sin cambios de versión',
      description: 'Aquí se anotarán los cambios del motor, los modelos y la aplicación web.',
    },
  },
} as const;
