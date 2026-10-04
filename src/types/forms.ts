/**
 * Tipos compartidos de los formularios. Los usan los hooks (estado y reglas) y los componentes
 * (campos); viven aquí para que ningún hook dependa de un componente (sin ciclos de importación).
 */

/** Estado de la validación en vivo de un dato. linkable: es de una persona de otra empresa (se vincula su cuenta). */
export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'linkable' | 'taken' | 'invalid' | 'unknown';

/** Lo mínimo que entrega cualquier verificación de disponibilidad: el código y el mensaje del backend. */
export interface AvailabilityResult {
  code: string;
  message: string;
}

export interface AvailabilityState {
  status: AvailabilityStatus;
  message?: string;
  result?: AvailabilityResult;
}

/** Indicador junto al control: "verificando…", confirmación (✓) o aviso. */
export interface FieldStatus {
  tone: 'checking' | 'success' | 'info';
  text?: string;
}

/** Datos del empleado que deben ser únicos: se verifican en vivo mientras se escriben. */
export type EmployeeUniqueField = 'employee_number' | 'rfc' | 'curp' | 'nss' | 'email' | 'phone';

/** Validación en vivo de cada dato único del empleado. */
export type LiveChecks = Record<EmployeeUniqueField, AvailabilityState>;
