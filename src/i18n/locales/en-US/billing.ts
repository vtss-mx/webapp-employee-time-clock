import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/billing';
import account from './billing/account';
import plan from './billing/plan';

/** Company billing texts (ADMIN) in English (en-US): the same keys as es-MX. Money arrives already formatted in its currency. */
export default {
  title: 'Billing',
  withTax: 'incl. VAT',
  amountWithTax: '{amount} incl. VAT',
  plan,
  ...account,
} satisfies Translation<typeof es>;
