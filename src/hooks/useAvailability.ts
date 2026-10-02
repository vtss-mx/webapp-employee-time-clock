import { useEffect, useRef, useState } from 'react';
import { checkAvailability, type Availability, type AvailabilityField } from '../services/availabilityService';
import { config } from '../utils/config';

/** linkable: el correo o teléfono es de una persona de otra empresa (se vincula su cuenta). */
export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'linkable' | 'taken' | 'invalid' | 'unknown';

/** Lo mínimo que entrega cualquier verificación de disponibilidad. */
export type AvailabilityResult = Pick<Availability, 'code' | 'message'>;

export interface AvailabilityState {
  status: AvailabilityStatus;
  message?: string;
  result?: AvailabilityResult;
}

interface Options {
  /** Al editar: id del registro (su propio valor no cuenta como duplicado). */
  excludeId?: number;
  /** Valor original: si no cambió, no se consulta. */
  unchangedValue?: string;
  enabled?: boolean;
}

const STATUS_BY_CODE: Record<string, AvailabilityStatus> = {
  AVAILABLE: 'available',
  LINKABLE: 'linkable',
  // Dato de contacto (no único) con formato correcto.
  VALID: 'available',
  TAKEN: 'taken',
  INVALID_FORMAT: 'invalid',
  EMPTY: 'idle',
};

/**
 * Validación en tiempo real mientras se escribe (con pausa entre teclas), por el canal WebSocket
 * del backend (o su respaldo HTTP). Ignora respuestas de valores anteriores y, si no se puede
 * verificar, no bloquea: el servidor valida al guardar.
 */
export function useAvailability(field: AvailabilityField, value: string, options: Options = {}): AvailabilityState {
  const { excludeId, unchangedValue, enabled = true } = options;
  const [state, setState] = useState<AvailabilityState>({ status: 'idle' });
  const sequence = useRef(0);

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
      checkAvailability(field, trimmed, excludeId)
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
