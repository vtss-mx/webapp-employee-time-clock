import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/feedback';

/** Textos de los popups de mensajes y de las confirmaciones en portugués de Brasil (pt-BR). */
export default {
  understood: 'Entendi',
  queue: '{position} de {total}',
  trace: {
    label: 'Código de rastreamento',
    copy: 'Copiar código de rastreamento',
    copied: 'Copiado',
  },
  invalidForm: {
    title: 'Revise os dados',
    text: 'Corrija os campos destacados.',
  },
  noChanges: {
    title: 'Sem alterações',
    text: 'Não há nada para salvar.',
  },
} satisfies Translation<typeof es>;
