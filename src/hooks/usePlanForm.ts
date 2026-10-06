import { useCallback, useState } from 'react';
import { planInput, planServerErrors, validatePlan, type PlanErrors, type PlanField, type PlanFormValues } from '../utils/billing';

/**
 * Estado del plan de cobro de una empresa (alta y edición): valores, errores visibles (de un campo al
 * salir de él, de todos al intentar guardar, y los del servidor en su campo) y lo que se enviaría
 * (`input`, solo con el plan válido). Lo usan `PlanSection` y las pantallas que guardan el plan.
 */
export function usePlanForm(initial: PlanFormValues) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<PlanField, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<PlanErrors>({});
  const clientErrors = validatePlan(values);
  const valid = Object.keys(clientErrors).length === 0;

  const errors: PlanErrors = {};
  for (const field of Object.keys(values) as PlanField[]) {
    const message = serverErrors[field] ?? (touched[field] ? clientErrors[field] : undefined);
    if (message) errors[field] = message;
  }

  /** Cambia un campo y descarta el error que el servidor había puesto en él. */
  const set = useCallback(<K extends PlanField>(field: K, value: PlanFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }, []);

  const touch = useCallback((field: PlanField) => setTouched((current) => (current[field] ? current : { ...current, [field]: true })), []);
  const touchAll = () => setTouched(Object.fromEntries(Object.keys(values).map((field) => [field, true])));

  /** Carga un plan guardado (edición), sin errores pendientes. */
  const load = useCallback((next: PlanFormValues) => {
    setValues(next);
    setTouched({});
    setServerErrors({});
  }, []);

  /** Un envío falló: los errores del servidor (422 por campo) quedan en sus campos. */
  const fail = useCallback((error: unknown) => setServerErrors(planServerErrors(error)), []);

  return { values, set, touch, touchAll, load, fail, errors, valid, input: valid ? planInput(values) : null };
}

export type PlanForm = ReturnType<typeof usePlanForm>;
