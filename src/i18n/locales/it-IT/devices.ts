import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/devices';

/** Dispositivos de un empleado (antifraude 1b, decisión D2) en italiano (it-IT): las mismas llaves que es-MX. */
export default {
  title: 'Dispositivi',
  intro:
    'Browser e telefoni da cui ha verificato la propria identità, ciascuno con una chiave che non si può copiare. In base ai criteri, uno non approvato richiede un passaggio in più o manda le sue registrazioni in revisione.',
  mineTitle: 'I miei dispositivi',
  mineIntro: 'I browser o i telefoni da cui hai verificato la tua identità. La tua azienda può approvarli o revocarli.',
  empty: {
    title: 'Nessun dispositivo',
    description: "Qui vedrai i browser e i telefoni usati per verificare l'identità.",
  },
  noun: {
    one: 'dispositivo',
    other: 'dispositivi',
  },
  firstSeen: 'Primo utilizzo: {date}',
  lastSeen: 'ultimo utilizzo: {date}',
  uses_one: '{count} utilizzo',
  uses_other: '{count} utilizzi',
  steppedUp: 'ha superato un passaggio in più il {date}',
  reviewedBy: 'Deciso da {name}',
  loadError: 'Impossibile caricare i dispositivi',
  error: 'Impossibile aggiornare il dispositivo',
  eyebrow: 'Dispositivo del dipendente',
  actionLabel: '{action}: {name}',
  approve: {
    label: 'Approva',
    title: 'Approvare «{name}»?',
    message: 'Le sue registrazioni non andranno più in revisione né richiederanno un passaggio in più a causa del dispositivo. Il resto del motore di rischio resta invariato.',
  },
  revoke: {
    label: 'Revoca',
    title: 'Revocare «{name}»?',
    message: 'Tornerà a essere trattato come un dispositivo sconosciuto: in base ai criteri, le sue registrazioni richiederanno un passaggio in più o andranno in revisione.',
  },
} satisfies Translation<typeof es>;
