import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../services/apiClient';
import { t } from '../i18n';
import { billingService } from '../services/billingService';
import type { BillingPlanInput, Headcount, PlanPreview } from '../types';
import { config } from '../utils/config';
import { useFeedback } from './useFeedback';

export type PreviewState =
  /** Sin plan válido que calcular. */
  | { status: 'idle' }
  /** Calculando (con la vista anterior mientras llega la nueva). */
  | { status: 'loading'; preview: PlanPreview | null }
  | { status: 'ready'; preview: PlanPreview }
  /** El backend no aceptó el plan (422): su motivo, sin popup (se está escribiendo). */
  | { status: 'invalid'; message: string }
  /** Falla real (red, servidor): se avisó en popup y la sección ofrece reintentar. */
  | { status: 'error' };

const previewError = () => t('billing.preview.loadError');

/**
 * Vista previa del cobro de un plan, calculada por el BACKEND (`POST /admin/billing/preview`): el
 * primer cargo y lo que costará cada periodo con `headcount` (empleados y validadores activos: el backend
 * cobra cada validador como un empleado). Se pide tras una pausa
 * desde el último cambio y cada cambio cancela la petición anterior (lo que responda tarde ya no
 * cuenta). Nunca bloquea el formulario: un plan que el backend rechaza mientras se escribe (422) solo
 * se explica en la sección; una falla real se avisa en popup una vez, con "Reintentar".
 */
export function usePlanPreview(plan: BillingPlanInput | null, headcount: Headcount) {
  const feedback = useFeedback();
  const [state, setState] = useState<PreviewState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // Clave de lo que se calcula: un cambio real (no un objeto nuevo con lo mismo) pide otra vista.
  const key = plan ? JSON.stringify({ plan, employees: headcount.employees, validators: headcount.validators }) : '';

  useEffect(() => {
    if (!key) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setState((current) => ({ status: 'loading', preview: current.status === 'ready' || current.status === 'loading' ? current.preview : null }));
    const timer = window.setTimeout(() => {
      const { plan: input, ...expected } = JSON.parse(key) as { plan: BillingPlanInput } & Headcount;
      billingService
        .preview(input, expected, signal)
        .then((preview) => !signal.aborted && setState({ status: 'ready', preview }))
        .catch((error: unknown) => {
          if (signal.aborted) return;
          if (error instanceof ApiError && error.status === 422) {
            setState({ status: 'invalid', message: error.message });
            return;
          }
          setState({ status: 'error' });
          void feedback.fromError(error, { title: previewError, retry, key: 'billing-preview' });
        });
    }, config.billingPreviewDebounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt, feedback, retry]);

  return { state, retry };
}
