/**
 * Continuidad del servicio (sección «Continuidad» de la pantalla «Rendimiento» del ADMIN; migración 0097 del
 * backend), es-MX: el compromiso de recuperación (RTO y RPO) y los ensayos de restauración que lo demuestran.
 *
 * «Nunca ensayado» cuenta como vencido y se dice con todas sus letras: un compromiso que nadie probó no vale.
 */
export default {
  loadError: 'No se pudo cargar la continuidad',
  drillsError: 'No se pudo cargar el historial de ensayos',
  commitment: 'Compromiso de recuperación',
  commitmentIntro: 'A qué se compromete la plataforma y qué está encendido hoy.',
  rto: 'Tiempo máximo para volver (RTO)',
  rpo: 'Pérdida máxima de datos (RPO)',
  interval: 'Cada cuánto hay que ensayar',
  backupUpload: 'Copia del respaldo al almacenamiento',
  pitr: 'Recuperación a un punto en el tiempo',
  backupInterval: 'Cada cuánto se respalda',
  backupRetention: 'Respaldos que se conservan',
  pitrArchive: 'Cada cuánto se archiva la bitácora',
  pitrRetention: 'Archivo que se conserva',
  enabled: 'Encendida',
  disabled: 'Apagada',
  days_one: '{count} día',
  days_other: '{count} días',
  rpoUnreachable: 'El RPO prometido es menor que el tiempo con que se archiva la bitácora: no se puede cumplir.',
  drills: 'Ensayos de restauración',
  drillsIntro: 'Un mecanismo por cada forma de restaurar. Nunca ensayado cuenta como vencido.',
  kinds: {
    PITR: 'Punto en el tiempo',
    BUCKET_DUMP: 'Copia cifrada en el almacenamiento',
  },
  states: {
    never: 'Nunca ensayado',
    overdue: 'Vencido',
    failed: 'El último falló',
    ok: 'Al día',
  },
  neverDrilled: 'Nunca se ha ensayado: toca hacerlo.',
  lastSuccess: 'Último ensayo correcto: {date}',
  dueOn: 'siguiente el {date}',
  dueNow: 'toca ahora',
  lastFailed: 'El intento del {date} falló.',
  rtoMeasured: 'Volvió en {value}',
  rpoMeasured: 'Se perdieron {value}',
  dataset: 'Con {value}',
  targetsAt: 'Comprometido entonces: {rto} y {rpo}',
  notMeasured: 'Sin medir',
  overdue_one: '{count} mecanismo está vencido o nunca se ha ensayado.',
  overdue_other: '{count} mecanismos están vencidos o nunca se han ensayado.',
  history: 'Historial de ensayos',
  historyIntro: 'Cada ensayo con su resultado y lo que midió. Los fallidos también.',
  columns: {
    kind: 'Mecanismo',
    when: 'Cuándo',
    result: 'Resultado',
    measures: 'Lo medido',
  },
  results: {
    met: 'Cumplió',
    missed: 'Restauró, fuera de meta',
    failed: 'Falló',
  },
  noun: {
    one: 'ensayo',
    other: 'ensayos',
  },
  empty: {
    title: 'Sin ensayos',
    description: 'Aquí verás cada restauración con lo que midió.',
  },
  noKinds: {
    title: 'Sin mecanismos',
    description: 'Aquí verás el estado de cada forma de restaurar.',
  },
} as const;
