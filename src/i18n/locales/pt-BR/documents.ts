import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/documents';

/** Textos de los documentos de una empresa en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  title: 'Documentos',
  count_one: '{count} documento · para o faturamento da sua empresa',
  count_other: '{count} documentos · para o faturamento da sua empresa',
  noun: {
    one: 'documento',
    other: 'documentos',
  },
  loadError: 'Não foi possível carregar os documentos',
  add: 'Enviar documento',
  columns: {
    file: 'Documento',
    type: 'Tipo',
    size: 'Tamanho',
    uploaded: 'Enviado',
    note: 'Observação',
    actions: 'Ações',
  },
  platform: 'Plataforma',
  platformHint: 'Enviado pelo administrador da plataforma',
  empty: {
    title: 'Sem documentos',
    description: 'Envie a certidão fiscal ou outro documento para começar.',
  },
  download: 'Baixar',
  downloadLabel: 'Baixar {name}',
  downloadError: 'Não foi possível baixar o documento',
  deleteLabel: 'Excluir {name}',
  deleteError: 'Não foi possível excluir o documento',
  remove: {
    title: 'Excluir {name}?',
    message: 'Não poderá ser baixado enquanto estiver em “Excluídos”.',
  },
  restoreTitle: 'Restaurar {name}?',
  upload: {
    title: 'Enviar documento',
    subtitle: 'Fica guardado criptografado e só pode ser baixado pelo aplicativo.',
    fileSection: 'Arquivo',
    fileLabel: 'Documento',
    hint: 'PDF, Word, Excel, XML, JPG ou PNG de até {max}.',
    dataSection: 'Dados do documento',
    typeLabel: 'Tipo de documento',
    typePlaceholder: 'Escolha o tipo',
    noteHint: 'Opcional · Visível para a empresa e a plataforma.',
    uploading: 'Enviando o documento…',
    error: 'Não foi possível enviar o documento',
    confirm: {
      title: 'Enviar {name}?',
      message: 'Será guardado criptografado nos documentos da empresa.',
      detailsTitle: 'Será enviado',
      file: 'Arquivo',
    },
    errors: {
      fileMissing: 'Escolha o arquivo que será enviado.',
      type: 'Escolha um arquivo PDF, Word, Excel, XML, JPG ou PNG.',
      empty: 'O arquivo está vazio. Escolha outro.',
      size: 'O arquivo tem {size} e o máximo é {max}.',
      typeMissing: 'Escolha o tipo de documento.',
    },
  },
} satisfies Translation<typeof es>;
