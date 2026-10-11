import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/auth';

/** Textos de inicio de sesión, cuenta recordada, dispositivo, empresa suspendida y cierre de sesión en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  layout: {
    copyright: '© {year} {app}. Tous droits réservés.',
  },
  login: {
    title: 'Connexion',
    emailPlaceholder: 'vous@entreprise.com',
    password: 'Mot de passe',
    passwordRequired: 'Le mot de passe est obligatoire',
    remembered: 'Compte mémorisé sur cet appareil.',
    useOtherAccount: 'Utiliser un autre compte',
    remember: 'Mémoriser mon compte',
    rememberHint: "Gardez la session ouverte sur cet appareil. Ne l'utilisez pas sur un ordinateur partagé.",
    submit: 'Se connecter',
    submitDisabled: 'Saisissez votre e-mail et votre mot de passe',
    locating: 'Vérification de votre position…',
    failed: 'Impossible de se connecter',
    switchFailed: 'Impossible de changer de compte',
    sessionEnded: 'Votre session a pris fin',
  },
  session: {
    expired: 'Votre session a expiré. Reconnectez-vous.',
  },
  password: {
    new: 'Nouveau mot de passe',
    hint: 'Au moins 12 caractères, avec une majuscule, une minuscule et un chiffre',
  },
  mfa: {
    eyebrow: 'Second facteur',
    title: "Connectez-vous avec votre clé d'accès",
    step: "Utilisez le bouton « Se connecter avec une clé d'accès ».",
  },
  locked: {
    eyebrow: 'Compte bloqué',
    title: 'Trop de tentatives',
    wait: 'Attendez {value} avant de réessayer.',
    passkey: "Avec une clé d'accès, vous pouvez vous connecter maintenant.",
  },
  device: {
    eyebrow: 'Appareil',
    unsupported: "Impossible d'enregistrer l'appareil",
    titles: {
      DEVICE_PENDING_APPROVAL: "Appareil en attente d'autorisation",
      DEVICE_REJECTED: 'Appareil non autorisé',
      DEVICE_REVOKED: 'Autorisation retirée',
      DEVICE_PROOF_INVALID: "Impossible de vérifier l'appareil",
    },
    pendingSteps: {
      ask: "Demandez à un administrateur de votre entreprise d'ouvrir Validateurs › Appareils.",
      authorize: "Qu'il autorise cet appareil (il apparaît avec le nom de ce navigateur).",
      retry: 'Reconnectez-vous ici même.',
    },
  },
  deviceBlock: {
    eyebrow: 'Vous utilisez un ordinateur',
    title: 'Continuez sur une tablette ou un téléphone',
    footnote: "Besoin d'aide? Contactez l'administrateur de votre entreprise.",
  },
  suspension: {
    badge: 'Accès suspendu',
    title: 'Votre entreprise est suspendue',
    footnote: "Pour la réactiver, contactez l'administrateur de la plateforme.",
    exit: 'Retour à la connexion',
  },
  logout: {
    title: 'Se déconnecter?',
    thisDevice: 'Cet appareil',
    lastLogin: 'Dernière connexion',
    stay: 'Rester connecté',
    everywhere: 'Me déconnecter de tous mes appareils',
    everywhereFailed: 'Impossible de vous déconnecter de tous les appareils',
    consequence: {
      EMPLOYEE: 'Vous devrez vous reconnecter pour vous identifier ou afficher votre code QR.',
      VALIDATOR: "Ce point de contrôle cessera d'identifier le personnel jusqu'à ce que quelqu'un se reconnecte sur cet appareil.",
      COMPANY: 'Votre travail est enregistré. Vous devrez vous reconnecter pour gérer votre entreprise.',
      ADMIN: 'Votre travail est enregistré. Vous devrez vous reconnecter pour gérer la plateforme.',
    },
  },
  companySelect: {
    title: 'Choisissez votre entreprise',
    intro_one: 'Vous travaillez dans {count} entreprise avec le compte {email}.',
    intro_other: 'Vous travaillez dans {count} entreprises avec le compte {email}.',
    companyInactive: 'Entreprise désactivée',
    accessInactive: 'Votre accès est désactivé',
    current: 'Entreprise actuelle · {note}',
    entering: 'Ouverture',
    enterFailed: "Impossible d'ouvrir {company}",
  },
} satisfies Translation<typeof es>;
