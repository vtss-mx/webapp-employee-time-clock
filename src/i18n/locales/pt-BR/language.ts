import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/language';

/** Textos del selector de idioma en portugués de Brasil (pt-BR). */
export default {
  label: 'Idioma',
  hintAccount: 'Vale para todos os seus dispositivos.',
  hintDevice: 'Fica salvo neste dispositivo.',
  saveFailed: 'Não foi possível salvar seu idioma',
  loadFailed: 'Não foi possível alterar o idioma',
} satisfies Translation<typeof es>;
