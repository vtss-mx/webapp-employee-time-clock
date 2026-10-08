import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/forms';

/** Textos de validaciones del cliente, cambios para confirmar y textos de hooks y utilidades en portugués de Brasil (pt-BR): las mismas llaves que es-MX. */
export default {
  validation: {
    minChars: 'Mínimo de {min} caracteres',
    maxChars: 'Máximo de {max} caracteres',
    email: {
      required: 'O e-mail é obrigatório',
      invalid: 'Informe um e-mail válido',
    },
    password: {
      required: 'A senha é obrigatória',
      lowercase: 'Deve incluir uma letra minúscula',
      uppercase: 'Deve incluir uma letra maiúscula',
      digit: 'Deve incluir um número',
      repeat: 'Repita a senha',
      mismatch: 'As senhas não coincidem',
    },
    name: {
      characters: 'Somente letras, espaços, apóstrofos, pontos e hifens',
    },
    birthDate: {
      required: 'A data de nascimento é obrigatória',
      invalid: 'Data inválida',
      notBeforeToday: 'Deve ser anterior a hoje',
      minAge: 'O funcionário deve ter pelo menos {age} anos',
    },
    employeeNumber: {
      format: '1 a 30 caracteres: letras, números, hífen ou sublinhado',
    },
    rfc: {
      generic: 'O RFC genérico não é válido; informe o RFC real',
      length: 'O RFC de pessoa física tem {length} caracteres; você digitou {current}',
      format: 'Verifique o formato do RFC (por exemplo, {example})',
      date: 'A data do RFC (aammdd) não é válida',
      birthMismatch: 'O RFC indica nascimento em {document}, mas a data de nascimento é {birth}',
      companyLength: 'O RFC deve ter 12 caracteres (pessoa jurídica) ou 13 (pessoa física)',
    },
    taxId: {
      length: 'O número de {name} deve ter de {min} a {max} caracteres',
      lengthExact: 'O número de {name} deve ter {length} caracteres',
      format: 'Formato de {name} inválido (por exemplo, {example})',
    },
    curp: {
      length: 'A CURP tem {length} caracteres; você digitou {current}',
      format: 'Verifique o formato da CURP (por exemplo, {example})',
      date: 'A data da CURP (aammdd) não é válida',
      checkDigit: 'O dígito verificador da CURP não confere',
      birthMismatch: 'A CURP indica nascimento em {document}, mas a data de nascimento é {birth}',
      century: 'O 17º caractere da CURP não corresponde ao século de nascimento: número antes de 2000, letra a partir de 2000',
    },
    nss: {
      length: 'O NSS tem {length} dígitos',
      checkDigit: 'O dígito verificador do NSS não confere',
    },
    maxEmployees: 'Digite um número inteiro maior que 0',
  },
  phone: {
    required: 'O telefone é obrigatório',
    invalid: 'O telefone não é válido para o código de país +{code}',
    noCountries: 'O catálogo de países não tem países ativos',
  },
  required: {
    firstName: 'O nome é obrigatório',
    lastName: 'O sobrenome é obrigatório',
    tradeName: 'O nome fantasia é obrigatório',
    legalName: 'A razão social é obrigatória',
  },
  changes: {
    newSecret: 'Nova',
    more: 'mais {count}',
  },
  ranges: {
    today: 'Hoje',
    yesterday: 'Ontem',
    week: 'Esta semana',
    lastWeek: 'Semana passada',
    month: 'Este mês',
    lastMonth: 'Mês passado',
    last30: 'Últimos 30 dias',
  },
  device: {
    unknown: 'Dispositivo desconhecido',
    browser: 'Navegador',
    system: 'Sistema desconhecido',
  },
} satisfies Translation<typeof es>;
