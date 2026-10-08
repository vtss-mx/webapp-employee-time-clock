import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/billing';
import account from './billing/account';
import plan from './billing/plan';

/** Textos de la cobranza de las empresas (ADMIN) en portugués de Brasil (pt-BR): las mismas llaves que es-MX. El dinero llega ya formateado en su moneda. */
export default {
  title: 'Cobrança',
  withTax: 'com IVA',
  amountWithTax: '{amount} com IVA',
  plan,
  ...account,
} satisfies Translation<typeof es>;
