import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/companyHome';

/** Textos de tablero de la empresa en francés (fr-FR): las mismas llaves que es-MX. */
export default {
  greeting: {
    morning: 'Bonjour',
    afternoon: 'Bon après-midi',
    evening: 'Bonsoir',
  },
  subtitle: 'Aperçu de vos employés et des validations en attente.',
  registerEmployee: 'Ajouter un employé',
  loadError: 'Impossible de charger le récapitulatif',
  kpis: {
    pending: 'Validations en attente',
    total: 'Employés enregistrés',
    active: 'Actifs',
    inactive: 'Inactifs',
  },
  pending: {
    title_one: '{count} enregistrement du visage attend votre validation',
    title_other: '{count} enregistrements du visage attendent votre validation',
    text: "Confirmez l'identité pour que les employés puissent s'identifier.",
    review: 'Examiner maintenant',
  },
  cards: {
    employees: {
      title: 'Employés',
      text: 'Consultez et gérez vos employés et leurs codes QR.',
    },
    newEmployee: {
      title: 'Ajouter un employé',
      text: "Saisissez ses informations; son visage est enregistré lorsqu'il se connecte.",
    },
    validations: {
      title: 'Validations',
      text: 'Acceptez ou refusez les enregistrements du visage de vos employés.',
    },
  },
} satisfies Translation<typeof es>;
