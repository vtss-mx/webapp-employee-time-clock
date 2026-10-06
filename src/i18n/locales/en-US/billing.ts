import type { Translation } from '../../../types/i18n';
import type es from '../es-MX/billing';
import account from './billingAccount';
import plan from './billingPlan';

/** Company billing texts (ADMIN) in English (en-US): the same keys as es-MX. Money arrives already formatted in its currency. */
export default {
  title: 'Billing',
  withTax: 'incl. VAT',
  amountWithTax: '{amount} incl. VAT',
  plan,
  ...account,
} satisfies Translation<typeof es>;
