import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/system';

/** Textos de pantallas del sistema: errores de la app, sin permiso, no encontrada, versión nueva, sin conexión en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  goHome: "Retour à l'accueil",
  loadError: {
    badge: 'Erreur de chargement',
    title: 'Impossible de charger les informations',
    message: "Vérifiez votre connexion et réessayez. Si le problème persiste, contactez l'administrateur de votre entreprise.",
  },
  crash: {
    title: 'Erreur sur cet écran',
    message: 'Vos données sont en sécurité. Réessayez.',
  },
  unexpected: {
    title: 'Un problème est survenu',
    text: 'Réessayez. Si le problème persiste, rechargez la page.',
  },
  newVersion: {
    eyebrow: 'Mise à jour',
    title: 'Nouvelle version disponible',
    text: 'Mettez à jour pour profiter des dernières améliorations.',
    later: 'Plus tard',
    reload: 'Mettre à jour',
  },
  offline: 'Hors connexion. Nouvelle tentative automatique.',
  forbidden: {
    title: 'Accès refusé',
    text: "Vous n'avez pas l'autorisation d'afficher cette section.",
  },
  notFound: {
    title: 'Page introuvable',
    text: "Cette page n'existe pas ou a été déplacée.",
  },
} satisfies Translation<typeof es>;
