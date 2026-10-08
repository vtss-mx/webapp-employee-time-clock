import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/companyHome';

/** Textos de tablero de la empresa en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  greeting: {
    morning: 'Buongiorno',
    afternoon: 'Buon pomeriggio',
    evening: 'Buonasera',
  },
  subtitle: 'Riepilogo dei tuoi dipendenti e delle convalide in sospeso.',
  registerEmployee: 'Registra dipendente',
  loadError: 'Impossibile caricare il riepilogo',
  kpis: {
    pending: 'Convalide in sospeso',
    total: 'Dipendenti registrati',
    active: 'Attivi',
    inactive: 'Inattivi',
  },
  pending: {
    title_one: '{count} registrazione del volto attende la tua convalida',
    title_other: '{count} registrazioni del volto attendono la tua convalida',
    text: "Conferma l'identità perché i dipendenti possano identificarsi.",
    review: 'Rivedi ora',
  },
  cards: {
    employees: {
      title: 'Dipendenti',
      text: 'Consulta e gestisci i tuoi dipendenti e i loro codici QR.',
    },
    newEmployee: {
      title: 'Registra dipendente',
      text: 'Inserisci i suoi dati; il volto si registra al primo accesso.',
    },
    validations: {
      title: 'Convalide',
      text: 'Accetta o rifiuta le registrazioni del volto dei tuoi dipendenti.',
    },
  },
} satisfies Translation<typeof es>;
