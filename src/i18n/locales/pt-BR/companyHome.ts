import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/companyHome';

/** Textos de tablero de la empresa en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  greeting: {
    morning: 'Bom dia',
    afternoon: 'Boa tarde',
    evening: 'Boa noite',
  },
  subtitle: 'Resumo dos seus funcionários e das validações pendentes.',
  registerEmployee: 'Cadastrar funcionário',
  loadError: 'Não foi possível carregar o resumo',
  kpis: {
    pending: 'Validações pendentes',
    total: 'Funcionários cadastrados',
    active: 'Ativos',
    inactive: 'Inativos',
  },
  pending: {
    title_one: '{count} cadastro facial aguarda sua validação',
    title_other: '{count} cadastros faciais aguardam sua validação',
    text: 'Confirme a identidade para que os funcionários possam se identificar.',
    review: 'Revisar agora',
  },
  cards: {
    employees: {
      title: 'Funcionários',
      text: 'Consulte e gerencie seus funcionários e os códigos QR deles.',
    },
    newEmployee: {
      title: 'Cadastrar funcionário',
      text: 'Informe os dados; o rosto é cadastrado quando a pessoa entra no sistema.',
    },
    validations: {
      title: 'Validações',
      text: 'Aprove ou rejeite os cadastros faciais dos seus funcionários.',
    },
  },
} satisfies Translation<typeof es>;
