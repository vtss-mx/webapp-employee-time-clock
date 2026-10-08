import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/language';

/** Textos del selector de idioma en francés (fr-FR). */
export default {
  label: 'Langue',
  hintAccount: "S'applique sur tous vos appareils.",
  hintDevice: 'Mémorisée sur cet appareil.',
  saveFailed: "Impossible d'enregistrer votre langue",
  loadFailed: 'Impossible de changer de langue',
} satisfies Translation<typeof es>;
