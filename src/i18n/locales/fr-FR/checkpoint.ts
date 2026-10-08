import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/checkpoint';

/** Textos de punto de control del validador en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  errorTitle: 'Impossible de charger le point de contrôle',
  question: 'Choisissez comment identifier la personne suivante.',
  start: 'Commencer',
  footer: 'Seuls les employés actifs de {company} sont identifiés · Chaque tentative est consignée dans le journal',
  notIdentified: 'Employé non identifié',
  failed: "Impossible d'identifier la personne",
  invalidQr: "QR non valide. Demandez à l'employé de présenter son code depuis l'application",
  qrDisabled: {
    title: 'Identification par QR désactivée',
    text: "Ce validateur utilise le mode «{mode}», mais votre entreprise a désactivé le QR. Demandez à un administrateur de l'activer ou de changer de mode.",
  },
  face: {
    title: 'Reconnaître le visage',
    submitting: 'Identification…',
    useQr: 'Utiliser son code QR',
  },
  qr: {
    title: 'Scanner le QR',
    text: "Orientez la caméra vers le QR du téléphone de l'employé. Il est lu automatiquement et ne sert qu'une fois.",
    busy: 'QR détecté. Identification…',
  },
  qrFace: {
    qrTitle: 'Étape 1 sur 2 · Code QR',
    qrText: "Scannez le QR du téléphone de l'employé. Son visage sera ensuite confirmé.",
    busy: "QR détecté. Recherche de l'employé…",
    faceTitle: 'Étape 2 sur 2 · {name}',
  },
  recent: {
    title: 'Dernières identifications',
    errorTitle: 'Impossible de charger les identifications récentes',
    emptyTitle: 'Aucune identification',
    emptyDescription: 'Les personnes identifiées par cet appareil apparaîtront ici.',
    nounOne: 'identification',
    nounOther: 'identifications',
    identified: 'Identifié',
    notIdentified: 'Non identifié',
  },
} satisfies Translation<typeof es>;
