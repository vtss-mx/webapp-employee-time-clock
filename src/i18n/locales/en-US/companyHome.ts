import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/companyHome';

/** Textos de tablero de la empresa en inglés (en-US): las mismas llaves que es-MX. */
export default {
  greeting: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  },
  subtitle: 'Your employees and pending validations at a glance.',
  registerEmployee: 'Add employee',
  loadError: "Couldn't load the summary",
  kpis: {
    pending: 'Pending validations',
    total: 'Registered employees',
    active: 'Active',
    inactive: 'Inactive',
  },
  pending: {
    title_one: '{count} face enrollment is awaiting your validation',
    title_other: '{count} face enrollments are awaiting your validation',
    text: 'Confirm their identity so employees can identify themselves.',
    review: 'Review now',
  },
  cards: {
    employees: {
      title: 'Employees',
      text: 'View and manage your employees and their QR codes.',
    },
    newEmployee: {
      title: 'Add employee',
      text: 'Enter their details; their face is enrolled when they sign in.',
    },
    validations: {
      title: 'Validations',
      text: "Accept or reject your employees' face enrollments.",
    },
  },
} satisfies Translation<typeof es>;
