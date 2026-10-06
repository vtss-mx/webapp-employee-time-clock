import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/system';

/** Textos de pantallas del sistema: errores de la app, sin permiso, no encontrada, versión nueva, sin conexión en inglés (en-US): las mismas llaves que es-MX. */
export default {
  goHome: 'Back to home',
  loadError: {
    badge: 'Loading error',
    title: "Couldn't load the information",
    message: 'Check your connection and try again. If it continues, contact your company administrator.',
  },
  crash: {
    title: 'This screen ran into an error',
    message: 'Your data is safe. Try again.',
  },
  unexpected: {
    title: 'Something went wrong',
    text: 'Try again. If it continues, reload the page.',
  },
  newVersion: {
    eyebrow: 'Update',
    title: 'New version available',
    text: 'Update to get the latest improvements.',
    later: 'Later',
    reload: 'Update now',
  },
  offline: 'Offline. Retrying automatically.',
  forbidden: {
    title: 'Access denied',
    text: "You don't have permission to view this section.",
  },
  notFound: {
    title: 'Page not found',
    text: "This page doesn't exist or has moved.",
  },
} satisfies Translation<typeof es>;
