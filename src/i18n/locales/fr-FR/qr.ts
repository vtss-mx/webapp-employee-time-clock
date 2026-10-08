import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/qr';

/** Textos de QR dinámico del empleado y lector de QR en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  dynamic: {
    used: {
      title: 'Code utilisé',
      text: "Génération d'un nouveau code…",
    },
    replaced: {
      title: 'Code remplacé',
      text: "Un autre code a été généré sur un autre appareil ou votre entreprise l'a invalidé.",
      action: 'Afficher un nouveau code',
    },
    paused: {
      title: 'En pause',
      text: 'Il a expiré pendant que vous ne le regardiez pas.',
      action: 'Afficher le code',
    },
    error: 'Impossible de générer votre code',
    imageError: "Impossible d'afficher votre code QR",
    enlarge: 'Agrandir le code QR',
    renewsIn: 'Renouvelé dans {seconds}',
    seconds: '{value} s',
  },
  scan: {
    aim: 'Orientez la caméra vers le code QR',
    busy: 'QR détecté. Vérification…',
    invalid: 'QR non valide. Utilisez le code généré pour votre compte',
    noPersonalData: 'Le code ne contient aucune donnée personnelle.',
  },
  panel: {
    title: 'Code QR dynamique',
    errorTitle: "Impossible de charger l'activité du QR",
    live: "À l'écran",
    none: 'Aucun code en vigueur',
    intro: "L'employé le génère sur son téléphone (Mon code QR). Il change toutes les {seconds} s et ne sert qu'une fois: il ne peut être ni téléchargé ni imprimé.",
    liveUntil: "Valable jusqu'à",
    lastIssued: 'Dernière génération',
    lastUsed: 'Dernière utilisation',
    never: 'Jamais',
    revoke: {
      action: 'Invalider le code en vigueur',
      eyebrow: 'Code QR',
      title: 'Invalider le code en vigueur?',
      message: "Le code affiché à l'écran de l'employé cessera immédiatement de fonctionner. Il pourra en afficher un nouveau sur son téléphone.",
      confirm: 'Invalider',
      error: "Impossible d'invalider le code",
      done: 'Code invalidé',
      doneText: "L'employé peut en afficher un nouveau sur son téléphone.",
    },
  },
  phoneGuide: {
    open: 'Ouvrez la tablette ou le téléphone.',
    openHow: 'Utilisez le navigateur (Safari, Chrome…) ou la caméra.',
    scanOrType: '{scan} ou saisissez cette adresse:',
    scanCode: 'Scannez le code',
    copyAddress: "Copier l'adresse",
    enterAddress: '{address} fournie par votre entreprise.',
    accessAddress: "Ouvrez l'adresse d'accès",
    signIn: '{action} avec le même e-mail et le même mot de passe.',
    signInAction: 'Connectez-vous',
    scan: 'Scannez-le avec la tablette ou le téléphone',
    qrAlt: "Code QR pour ouvrir l'application. Scannez-le avec la tablette ou le téléphone",
    desktopSite: 'Vous êtes déjà sur une tablette ou un téléphone? Désactivez {option} dans le menu du navigateur et réessayez.',
    desktopSiteOption: '«Version pour ordinateur»',
  },
} satisfies Translation<typeof es>;
