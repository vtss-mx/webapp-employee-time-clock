import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/consents';

/** Textos del consentimiento biométrico en portugués de Brasil (pt-BR, trato de «você»): las mismas llaves que es-MX. */
export default {
  title: 'Dados biométricos',
  intro: 'Seu consentimento para usar seu rosto e sua voz ao verificar sua identidade.',
  loadError: 'Não foi possível carregar seu consentimento',
  granted: 'Concedido',
  pending: 'Não concedido',
  askedBy: 'Sua empresa pede',
  grantedOn: 'Concedido em {date}',
  revokedOn: 'Revogado em {date}',
  version: 'Versão {version}',
  read: 'Ler e conceder',
  review: 'Ver o texto',
  revoke: 'Revogar',
  back: 'Voltar para Meu perfil',
  backToEnrollment: 'Voltar para seu cadastro',
  pageTitle: 'Consentimento biométrico',
  pageSubtitle: 'Leia o texto completo e decida se concede',
  grant: 'Conceder meu consentimento',
  empty: {
    title: 'Sem consentimentos',
    description: 'Aqui você verá o que sua empresa pede para autorizar.',
  },
  onlyEmployees: {
    title: 'Apenas para funcionários',
    description: 'Sua conta não guarda dados biométricos.',
  },
  grantAsk: {
    eyebrow: 'Seu consentimento',
    title: 'Conceder seu consentimento?',
    message: 'Você confirma que leu o texto completo e autoriza o que ele diz.',
    note: 'Você pode revogar quando quiser em Meu perfil.',
    confirm: 'Conceder',
  },
  grantFailed: 'Não foi possível conceder seu consentimento',
  grantedTitle: 'Consentimento concedido',
  revokeAsk: {
    eyebrow: 'Seu consentimento',
    title: 'Revogar seu consentimento biométrico?',
    message: 'Seu rosto, suas fotos e sua voz são excluídos de imediato e seu cadastro facial deixa de existir.',
    note: 'Isso não pode ser desfeito. Sua empresa terá que verificar sua identidade de outra forma.',
    confirm: 'Revogar',
  },
  revokeFailed: 'Não foi possível revogar seu consentimento',
  revokedTitle: 'Consentimento revogado',
  revokedText: 'Seus dados biométricos foram excluídos.',
  missingTitle: 'Falta seu consentimento',
  inPersonTitle: 'Falta o consentimento de {name}',
  inPersonText: 'O consentimento precisa ser concedido em Meu perfil antes do cadastro facial.',
} satisfies Translation<typeof es>;
