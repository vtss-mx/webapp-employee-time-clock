import { t } from '../i18n';
import { billingService } from '../services/billingService';
import { useResource } from './useResource';

const accountError = () => t('billing.account.loadError');
const estimateError = () => t('billing.estimate.loadError');

/** Cuenta de cobranza de una empresa (estado, suspensión, plan, moneda y saldo). */
export function useBillingAccount(companyId: number) {
  return useResource((signal) => billingService.account(companyId, signal), companyId, accountError);
}

/**
 * Cargo del periodo en curso (lo devengado hasta hoy y el pronóstico). Solo se pide con plan: sin él el
 * backend responde 404 y no hay nada que estimar. `retry` lo vuelve a calcular ("Actualizar").
 */
export function useEstimate(companyId: number, hasPlan: boolean) {
  return useResource(
    (signal) => (hasPlan ? billingService.estimate(companyId, signal) : Promise.resolve(null)),
    `${companyId}|${hasPlan}`,
    estimateError,
  );
}

export type EstimateResource = ReturnType<typeof useEstimate>;
