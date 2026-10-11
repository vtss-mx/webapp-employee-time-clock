/**
 * Bitácora de auditoría (pantalla «Bitácora de auditoría» del ADMIN; migración 0095 del backend), es-MX: quién
 * hizo qué, sobre qué y desde dónde, con los accesos negados y las acciones que fallaron.
 *
 * Los nombres de las acciones y de los resultados NO están aquí: vienen de los catálogos `audit_actions` y
 * `audit_outcomes` del servidor (regla 1 de la raíz).
 */
export default {
  title: 'Bitácora de auditoría',
  subtitle: 'Quién hizo qué, sobre qué y desde dónde. Es evidencia: no se cambia ni se borra.',
  loadError: 'No se pudo cargar la bitácora',
  summaryError: 'No se pudo cargar el resumen',
  /** Quien hizo la acción fue el sistema (mantenimiento, depuración), no una persona. */
  system: 'Sistema',
  platform: 'Plataforma',
  noValue: 'Sin valor',
  noEntity: 'Sin registro',
  noOrigin: 'Sin origen',
  noDetails: 'Sin detalle',
  period: 'Del {since} al {until}',
  retention_one: 'Cada evento se conserva {count} día',
  retention_other: 'Cada evento se conserva {count} días',
  total: 'Eventos en el periodo: {value}',
  dropped_one: 'Se descartó {count} evento por falta de memoria. Revisa los errores del sistema.',
  dropped_other: 'Se descartaron {count} eventos por falta de memoria. Revisa los errores del sistema.',
  trace: 'Rastreo {id}',
  kpis: {
    total: 'Eventos',
    denied: 'Accesos negados',
    failed: 'Acciones que fallaron',
    pending: 'Por guardar',
  },
  filters: {
    since: 'Desde',
    until: 'Hasta',
    action: 'Acción',
    allActions: 'Todas las acciones',
    outcome: 'Resultado',
    allOutcomes: 'Todos los resultados',
    search: 'Buscar en la bitácora',
    searchPlaceholder: 'Correo, registro o rastreo',
    clear: 'Quitar filtros',
  },
  columns: {
    occurredAt: 'Cuándo',
    action: 'Acción',
    actor: 'Quién',
    entity: 'Sobre qué',
    origin: 'Desde dónde',
    outcome: 'Resultado',
    details: 'Detalle',
  },
  details: {
    change: 'cambió a',
  },
  noun: {
    one: 'evento',
    other: 'eventos',
  },
  empty: {
    title: 'Sin eventos',
    description: 'Aquí verás cada acción con su resultado.',
  },
  noMatch: {
    title: 'Sin resultados',
    description: 'Prueba con otro periodo o filtro.',
  },
  export: 'Exportar',
  exporting_one: 'Tramo {chunk} · {count} evento',
  exporting_other: 'Tramo {chunk} · {count} eventos',
  exportAsk: {
    eyebrow: 'Bitácora de auditoría',
    title: '¿Exportar la bitácora del periodo?',
    message: 'Se descarga un archivo JSON con los eventos que estás viendo.',
    filtered: 'Se descarga un archivo JSON con los eventos del filtro que estás viendo.',
    note: 'La exportación queda registrada en la bitácora, con su filtro.',
    confirm: 'Exportar',
  },
  exported: 'Bitácora exportada',
  exportedText_one: '{count} evento en {file}',
  exportedText_other: '{count} eventos en {file}',
  exportTruncated_one: 'Se alcanzó el tope de {count} tramo: acota el periodo.',
  exportTruncated_other: 'Se alcanzó el tope de {count} tramos: acota el periodo.',
  exportEmpty: 'Sin eventos en el periodo',
  exportEmptyText: 'No se descargó ningún archivo.',
  exportError: 'No se pudo exportar la bitácora',
} as const;
