/** Textos de pantallas del sistema: errores de la app, sin permiso, no encontrada, versión nueva, sin conexión (es-MX). */
export default {
  goHome: 'Ir al inicio',
  /** Lo que la app necesita para abrir no se pudo cargar (p. ej. los catálogos). */
  loadError: {
    badge: 'Error al cargar',
    title: 'No se pudo cargar la información',
    message: 'Revisa tu conexión e intenta de nuevo. Si continúa, avisa al administrador de tu empresa.',
  },
  /** Una pantalla se rompió al dibujarse (ErrorBoundary). */
  crash: {
    title: 'Error en esta pantalla',
    message: 'Tus datos están a salvo. Intenta de nuevo.',
  },
  /** Error asíncrono que nadie atendió (GlobalErrorHandler). */
  unexpected: {
    title: 'Ocurrió un problema',
    text: 'Intenta de nuevo. Si continúa, recarga la página.',
  },
  newVersion: {
    eyebrow: 'Actualización',
    title: 'Nueva versión disponible',
    text: 'Actualiza para usar las mejoras más recientes.',
    later: 'Más tarde',
    reload: 'Actualizar ahora',
  },
  offline: 'Sin conexión. Reintentando automáticamente.',
  forbidden: {
    title: 'Acceso denegado',
    text: 'No tienes permiso para ver esta sección.',
  },
  notFound: {
    title: 'Página no encontrada',
    text: 'Esta página no existe o cambió de lugar.',
  },
} as const;
