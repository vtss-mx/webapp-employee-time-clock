import { derive } from '../../../derive';
import es from '../../es-MX/billing/account';

/**
 * Textos de la facturación (resumen, cuenta de cada empresa, cargos y pagos) en español de España (es-ES): solo lo que
 * cambia respecto de es-MX (vocabulario; glosario §3): «facturación» por «cobranza», «importe» por «monto»,
 * «justificante» por «comprobante» y «cierre» por «corte».
 */
export default derive(es, {
  overview: {
    loadError: 'No se pudieron cargar los indicadores de facturación',
    subtitle: 'Al {date} · importes con IVA, por moneda',
    emptyDescription: 'Configura el plan de una empresa para empezar a cobrar.',
    lastCut: 'Último cierre',
    noCuts: 'Aún no hay cierres',
  },
  companies: {
    emptyDescription: 'Aquí verás la facturación de cada empresa.',
  },
  account: {
    loadError: 'No se pudo cargar la facturación de la empresa',
    open: 'Abrir facturación',
    addPlan: 'Configurar plan',
    noPlanDescription: 'No se le emiten cargos. Se configura con «Editar plan».',
    noPlanSection: 'No se le cobra hasta configurar su plan.',
  },
  estimate: {
    cutOn: 'cierre el {date}',
    cut: 'Cierre',
  },
  preview: {
    currency: 'Importes en {currency}',
    period: '{period} · cierre {date}',
  },
  charge: {
    cut: 'Cierre',
  },
  payments: {
    receiptError: 'No se pudo descargar el justificante',
    columns: {
      amount: 'Importe',
    },
    receipt: 'Justificante',
    voidIntro: 'Los cargos que cubría vuelven a quedar por pagar y el saldo se recalcula. Si fue un error al anotarlo, registra después el pago correcto.',
  },
  payment: {
    referencePlaceholder: 'Número de recibo, de operación o de cheque',
    receiptLabel: 'Justificante del pago',
    noReceipt: 'Sin justificante',
    fields: {
      amount: 'Importe',
      receipt: 'Justificante',
    },
    errors: {
      amountMissing: 'Escribe el importe',
      amountRange: 'El importe debe ser mayor que 0 y hasta {max}',
      receiptType: 'El justificante debe ser PDF, JPG, PNG o WEBP',
      receiptSize: 'El justificante pesa más de 5 MB',
    },
    notice: {
      applied: 'Cargo {sequence} (cierre {date}): {amount}',
    },
  },
});
