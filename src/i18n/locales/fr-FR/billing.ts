import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/billing';
import account from './billing/account';
import plan from './billing/plan';

/** Textos de la cobranza de las empresas (ADMIN) en francés (fr-FR): las mismas llaves que es-MX. El dinero llega ya formateado en su moneda. */
export default {
  title: 'Facturation',
  withTax: 'TVA incluse',
  amountWithTax: '{amount} TVA incluse',
  plan,
  ...account,
} satisfies Translation<typeof es>;
