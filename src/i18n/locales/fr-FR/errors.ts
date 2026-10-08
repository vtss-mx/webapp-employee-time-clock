import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/errors';

/** Textos de los errores que arma el cliente en francés (fr-FR). */
export default {
  status: {
    network: 'Impossible de joindre le serveur. Vérifiez votre connexion.',
    ok: 'Terminé',
    badRequest: 'Requête non valide',
    unauthorized: "Votre session n'est plus valide. Reconnectez-vous.",
    forbidden: "Vous n'avez pas l'autorisation d'effectuer cette action",
    notFound: 'Introuvable',
    methodNotAllowed: 'Action non autorisée',
    timeout: "Le serveur n'a pas répondu à temps. Réessayez.",
    conflict: 'Conflit avec des données existantes',
    payloadTooLarge: 'Le fichier est trop volumineux',
    unsupportedMedia: 'Format non pris en charge',
    unprocessable: 'Données non valides',
    rateLimited: 'Trop de tentatives. Patientez quelques secondes.',
    server: "Une erreur inattendue s'est produite. Réessayez.",
    unavailable: 'Service indisponible. Réessayez dans quelques secondes.',
  },
  invalidResponse: 'Réponse inattendue du serveur. Réessayez.',
  unexpected: "Une erreur inattendue s'est produite",
  unexpectedRetry: "Une erreur inattendue s'est produite. Réessayez.",
  titles: {
    network: 'Serveur injoignable',
    unauthorized: 'Impossible de vérifier votre accès',
    forbidden: 'Action non autorisée',
    notFound: 'Introuvable',
    timeout: 'Aucune réponse du serveur',
    conflict: 'Ces informations existent déjà',
    payloadTooLarge: 'Le fichier est trop volumineux',
    unprocessable: 'Vérifiez les informations',
    rateLimited: 'Trop de tentatives',
    server: 'Erreur du serveur',
    failed: "Impossible de terminer l'action",
    generic: 'Un problème est survenu',
  },
} satisfies Translation<typeof es>;
