/** Textos de tablero de la empresa (es-MX). */
export default {
  /** Saludo según la hora del negocio. */
  greeting: {
    morning: 'Buenos días',
    afternoon: 'Buenas tardes',
    evening: 'Buenas noches',
  },
  subtitle: 'Resumen de tus empleados y validaciones pendientes.',
  registerEmployee: 'Registrar empleado',
  loadError: 'No se pudo cargar el resumen',
  kpis: {
    pending: 'Validaciones pendientes',
    total: 'Empleados registrados',
    active: 'Activos',
    inactive: 'Inactivos',
  },
  pending: {
    title_one: '{count} registro facial espera tu validación',
    title_other: '{count} registros faciales esperan tu validación',
    text: 'Confirma la identidad para que los empleados puedan identificarse.',
    review: 'Revisar ahora',
  },
  cards: {
    employees: {
      title: 'Empleados',
      text: 'Consulta y administra a tus empleados y sus códigos QR.',
    },
    newEmployee: {
      title: 'Registrar empleado',
      text: 'Captura sus datos; el rostro se registra al iniciar sesión.',
    },
    validations: {
      title: 'Validaciones',
      text: 'Acepta o rechaza los registros faciales de tus empleados.',
    },
  },
} as const;
