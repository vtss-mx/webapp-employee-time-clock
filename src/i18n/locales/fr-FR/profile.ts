import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/profile';

/** Textos de Mi perfil: cuenta, idioma, contraseña y sesiones en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  title: 'Mon profil',
  subtitle: 'Votre compte, votre mot de passe et vos sessions actives',
  refreshFailed: "Impossible d'actualiser vos informations",
  account: {
    title: 'Compte',
    lastLogin: 'Dernière connexion',
    createdAt: 'Création du compte',
  },
  language: {
    title: 'Langue',
  },
  photo: {
    title: 'Photo de profil',
    description:
      'Elle vous identifie dans le menu, sur votre profil et dans les listes de votre entreprise. Elle est stockée chiffrée, sans la position ni les données de la caméra.',
    saveAsk: {
      eyebrow: 'Votre photo de profil',
      titleNew: 'Enregistrer cette photo de profil?',
      titleReplace: 'Changer votre photo de profil?',
      message: 'Voici comment elle apparaîtra sur votre profil, dans le menu et dans les listes de votre entreprise.',
      file: 'Fichier',
      note: "La position et les données de la caméra sont retirées avant l'enregistrement.",
      replaceNote: "Votre photo précédente est supprimée. La position et les données de la caméra sont retirées avant l'enregistrement de la nouvelle.",
      confirm: 'Enregistrer la photo',
    },
    removeAsk: {
      eyebrow: 'Votre photo de profil',
      title: 'Retirer votre photo de profil?',
      message: "Vos initiales s'afficheront à la place.",
      note: 'La photo est supprimée et ne peut pas être récupérée.',
      confirm: 'Retirer la photo',
    },
    saveFailed: "Impossible d'enregistrer votre photo",
    removeFailed: 'Impossible de retirer votre photo',
  },
  password: {
    title: 'Changer le mot de passe',
    current: 'Mot de passe actuel',
    new: 'Nouveau mot de passe',
    confirm: 'Confirmer le nouveau mot de passe',
    submit: 'Mettre à jour le mot de passe',
    submitDisabled: 'Remplissez correctement tous les champs obligatoires',
    currentRequired: 'Saisissez votre mot de passe actuel',
    mustDiffer: "Doit être différent de l'actuel",
    failed: 'Impossible de changer le mot de passe',
    changed: 'Mot de passe mis à jour',
    revoked_zero: 'Votre session actuelle reste active.',
    revoked_one: 'Session fermée sur {count} autre appareil.',
    revoked_other: 'Session fermée sur {count} autres appareils.',
    ask: {
      eyebrow: 'Sécurité de votre compte',
      title: 'Changer votre mot de passe?',
      message: 'Vous vous connecterez désormais avec le nouveau mot de passe.',
      otherDevices: 'Votre session sera fermée sur vos autres appareils.',
      thisDevice: 'Cet appareil restera connecté.',
      confirm: 'Changer le mot de passe',
    },
  },
  sessions: {
    title: 'Sessions actives',
    loadFailed: 'Impossible de charger vos sessions',
    empty: {
      title: 'Aucune session ouverte',
      description: 'Les appareils où votre session est ouverte apparaîtront ici.',
    },
    noun: {
      one: 'session',
      other: 'sessions',
    },
    thisDevice: 'Cet appareil',
    unknownIp: 'IP inconnue',
    activity: '{ip} · Active {ago} · Ouverte le {started}',
    hint: 'Vous ne reconnaissez pas un appareil? Fermez sa session et changez votre mot de passe.',
    revokeAll: 'Se déconnecter de tous les appareils',
    revoke: {
      eyebrow: 'Session active',
      title: 'Fermer la session sur {device}?',
      message: 'Cet appareil devra se reconnecter pour utiliser votre compte.',
      ip: 'IP',
      unknown: 'Inconnue',
      started: 'Ouverte le',
      failed: 'Impossible de fermer la session',
      done: 'Session fermée',
      doneText: 'Cet appareil devra se reconnecter.',
    },
    revokeAllAsk: {
      eyebrow: 'Toutes vos sessions',
      title: 'Vous déconnecter de tous vos appareils?',
      message: 'Y compris cet appareil: vous devrez vous reconnecter.',
      confirm: 'Tout déconnecter',
      failed: 'Impossible de vous déconnecter de tous les appareils',
    },
  },
} satisfies Translation<typeof es>;
