import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/companyHome';

/** Textos de tablero de la empresa en alemán (de-DE): las mismas llaves que es-MX. */
export default {
  greeting: {
    morning: 'Guten Morgen',
    afternoon: 'Guten Tag',
    evening: 'Guten Abend',
  },
  subtitle: 'Übersicht über Ihre Mitarbeiter und ausstehende Validierungen.',
  registerEmployee: 'Mitarbeiter anlegen',
  loadError: 'Die Übersicht konnte nicht geladen werden',
  kpis: {
    pending: 'Ausstehende Validierungen',
    total: 'Registrierte Mitarbeiter',
    active: 'Aktiv',
    inactive: 'Inaktiv',
  },
  pending: {
    title_one: '{count} Gesichtsregistrierung wartet auf Ihre Validierung',
    title_other: '{count} Gesichtsregistrierungen warten auf Ihre Validierung',
    text: 'Bestätigen Sie die Identität, damit sich die Mitarbeiter identifizieren können.',
    review: 'Jetzt prüfen',
  },
  cards: {
    employees: {
      title: 'Mitarbeiter',
      text: 'Verwalten Sie Ihre Mitarbeiter und deren QR-Codes.',
    },
    newEmployee: {
      title: 'Mitarbeiter anlegen',
      text: 'Erfassen Sie die Daten; das Gesicht wird bei der Anmeldung registriert.',
    },
    validations: {
      title: 'Validierungen',
      text: 'Nehmen Sie die Gesichtsregistrierungen Ihrer Mitarbeiter an oder lehnen Sie sie ab.',
    },
  },
} satisfies Translation<typeof es>;
