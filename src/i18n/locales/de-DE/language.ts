import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/language';

/** Textos del selector de idioma en alemán (de-DE). */
export default {
  label: 'Sprache',
  hintAccount: 'Gilt auf allen Ihren Geräten.',
  hintDevice: 'Wird auf diesem Gerät gespeichert.',
  saveFailed: 'Ihre Sprache konnte nicht gespeichert werden',
  loadFailed: 'Die Sprache konnte nicht geändert werden',
} satisfies Translation<typeof es>;
