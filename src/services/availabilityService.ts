import { hasKeys } from '../utils/guards';
import { apiRequest, type ApiEnvelope } from './apiClient';
import { validationSocket } from './realtime/validationSocket';

/**
 * Campos que se validan mientras se escriben. El backend decide quién puede validar cada uno (según
 * las pantallas de su rol): datos del empleado (COMPANY), correo del validador (COMPANY) y datos
 * de las empresas en la consola de la plataforma (ADMIN).
 */
export type AvailabilityField =
  | 'employee_number'
  | 'rfc'
  | 'curp'
  | 'nss'
  | 'email'
  | 'phone'
  | 'validator_email'
  | 'company_rfc'
  | 'company_admin_email'
  | 'company_phone';

export interface Availability {
  field: AvailabilityField;
  value: string;
  normalized: string | null;
  valid: boolean;
  available: boolean;
  /**
   * AVAILABLE | LINKABLE (persona de otra empresa: se vincula) | TAKEN | MISMATCH (el teléfono no es
   * el de la cuenta del correo escrito) | VALID (dato no único con formato correcto) | INVALID_FORMAT | EMPTY
   */
  code: string;
  message: string;
  /** Canal que respondió (útil para diagnóstico). */
  via: 'websocket' | 'http';
}

const isAvailability = hasKeys<Omit<Availability, 'via'>>('field', 'available', 'valid', 'code', 'message');

function fromEnvelope(envelope: ApiEnvelope): Omit<Availability, 'via'> {
  if (isAvailability(envelope.data)) return envelope.data;
  throw new Error(envelope.message);
}

/**
 * Valida en tiempo real por WebSocket; si el canal no está disponible, por HTTP. `related`: otro
 * valor del formulario que la regla necesita (el correo, al validar el teléfono de un empleado
 * nuevo: si ya trabaja en otra empresa, ambos deben ser de la misma persona).
 */
export async function checkAvailability(field: AvailabilityField, value: string, excludeId?: number, related?: string): Promise<Availability> {
  if (validationSocket.available) {
    try {
      const envelope = await validationSocket.request({ type: 'validate', field, value, excludeId: excludeId ?? null, related: related ?? null });
      return { ...fromEnvelope(envelope), via: 'websocket' };
    } catch {
      /* respaldo HTTP */
    }
  }
  const data = await apiRequest('/validation', {
    query: { field, value, exclude_id: excludeId, related },
    validate: isAvailability,
  });
  return { ...data, via: 'http' };
}
