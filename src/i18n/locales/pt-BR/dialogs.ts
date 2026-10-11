import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/dialogs';

/** Textos de popups de mensajes y confirmaciones, formularios con motivo en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  hero: {
    error: 'Erro',
    warning: 'Atenção',
    info: 'Informação',
    success: 'Pronto',
  },
  confirm: {
    eyebrow: {
      create: 'Novo registro',
      edit: 'Confirmar alterações',
      delete: 'Excluir',
      action: 'Confirmação',
    },
    changes: 'Alterações',
    changeCount_one: '{count} alteração',
    changeCount_other: '{count} alterações',
    before: 'Antes:',
    after: 'Depois:',
    details: 'Detalhes',
    typeToConfirm: 'Digite “{text}” para confirmar',
  },
} satisfies Translation<typeof es>;
