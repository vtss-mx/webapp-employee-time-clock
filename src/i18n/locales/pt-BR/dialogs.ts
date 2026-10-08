import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/dialogs';

/** Textos de popups de mensajes y confirmaciones, formularios con motivo y resultados masivos en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
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
  bulk: {
    employeeNumber: 'Matrícula {number}',
    more: 'e mais {count}',
    withOmissions: '{title} com omissões',
  },
  reject: {
    back: 'Solicitações',
    noteLabel: 'Observação para o funcionário',
    noteShown: 'Observação que ele verá',
    noteTooShort: 'Explique o motivo (pelo menos {min} caracteres). O funcionário verá a observação.',
    errorTitle: 'Não foi possível rejeitar a solicitação',
  },
} satisfies Translation<typeof es>;
