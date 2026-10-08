import { derive } from '../../../derive';
import es from '../../es-MX/billing/plan';

/**
 * Textos del plan de cobro de una empresa en español de España (es-ES): solo lo que cambia respecto de es-MX
 * (vocabulario; glosario §3): «importe» por «monto», «cierre» por «corte» y el decimal con coma.
 */
export default derive(es, {
  chargingDescription: 'Aún no se le cobra. Actívalo y configura su plan; el cobro empieza en su fecha de inicio.',
  facts: {
    nextCut: 'Próximo cierre',
  },
  fields: {
    intervalHint: 'El cierre es el último día del mes',
    taxHint: 'Sobre el subtotal con descuento; 0 si no procede (un cliente del extranjero suele llevar 0 %)',
    discountDescription: 'Un porcentaje o un importe fijo, en todos o en algunos cargos.',
    discountAmount: 'Importe del descuento por cargo',
  },
  errors: {
    taxMissing: 'Escribe el IVA (0 si no procede)',
    discountPercent: 'El porcentaje va de 0,01 % a 100 %',
    discountAmount: 'El importe debe ser mayor que 0 y hasta {max}',
  },
});
