import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/devices';

/** Dispositivos de un empleado (antifraude 1b, decisión D2) en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  title: 'Appareils',
  intro:
    "Navigateurs et téléphones depuis lesquels cette personne a pointé ou vérifié son identité, chacun avec une clé impossible à copier. Selon la politique, un appareil non approuvé exige une étape supplémentaire ou soumet ses pointages à examen.",
  mineTitle: 'Mes appareils',
  mineIntro:
    'Les navigateurs ou téléphones depuis lesquels vous avez pointé ou vérifié votre identité. Votre entreprise peut les approuver ou les révoquer.',
  empty: {
    title: 'Aucun appareil',
    description: 'Les navigateurs et téléphones utilisés pour pointer apparaîtront ici.',
  },
  noun: {
    one: 'appareil',
    other: 'appareils',
  },
  firstSeen: 'Première utilisation: {date}',
  lastSeen: 'dernière utilisation: {date}',
  uses_one: '{count} utilisation',
  uses_other: '{count} utilisations',
  steppedUp: 'a franchi une étape supplémentaire le {date}',
  reviewedBy: 'Décision de {name}',
  loadError: 'Impossible de charger les appareils',
  error: "Impossible de mettre à jour l'appareil",
  eyebrow: "Appareil de l'employé",
  actionLabel: '{action}: {name}',
  approve: {
    label: 'Approuver',
    title: 'Approuver «{name}»?',
    message:
      "Ses pointages ne seront plus soumis à examen et n'exigeront plus d'étape supplémentaire à cause de l'appareil. Le reste du moteur de risque ne change pas.",
  },
  revoke: {
    label: 'Révoquer',
    title: 'Révoquer «{name}»?',
    message:
      'Il sera de nouveau traité comme un appareil inconnu: selon la politique, ses pointages exigeront une étape supplémentaire ou seront soumis à examen.',
  },
} satisfies Translation<typeof es>;
