import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/policy';
import antifraud from './policy/antifraud';
import tuning from './policy/tuning';

/** Textos de política de verificación y ajustes de la prueba de vida de una empresa en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  loadError: 'Impossible de charger la politique de vérification',
  title: "Politique de vérification d'identité",
  saveError: "Impossible d'enregistrer",
  recommended: 'Recommandé',
  appliesTo: "S'applique en quelques secondes à tout le personnel de {company}.",
  confidence: {
    title: 'Niveau de confiance',
    intro: "Probabilité minimale que la personne devant la caméra soit l'employé enregistré.",
    identifyIntro:
      "{lead} (validateurs): vous pouvez exiger davantage, car rechercher parmi un grand nombre de personnes augmente les fausses correspondances. Il ne s'applique jamais en dessous du niveau précédent.",
    identifyLead: "Lors de l'identification parmi tous les employés",
    identifyLabel: 'Niveau de confiance pour identifier parmi tous les employés',
    saved: 'Niveau de confiance mis à jour',
    savedText: '{value} sera exigé à chaque vérification faciale.',
    identifySaved: "Confiance d'identification mise à jour",
    identifySavedText: 'Les validateurs exigeront {value} pour identifier parmi tous les employés.',
  },
  sections: {
    face: {
      title: 'Exigences pour le visage',
      hint: "Ce que la personne doit retirer avant l'analyse. Couvrir le visage réduit la précision.",
    },
    security: {
      title: 'Sécurité',
      hint: "Protections contre l'usurpation d'identité; il est conseillé de les garder activées.",
    },
    locks: {
      title: "Verrous contre l'usurpation",
      hint: 'Chaque verrou bloque une façon différente de tromper la reconnaissance faciale; il est conseillé de les garder tous activés.',
    },
    learning: {
      title: 'Apprentissage continu',
      hint: "Chaque identification sûre apprend l'apparence actuelle de chaque employé. Les échantillons validés par l'entreprise ne sont jamais remplacés.",
    },
    location: {
      title: 'Position des vérifications',
      hint: "Chaque vérification inclut la position du téléphone et l'heure du serveur; ajustez ci-dessous la précision et la vitesse.",
    },
    methods: {
      title: "Méthodes d'identification",
      hint: "Façons dont les employés peuvent s'identifier.",
    },
    antifraud: {
      title: 'Antifraude',
      hint: "En cas de doute, le moteur exige une étape supplémentaire ou soumet la vérification à l'examen de l'entreprise. Les preuves des tentatives suspectes ne sont visibles que par l'administrateur dans «Cas de fraude».",
    },
    capture: {
      title: 'Protocole de capture',
      hint: "Contrôles en temps réel contre les vidéos injectées. Pour l'instant, ils mesurent seulement.",
    },
    devices: {
      title: 'Appareils des validateurs',
      hint: "Seuls les validateurs ont des restrictions; les employés et les administrateurs utilisent n'importe quel appareil.",
    },
  },
  accessories: {
    remove: 'Retirer {phrase}',
    blockGlasses: {
      on: 'Il sera demandé de retirer les lunettes (y compris les lunettes de soleil).',
      off: "L'identification avec des lunettes est autorisée.",
    },
    blockHeadwear: {
      on: 'Il sera demandé de retirer casquettes, chapeaux et visières (sauf pour les employés dispensés pour raisons religieuses ou médicales).',
      off: "L'identification avec un couvre-chef est autorisée.",
    },
    blockMask: {
      on: 'Il sera demandé de retirer le masque (vérification physique du nez et des joues).',
      off: "L'identification avec un masque est autorisée (précision moindre).",
    },
  },
  options: {
    livenessChallenge: {
      label: 'Détection du vivant',
      on: 'La personne fait des mouvements de tête aléatoires.',
      off: 'Sans défi de mouvements.',
    },
    enableTurnRight: {
      label: 'Tourner à droite',
      on: 'La détection du vivant peut demander de tourner la tête à droite.',
      off: 'La détection du vivant ne demande pas de tourner à droite.',
    },
    enableTurnLeft: {
      label: 'Tourner à gauche',
      on: 'La détection du vivant peut demander de tourner la tête à gauche.',
      off: 'La détection du vivant ne demande pas de tourner à gauche.',
    },
    enableLookUp: {
      label: 'Regarder vers le haut',
      on: 'La détection du vivant peut demander de regarder vers le haut.',
      off: 'La détection du vivant ne demande pas de regarder vers le haut.',
    },
    enableLookDown: {
      label: 'Regarder vers le bas',
      on: 'La détection du vivant peut demander de regarder vers le bas.',
      off: 'La détection du vivant ne demande pas de regarder vers le bas.',
    },
    antiSpoofing: {
      label: "Détection d'usurpation",
      on: 'Détecte les photos imprimées, les écrans et les vidéos devant la caméra.',
      off: 'Les photos et les écrans ne sont pas analysés.',
    },
    blockVirtualCameras: {
      label: 'Bloquer les caméras virtuelles',
      on: 'Les programmes qui se font passer pour une caméra (OBS, ManyCam…) sont refusés.',
      off: 'Toute caméra est acceptée, y compris les caméras virtuelles.',
    },
    rejectForeignImages: {
      label: 'Captures en direct uniquement',
      on: 'Les images de la galerie ou retouchées sont refusées.',
      off: 'Les images de la galerie ou retouchées sont acceptées.',
    },
    detectStaticCaptures: {
      label: 'Détecter les photos fixes',
      on: 'Une tentative est refusée si ses captures sont identiques (une photo envoyée plusieurs fois).',
      off: 'Les captures ne sont pas comparées entre elles.',
    },
    detectReplays: {
      label: 'Détecter les captures réutilisées',
      on: "Chaque capture ne sert qu'une fois: le renvoi de captures enregistrées ou interceptées est refusé.",
      off: 'Les captures reçues ne sont pas mémorisées.',
    },
    checkCaptureContinuity: {
      label: 'Exiger une seule prise',
      on: 'Toutes les captures doivent provenir de la même caméra, avec un visage et une lumière continus pendant la rotation.',
      off: 'La caméra, le cadrage et la lumière ne sont pas comparés entre les captures.',
    },
    enforceHumanTiming: {
      label: 'Temps humain dans la détection du vivant',
      on: 'Les réponses au défi plus rapides que ce dont une personne est capable sont refusées (programmes automatiques).',
      off: "Le temps de réponse au défi n'est pas mesuré.",
    },
    detectDuplicateFaces: {
      label: 'Détecter les visages en double',
      on: "Lors de l'enregistrement d'un visage déjà approuvé pour un autre employé: il est signalé pour examen ou, en personne, bloqué.",
      off: "L'enregistrement n'est pas comparé à ceux des autres employés.",
    },
    lockoutEnabled: {
      label: 'Blocage après des tentatives échouées',
      on: "Après plusieurs tentatives échouées ou suspectes consécutives, un blocage temporaire s'applique (ajustez-le ci-dessous).",
      off: "Tentatives illimitées (seule la limite générale de requêtes s'applique).",
    },
    adaptiveLearning: {
      label: 'Apprendre de chaque identification sûre',
      on: 'Apprend uniquement des identifications avec détection du vivant et une confiance confortable (autre éclairage, caméra, coiffure ou barbe).',
      off: 'Chaque employé est comparé uniquement aux échantillons de son enregistrement approuvé.',
    },
    detectImpossibleTravel: {
      label: 'Détecter les trajets impossibles',
      on: 'Une vérification trop éloignée de la précédente pour le temps écoulé est refusée (fausse position ou compte partagé).',
      off: "La position d'une vérification n'est pas comparée à celle de la précédente.",
    },
    qrEnabled: {
      label: 'Vérification par code QR',
      on: "Les employés présentent sur leur téléphone un QR dynamique: il change automatiquement et chaque code ne sert qu'une fois.",
      off: 'Reconnaissance faciale uniquement.',
    },
    validatorDeviceApproval: {
      label: 'Autoriser les appareils des validateurs',
      on: "Chaque tablette ou téléphone d'un validateur doit être autorisé dans Validateurs › Appareils.",
      off: "Les validateurs peuvent se connecter sur n'importe quel appareil avec leur e-mail et leur mot de passe.",
    },
    riskEngine: {
      label: 'Moteur de risque',
      on: 'Chaque tentative est notée selon ses signaux et la décision dépend du niveau de risque (ajustez-le ci-dessous).',
      off: "Seuls les verrous décident; les signaux ne s'additionnent pas.",
    },
    flashPaced: {
      label: 'Flash dicté par le serveur',
      on: 'Chaque couleur est révélée au moment voulu: personne ne peut préparer les captures.',
      off: 'Les couleurs sont envoyées avec le défi.',
    },
    captureBurst: {
      label: 'Rafale de recadrages du visage',
      on: 'Quelques secondes de recadrages sont envoyées pour mesurer le mouvement naturel et la continuité.',
      off: 'Seules les captures isolées sont envoyées.',
    },
    fraudEvidence: {
      label: 'Conserver les preuves des tentatives suspectes',
      on: 'Quelques images chiffrées de chaque tentative suspecte sont conservées pour examiner le cas; elles sont supprimées automatiquement à leur expiration.',
      off: 'Les cas sont ouverts sans images: seulement avec ce qui a été mesuré.',
    },
    voiceVerification: {
      label: 'Vérification vocale et vidéo à l\'enregistrement',
      on: 'Après les photos, l\'employé répond en vidéo à trois questions sur ses données ; la voix et le visage sont comparés sur le serveur et l\'entreprise revoit la vidéo.',
      off: 'L\'enregistrement se termine avec les photos.',
    },
    voiceGuidance: {
      label: 'Guidage vocal',
      on: "Les consignes de l'enregistrement sont lues à voix haute sur l'appareil.",
      off: "L'enregistrement ne lit pas les consignes à voix haute.",
    },
    validatorMobileOnly: {
      label: 'Validateurs sur tablette ou téléphone uniquement',
      on: 'Les validateurs se connectent uniquement sur des tablettes et des téléphones.',
      off: "Les validateurs peuvent aussi opérer depuis un ordinateur équipé d'une caméra.",
    },
  },
  warnings: {
    spoofing: "Cela réduit la protection contre l'usurpation d'identité (photos, écrans ou vidéos).",
    impossibleTravel: 'Une vérification avec une fausse position ou depuis un autre lieu ne sera pas détectée par la distance.',
    deviceApproval: "Toute personne disposant de l'e-mail et du mot de passe d'un validateur pourra opérer depuis n'importe quel appareil.",
    mobileOnly: 'Les validateurs pourront opérer depuis des ordinateurs, dont la caméra est généralement plus facile à tromper avec des photos ou des écrans.',
    riskEngine: "Les signaux ne s'additionneront plus: une tentative présentant plusieurs indices de fraude passera si aucun verrou ne l'arrête à lui seul.",
    captureProtocol: "Une vidéo préparée à l'avance sera plus difficile à détecter.",
    voiceVerification: 'Un enregistrement avec les photos d\'une autre personne n\'aura plus la seconde vérification de la voix et du visage en vidéo.',
  },
  toggle: {
    eyebrow: 'Politique de vérification',
    eyebrowSecurity: 'Protection recommandée',
    activateTitle: 'Activer «{label}»?',
    deactivateTitle: 'Désactiver «{label}»?',
    on: 'Activé',
    off: 'Désactivé',
    activate: 'Activer',
    deactivate: 'Désactiver',
    activated: '{label}: activé',
    deactivated: '{label}: désactivé',
  },
  voice: {
    title: 'Guidage vocal',
    hint: "Lit à voix haute les consignes de l'enregistrement du visage, avec la synthèse vocale de l'appareil.",
    profile: {
      label: 'Voix du guidage',
      description: "Voix qui lit les consignes pendant l'enregistrement.",
      saved: 'Voix du guidage mise à jour',
      savedText: 'Les consignes seront lues avec la voix «{name}».',
      confirmTitle: 'Utiliser la voix «{value}»?',
      confirmLabel: 'Enregistrer la voix',
    },
    preview: 'Tester la voix',
  },
  /** Étapes de l’enregistrement d’identité et leur ordre : l’ADMIN décide lesquelles et dans quel ordre, par entreprise. */
  enrollment: {
    title: 'Étapes de l’enregistrement d’identité',
    hint: 'Choisissez ce qui est demandé à chaque employé et dans quel ordre. L’employé suit les étapes dans cet ordre.',
    label: 'Étapes de l’enregistrement, dans l’ordre',
    required: 'Obligatoire',
    locked: 'Toujours demandée : c’est l’enregistrement que l’entreprise valide.',
    position: 'Étape {position} sur {total}',
    notAsked: 'Non demandée',
    moveUp: 'Monter « {name} »',
    moveDown: 'Descendre « {name} »',
    note: 'L’étape « {step} » est toujours demandée et reste à la fin du parcours.',
    warning: 'Demander moins d’étapes réduit les preuves que la personne est bien celle qu’elle prétend être.',
    confirm: {
      enableTitle: 'Demander « {name} » ?',
      enableText: 'Chaque employé devra terminer « {name} » dans son enregistrement.',
      disableTitle: 'Ne plus demander « {name} » ?',
      moveTitle: 'Déplacer « {name} » à l’étape {position} ?',
      moveText: 'Les mêmes étapes sont demandées, dans un autre ordre.',
      order: 'Ordre de l’enregistrement',
      save: 'Enregistrer l’ordre',
    },
    notice: {
      enabled: '{name} : désormais demandée',
      disabled: '{name} : plus demandée',
      moved: '{name} : déplacée',
      text: 'S’applique à l’enregistrement de qui ne l’a pas encore terminé.',
    },
  },
  tuning,
  ...antifraud,
} satisfies Translation<typeof es>;
