import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/core';
import { checkAvailability, type AvailabilityField } from '../services/availabilityService';
import type { AvailabilityState, AvailabilityStatus, FieldStatus } from '../types';
import { config } from '../utils/config';

interface Options {
  /** Al editar: id del registro (su propio valor no cuenta como duplicado). */
  excludeId?: number;
  /** Valor original: si no cambió, no se consulta. */
  unchangedValue?: string;
  enabled?: boolean;
  /** Otro valor del formulario que la regla necesita (p. ej. el correo al validar el teléfono). */
  related?: string;
}

const STATUS_BY_CODE: Record<string, AvailabilityStatus> = {
  AVAILABLE: 'available',
  LINKABLE: 'linkable',
  // Dato no único con formato correcto (teléfono de la empresa).
  VALID: 'available',
  // El teléfono no es el de la persona del correo escrito: bloquea como un duplicado.
  MISMATCH: 'taken',
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
  const { excludeId, unchangedValue, enabled = true, related } = options;
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
      checkAvailability(field, trimmed, excludeId, related)
        .then((result) => {
          if (current !== sequence.current) return; // llegó la respuesta de un valor anterior
          setState({ status: STATUS_BY_CODE[result.code] ?? 'unknown', message: result.message, result });
        })
        .catch(() => current === sequence.current && setState({ status: 'unknown' }));
    }, config.availabilityDebounceMs);
    return () => window.clearTimeout(timer);
  }, [field, value, excludeId, unchangedValue, enabled, related]);

  return state;
}

/*
 * Lectura del estado en vivo (única implementación): los formularios y sus campos la comparten para
 * que "qué impide guardar" y "qué error se muestra" sean siempre la misma regla.
 */

/** Duplicado o con formato incorrecto: así no se puede guardar. */
const isRejected = (state: AvailabilityState) => state.status === 'taken' || state.status === 'invalid';

/** Mensaje del dato verificado en vivo que impide guardar (duplicado o formato), si lo hay. */
export function availabilityError(state: AvailabilityState | undefined): string | undefined {
  return state && isRejected(state) ? state.message : undefined;
}

/** El dato aún no deja guardar: se está verificando o ya se sabe que no sirve. */
export function availabilityBlocks(state: AvailabilityState): boolean {
  return state.status === 'checking' || isRejected(state);
}

/** Estado en vivo → error inmediato (duplicado/formato) o indicador junto al control (verificando / disponible / aviso). */
export function liveFeedback(state: AvailabilityState | undefined): { error?: string; status?: FieldStatus } {
  switch (state?.status) {
    case 'checking':
      return { status: { tone: 'checking', text: t('services.availability.checking') } };
    case 'available':
      return { status: { tone: 'success', text: state.message } };
    case 'linkable':
      return { status: { tone: 'info', text: state.message } };
    default:
      return { error: availabilityError(state) };
  }
}
