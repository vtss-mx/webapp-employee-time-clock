import { derive } from '../../derive';
import es from '../es-MX/billing';
import account from './billing/account';
import plan from './billing/plan';

/**
 * Textos de la facturación de las empresas (ADMIN) en español de España (es-ES): solo lo que cambia respecto de es-MX
 * (vocabulario; glosario §3: «Facturación» por «Cobranza»). El plan y la cuenta llegan ya derivados de sus subarchivos.
 */
export default derive(es, {
  title: 'Facturación',
  plan,
  ...account,
});
