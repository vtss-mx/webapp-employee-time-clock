import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/system';

/** Textos de pantallas del sistema: errores de la app, sin permiso, no encontrada, versión nueva, sin conexión en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  goHome: 'Zur Startseite',
  loadError: {
    badge: 'Ladefehler',
    title: 'Die Informationen konnten nicht geladen werden',
    message: 'Prüfen Sie Ihre Verbindung und versuchen Sie es erneut. Besteht das Problem weiter, wenden Sie sich an den Administrator Ihres Unternehmens.',
  },
  crash: {
    title: 'Fehler in dieser Ansicht',
    message: 'Ihre Daten sind sicher. Versuchen Sie es erneut.',
  },
  unexpected: {
    title: 'Ein Problem ist aufgetreten',
    text: 'Versuchen Sie es erneut. Besteht das Problem weiter, laden Sie die Seite neu.',
  },
  newVersion: {
    eyebrow: 'Aktualisierung',
    title: 'Neue Version verfügbar',
    text: 'Aktualisieren Sie, um die neuesten Verbesserungen zu nutzen.',
    later: 'Später',
    reload: 'Jetzt aktualisieren',
  },
  offline: 'Keine Verbindung. Neuer Versuch erfolgt automatisch.',
  forbidden: {
    title: 'Zugriff verweigert',
    text: 'Sie haben keine Berechtigung, diesen Bereich anzuzeigen.',
  },
  notFound: {
    title: 'Seite nicht gefunden',
    text: 'Diese Seite existiert nicht oder wurde verschoben.',
  },
} satisfies Translation<typeof es>;
