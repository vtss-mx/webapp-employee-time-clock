import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/employee';

/** Textos de pantallas del empleado (verificación, registro facial, mi QR) en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  menu: {
    eyebrow: 'Identification',
    hello: 'Bonjour {name}',
    helloAnonymous: 'Bonjour',
    question: 'Comment souhaitez-vous vous identifier?',
    face: 'VÉRIFIER AVEC LE VISAGE',
    faceLiveness: 'Reconnaissance faciale avec détection du vivant',
    faceOnly: 'Reconnaissance faciale',
    start: 'Commencer',
    qr: 'AFFICHER MON QR',
    qrText: "Présentez-le au validateur: il change toutes les {seconds} s et ne sert qu'une fois",
    show: 'Afficher',
    footer: 'Identité validée par votre entreprise · Connexion sécurisée',
  },
  verify: {
    title: 'Vérification faciale',
    submitting: 'Vérification de votre identité…',
    failed: 'Impossible de vérifier votre identité',
    showQr: 'Afficher mon code QR',
  },
  enrollment: {
    title: 'Enregistrement du visage',
    tips: {
      light: 'Placez-vous dans un endroit bien éclairé.',
      front: 'Regardez la caméra de face, le visage découvert.',
    },
    rejected: {
      title: 'Votre enregistrement précédent a été refusé',
      reason: 'Motif: «{reason}».',
      noReason: "Votre entreprise n'a pas pu valider votre identité avec les captures envoyées.",
    },
    reverify: {
      title: 'Vérifiez de nouveau votre identité',
      eyebrow: 'Demande de votre entreprise',
      step: 'Enregistrez votre visage avec détection du vivant; cela prend environ une minute.',
    },
    confirm: {
      replaces: 'Votre enregistrement précédent sera remplacé par celui-ci.',
      replacesPhoto: 'Votre photo initiale précédente sera remplacée par celle-ci.',
      open: 'Ouvrir la caméra',
      photo: {
        title: 'Prendre votre photo initiale?',
        message: "La caméra va s'ouvrir pour prendre une photo de votre visage de face. Elle est conservée chiffrée pour votre enregistrement.",
      },
      captures: {
        title: 'Commencer les captures?',
        message: "La caméra va s'ouvrir pour prendre {count} captures de votre visage et effectuer la détection du vivant.",
      },
      video: {
        title: 'Enregistrer la vidéo?',
        message_one: "La caméra et le micro vont s'ouvrir pour répondre à {count} question en vidéo.",
        message_other: "La caméra et le micro vont s'ouvrir pour répondre à {count} questions en vidéo.",
      },
    },
    submitting: 'Envoi de votre enregistrement…',
    sent: {
      title: 'Enregistrement envoyé',
      text: 'Votre entreprise validera bientôt votre identité.',
      offline: "Votre entreprise validera bientôt votre identité. L'écran se mettra à jour au retour de la connexion.",
    },
    fatal: "Impossible de terminer l'enregistrement",
    again: 'Enregistrez de nouveau votre visage',
    welcome: 'Bienvenue, {name}',
    intro: "Pour protéger votre identité, enregistrez votre visage. Cela ne se fait qu'une fois et votre entreprise le validera.",
    after: {
      title: 'Ensuite: validation par votre entreprise',
      text: "Votre entreprise examine et approuve votre identité; vous verrez le résultat dans l'application.",
    },
    before: 'Avant de commencer:',
    privacy: 'Vos photos, votre vidéo et votre voix sont conservées chiffrées et revues uniquement par votre entreprise ; elles ne sont jamais partagées.',
    /** Los cuatro pasos del registro (decisión del dueño, 2026-10-06), en el indicador sobre el visor. */
    steps: {
      label: 'Étape {current} sur {total}',
      photo: 'Photo initiale',
      captures: 'Captures',
      video: 'Vidéo',
      done: 'Terminé',
    },
    /** Mientras se guarda la foto inicial (paso 1). */
    photoSaving: 'Enregistrement de votre photo…',
    /** El índice de los pasos independientes (decisión del dueño, 2026-10-07): estado, aviso y botón de cada uno. */
    index: {
      steps_one: '{count} étape',
      steps_other: '{count} étapes',
      resume: "Suivez les étapes dans l'ordre. Vous pouvez vous arrêter après n'importe laquelle et reprendre un autre jour. Ce que vous avez fait est conservé.",
      errorTitle: 'Impossible de charger votre enregistrement',
      label: "Étapes de l'enregistrement du visage",
      photo: {
        title: 'Photo initiale',
        text: 'Une photo de votre visage de face, avec un bon éclairage.',
      },
      captures: {
        title: 'Captures et détection du vivant',
        text: '{count} captures de votre visage et quatre mouvements de la tête.',
      },
      video: {
        title: 'Vidéo avec questions',
        text: 'Répondez à voix haute à des questions sur vos données, en regardant la caméra.',
      },
      state: {
        pending: 'En attente',
        done: 'Terminée · {date}',
        complete: 'Terminée',
        locked: 'Bloquée',
        expired: 'Expirée',
        exhausted: 'Tentatives épuisées',
        answered: '{answered} réponses sur {total}',
      },
      hint: {
        validUntil: "Valable jusqu'au {date}",
        expired: 'Votre photo a expiré. Reprenez-la.',
        needsPhoto: "Prenez d'abord votre photo initiale.",
        needsCaptures: "Terminez d'abord les captures.",
        exhausted: 'Les tentatives sont épuisées. Reprenez la photo initiale et les captures.',
      },
      action: {
        photo: 'Prendre la photo',
        retakePhoto: 'Reprendre la photo',
        captures: 'Commencer les captures',
        video: 'Enregistrer la vidéo',
        resumeVideo: 'Continuer la vidéo',
      },
    },
    /** Una pantalla de un paso que se abrió fuera de orden: qué falta (su vacío). */
    blocked: {
      back: "Retour à l'enregistrement",
      photoUsed: {
        title: 'Photo initiale prête',
        text: "Elle a déjà servi pour vos captures. Passez à l'étape suivante.",
      },
      needsPhoto: {
        title: 'Photo initiale manquante',
        text: 'Prenez votre photo initiale avant les captures.',
      },
      capturesDone: {
        title: 'Captures prêtes',
        text: "Elles ont déjà été envoyées. Passez à l'étape suivante.",
      },
      needsCaptures: {
        title: 'Captures manquantes',
        text: 'Terminez les captures avant la vidéo.',
      },
      exhausted: {
        title: 'Tentatives épuisées',
        text: 'Reprenez la photo initiale et les captures pour réessayer.',
      },
      noVideo: {
        title: 'Pas de vidéo',
        text: 'Votre entreprise ne demande pas la vidéo avec questions.',
      },
    },
  },
  myQr: {
    errorTitle: 'Impossible de générer votre code QR',
    alt: 'Code QR de {name}',
    eyebrow: 'Badge numérique',
    title: 'Mon code QR',
    intro: "Présentez-le au validateur pour vous identifier. Il change toutes les {seconds} s et ne sert qu'une fois.",
    validated: 'Identité validée',
    employeeNumber: 'Matricule {number}',
    enlarge: 'Afficher en grand',
    another: 'En générer un autre',
    brightness: "Augmentez la luminosité de votre écran pour qu'il soit lu plus vite.",
    singleUse:
      "Chaque code ne sert qu'une fois et expire en quelques secondes: une photo ou une capture d'écran ne fonctionne pas. Il ne contient aucune de vos données personnelles ni biométriques.",
    brightnessLarge: "Augmentez la luminosité pour qu'il soit lu instantanément.",
  },
  pending: {
    errorTitle: 'Impossible de mettre à jour le statut',
    title: 'Votre identité est en cours de validation',
    text: "{name}, votre enregistrement du visage a été envoyé. Un administrateur de votre entreprise va l'examiner; vous verrez ici quand il sera approuvé.",
    sent: {
      title: 'Enregistrement du visage envoyé',
      text: 'Visage, détection du vivant et qualité vérifiés.',
    },
    review: {
      title: 'Validation par votre entreprise',
      text: "Un administrateur confirme qu'il s'agit bien de vous.",
    },
    access: {
      title: 'Accès activé',
      text: 'Vous pourrez vous identifier avec votre visage ou votre code QR.',
    },
    refresh: 'Actualiser le statut',
    auto: "Cet écran s'actualise automatiquement.",
  },
} satisfies Translation<typeof es>;
