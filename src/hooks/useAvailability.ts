import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { checkAvailability, type Availability, type AvailabilityField } from '../services/availabilityService';
import { config } from '../utils/config';

/** linkable: el correo o teléfono es de una persona de otra empresa (se vincula su cuenta). */
export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'linkable' | 'taken' | 'invalid' | 'unknown';

/** Lo mínimo que entrega cualquier verificación de disponibilidad (empleados o empresas). */
export type AvailabilityResult = Pick<Availability, 'code' | 'message'>;

/** Campos de empleado (servicio común) o de la consola de empresas (con `check` propio). */
export type LiveField = AvailabilityField | 'company_rfc' | 'company_admin_email';

export interface AvailabilityState {
  status: AvailabilityStatus;
  message?: string;
  result?: AvailabilityResult;
}

interface Options {
  /** Al editar: id del empleado (su propio valor no cuenta como duplicado). */
  excludeId?: number;
  /** Valor original: si no cambió, no se consulta. */
  unchangedValue?: string;
  enabled?: boolean;
  /** Verificación propia (p. ej. RFC de empresa en la consola de la plataforma). */
  check?: (value: string, excludeId?: number) => Promise<AvailabilityResult>;
}

const STATUS_BY_CODE: Record<string, AvailabilityStatus> = {
  AVAILABLE: 'available',
  LINKABLE: 'linkable',
  TAKEN: 'taken',
  INVALID_FORMAT: 'invalid',
  EMPTY: 'idle',
};

/**
 * Validación en tiempo real mientras se escribe (con pausa entre teclas). Ignora respuestas
 * de valores anteriores y, si no se puede verificar, no bloquea: el servidor valida al guardar.
 */
export function useAvailability(field: LiveField, value: string, options: Options = {}): AvailabilityState {
  const { excludeId, unchangedValue, enabled = true, check } = options;
  const [state, setState] = useState<AvailabilityState>({ status: 'idle' });
  const sequence = useRef(0);
  // La función de verificación puede ser nueva en cada render: se usa la más reciente.
  const checkRef = useRef(check);
  useLayoutEffect(() => {
    checkRef.current = check;
  });

  useEffect(() => {
    const current = ++sequence.current;
    const trimmed = value.trim();
    const unchanged = unchangedValue !== undefined && trimmed.toLowerCase() === unchangedValue.trim().toLowerCase();
    if (!enabled || !trimmed || unchanged) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'checking' });
    const timer = window.setTimeout(() => {
      (checkRef.current ? checkRef.current(trimmed, excludeId) : checkAvailability(field as AvailabilityField, trimmed, excludeId))
        .then((result) => {
          if (current !== sequence.current) return; // llegó la respuesta de un valor anterior
          setState({ status: STATUS_BY_CODE[result.code] ?? 'unknown', message: result.message, result });
        })
        .catch(() => current === sequence.current && setState({ status: 'unknown' }));
    }, config.availabilityDebounceMs);
    return () => window.clearTimeout(timer);
  }, [field, value, excludeId, unchangedValue, enabled]);

  return state;
}
