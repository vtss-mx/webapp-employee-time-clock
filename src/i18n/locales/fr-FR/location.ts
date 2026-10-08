import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/location';

/** Textos de domicilios, mapas, búsqueda de lugares y ubicación en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  eyebrow: 'Position',
  problems: {
    unsupported: {
      title: 'Position non disponible',
      text: 'Ce navigateur ne permet pas de lire la position. Utilisez Safari ou Chrome à jour.',
    },
    insecure: {
      title: 'Connexion non sécurisée',
      text: "La position ne peut être lue que via une connexion sécurisée (https). Ouvrez l'application avec son adresse sécurisée.",
    },
    denied: {
      title: "Autorisez l'accès à votre position",
      text: "L'autorisation de localisation est bloquée dans ce navigateur.",
    },
    unavailable: {
      title: "Impossible d'obtenir votre position",
      text: "Activez la localisation (GPS) et réessayez, de préférence près d'une fenêtre.",
    },
    timeout: {
      title: 'La localisation a pris trop de temps',
      text: "Activez la localisation précise de l'appareil et réessayez.",
    },
  },
  permissionSteps: {
    iphone:
      "iPhone: Réglages › Confidentialité et sécurité › Service de localisation › Safari (ou votre navigateur) › autorisez l'accès pendant l'utilisation de l'application.",
    android: "Android: touchez le cadenas à côté de l'adresse › Autorisations › Position › Autoriser.",
  },
  deniedFor: {
    login: {
      text: "Ce validateur ne peut se connecter que sur son lieu d'activité et l'autorisation de localisation est bloquée.",
      next: "Revenez à l'application et reconnectez-vous.",
    },
    attendance: {
      text: "L'enregistrement de votre présence nécessite votre position et l'autorisation est bloquée dans ce navigateur.",
      next: 'Revenez ici et touchez «Réessayer».',
    },
    map: {
      text: "Pour vous situer sur la carte, l'autorisation de localisation est nécessaire et elle est bloquée dans ce navigateur.",
      next: 'Touchez de nouveau «Ma position» (ou marquez le point sur la carte).',
    },
    checkpoint: {
      text: "Ce validateur envoie sa position à chaque identification et l'autorisation est bloquée dans ce navigateur.",
      next: 'Rouvrez le point de contrôle.',
    },
    verification: {
      text: "Cette vérification nécessite votre position et l'autorisation est bloquée dans ce navigateur.",
      next: 'Revenez ici et touchez «Réessayer».',
    },
  },
  server: {
    outOfRange: 'Vous êtes en dehors de la zone autorisée',
    inaccurate: "Votre position n'est pas précise",
    required: 'Votre position est nécessaire',
    approach: "Rapprochez-vous du point d'accès où opère ce validateur.",
    gps: "Activez la localisation précise (GPS) de l'appareil.",
    signInAgain: 'Reconnectez-vous.',
  },
  address: {
    country: {
      label: 'Pays',
      hint: "Pays où se trouve l'adresse.",
      placeholder: 'Choisissez le pays',
      search: 'Rechercher un pays',
      empty: 'Aucun pays ne correspond',
    },
    state: { label: 'État ou province', hint: 'Entité fédérative ou région.' },
    municipality: { label: 'Commune ou arrondissement', hint: 'Division administrative à laquelle elle appartient.' },
    city: { label: 'Ville ou localité', hint: 'Ville, village ou localité; son nom peut différer de celui de la commune.' },
    neighborhood: { label: 'Quartier', hint: 'Zone ou secteur au sein de la localité.' },
    postalCode: { label: 'Code postal', hint: 'Code de la zone postale.' },
    street: { label: 'Rue ou voie', hint: "Nom de la rue, de l'avenue, de la route, etc." },
    exteriorNumber: { label: 'Numéro de rue', hint: 'Numéro qui identifie le bâtiment; il peut contenir des lettres.' },
    interiorNumber: { label: 'Numéro intérieur', hint: 'Appartement, bureau ou local dans le bâtiment. Facultatif.' },
    referenceNotes: {
      label: 'Repères',
      hint: 'Indications supplémentaires pour le trouver, comme les rues adjacentes ou des lieux proches. Facultatif.',
      placeholder: 'Entre la rue Juárez et la rue Morelos, en face de la place',
    },
    interior: 'Intérieur {number}',
    required: {
      country: 'Choisissez le pays',
      state: "Saisissez l'État ou la province",
      municipality: "Saisissez la commune ou l'arrondissement",
      city: 'Saisissez la ville ou la localité',
      neighborhood: 'Saisissez le quartier',
      postalCode: 'Saisissez le code postal',
      street: 'Saisissez la rue',
      exteriorNumber: 'Saisissez le numéro de rue (ou S/N)',
    },
    postalCodeMx: 'Le code postal mexicain comporte 5 chiffres',
    postalCodeInvalid: "Le code postal n'est pas valide",
    minLength: 'Saisissez au moins {min} caractères',
    maxLength: '{max} caractères maximum',
  },
  picker: {
    notices: {
      geocoding: "Impossible de compléter l'adresse depuis la carte. Saisissez-la manuellement; le point a bien été marqué.",
      geolocation: "Impossible d'obtenir votre position. Marquez le point sur la carte.",
      places: "La recherche de lieux n'est pas disponible. Saisissez l'adresse et marquez le point sur la carte.",
      maps: "La carte n'est pas disponible. Saisissez l'adresse manuellement.",
      offline: "Google Maps n'a pas répondu. Vérifiez votre connexion et réessayez.",
      notFound: "Adresse introuvable. Vérifiez l'adresse ou marquez le point sur la carte.",
    },
    locateError: 'Impossible de localiser le point',
    notConfigured: "La carte n'est pas configurée: l'adresse se saisit manuellement et la position ne peut pas être exigée.",
    myLocation: 'Ma position',
    point: 'Point: {point}',
    tapToMark: {
      access: "Touchez la carte pour marquer le point d'accès",
      site: 'Touchez la carte pour marquer le point du site',
    },
    findingAddress: "recherche de l'adresse…",
    locateWritten: "Localiser l'adresse saisie",
    removePoint: 'Retirer le point',
  },
  map: {
    label: 'Carte: touchez pour marquer le point',
    pin: 'Point marqué',
    loading: 'Chargement de la carte…',
    failed: "La carte n'est pas disponible. Saisissez l'adresse manuellement.",
  },
  search: {
    label: 'Rechercher un lieu ou une adresse',
    clear: 'Effacer la recherche',
    results: 'Lieux trouvés',
    credit: 'Résultats de Google',
    creditNearest: "Les plus proches d'abord · Résultats de Google",
    failed: {
      title: 'Impossible de rechercher',
      hint: 'Vérifiez votre connexion ou marquez le point sur la carte.',
    },
    unavailable: {
      title: 'Aucun résultat',
      hint: "Saisissez l'adresse et marquez le point sur la carte.",
    },
    none: {
      title: 'Aucun résultat',
      hint: 'Essayez une autre adresse ou marquez le point sur la carte.',
    },
  },
} satisfies Translation<typeof es>;
