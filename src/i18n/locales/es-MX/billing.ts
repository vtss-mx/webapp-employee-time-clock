import account from './billingAccount';
import plan from './billingPlan';

/**
 * Textos de la cobranza de las empresas (ADMIN), es-MX. El dinero nunca va escrito aquí: llega como
 * variable ya formateada en su moneda (`formatMoney`: "$1,234.50 MXN"). Se parte en subarchivos (plan y
 * cuenta) para no pasar de 450 líneas.
 */
export default {
  title: 'Cobranza',
  withTax: 'con IVA',
  /** Un monto ya formateado en su moneda, aclarando que incluye el IVA. */
  amountWithTax: '{amount} con IVA',
  plan,
  ...account,
} as const;
