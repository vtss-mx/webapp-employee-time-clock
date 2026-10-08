import type { Translation } from '../../../../types/i18n';
import type es from '../../es-MX/policy/tuning';

/** Ajustes de los candados de la política y su confirmación en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  title: 'Réglages des verrous',
  hint: 'Un réglage plus strict protège davantage, mais peut demander de refaire la capture plus souvent.',
  confirmTitle: 'Passer «{label}» à {value}?',
  relaxes: "Cette valeur protège moins contre l'usurpation d'identité.",
  confirmLabel: 'Enregistrer le réglage',
  antiSpoofing: {
    label: "Sensibilité de la détection d'usurpation",
    description: "Niveau d'exigence pour détecter les photos, les écrans et les vidéos.",
    saved: "Détection d'usurpation: niveau {level}",
  },
  steps: {
    label: 'Mouvements de la détection du vivant',
    description: 'Mouvements de tête aléatoires (tourner, regarder en haut ou en bas, se rapprocher).',
    one: 'Un mouvement aléatoire (plus rapide, moins sûr).',
    two: 'Deux mouvements aléatoires: une vidéo enregistrée devrait reproduire la séquence.',
    three: 'Trois mouvements aléatoires: le plus difficile à tromper, y compris pour une vidéo générée.',
    option_one: '{count} mouvement',
    option_other: '{count} mouvements',
    saved: 'Détection du vivant mise à jour',
    savedText_one: '{count} mouvement de tête aléatoire sera demandé.',
    savedText_other: '{count} mouvements de tête aléatoires seront demandés.',
  },
  timeout: {
    label: 'Temps pour la détection du vivant',
    description: "Pour les mouvements de la détection du vivant; s'il est écoulé, un nouveau défi est demandé sans refaire l'analyse.",
    saved: 'Temps de la détection du vivant mis à jour',
    savedText: 'Chaque défi expirera au bout de {time}.',
  },
  flash: {
    label: 'Flash coloré',
    retired: "Désactivé par décision produit (2026-10-06): l'écran ne clignote plus en couleurs. Les mouvements, la rafale et la vérification vocale couvrent la détection du vivant.",
  },
  quality: {
    label: 'Qualité minimale de la capture',
    description:
      'Les captures sombres ou floues se comparent mal et facilitent la fraude; plus le niveau est élevé, plus il y a de nouvelles tentatives sous un mauvais éclairage.',
    none: 'Aucun minimum',
    basic: 'Basique',
    medium: 'Moyenne',
    high: 'Élevée',
    saved: 'Qualité minimale mise à jour',
    savedText: 'Les captures de qualité inférieure à «{level}» seront refusées.',
    savedAny: 'Toute capture qui passe les contrôles de base est acceptée.',
  },
  lockoutSaved: 'Blocage mis à jour',
  lockoutFailures: {
    label: 'Tentatives avant blocage',
    description: 'Tentatives échouées ou suspectes consécutives qui bloquent temporairement la vérification faciale.',
    option_one: '{count} tentative',
    option_other: '{count} tentatives',
    savedText_one: 'Le blocage interviendra après {count} tentative échouée.',
    savedText_other: 'Le blocage interviendra après {count} tentatives échouées consécutives.',
  },
  lockoutMinutes: {
    label: 'Durée du blocage',
    description: 'Temps que la personne (ou le validateur) doit attendre avant de réessayer.',
    savedText: 'Le blocage durera {time}.',
  },
  qrLifetime: {
    label: 'Validité du code QR',
    description:
      "Chaque QR de l'employé se renouvelle automatiquement à l'expiration de ce délai et ne sert qu'une fois. Moins de temps, plus de sécurité.",
    saved: 'Validité du QR mise à jour',
    savedText: "Chaque code QR durera {time} et ne servira qu'une fois.",
  },
  accuracy: {
    label: 'Précision de la position',
    description: 'Marge maximale que le téléphone peut indiquer; une valeur plus stricte peut obliger à activer la position précise.',
    option: "Jusqu'à {distance}",
    saved: 'Précision mise à jour',
    savedText: 'Le pointage devra être refait si la position a une marge supérieure à {distance}.',
  },
  speed: {
    label: 'Vitesse maximale crédible',
    description: 'Entre deux pointages consécutifs; ce qui exige un déplacement plus rapide est refusé comme trajet impossible.',
    saved: 'Vitesse mise à jour',
    savedText: 'Les pointages qui exigent un déplacement à plus de {speed} depuis le précédent seront refusés.',
  },
} satisfies Translation<typeof es>;
