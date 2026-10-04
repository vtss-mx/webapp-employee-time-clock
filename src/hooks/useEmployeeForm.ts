import { useState } from 'react';
import { availabilityBlocks, availabilityError, useAvailability } from './useAvailability';
import { fieldErrorsFrom } from '../services/apiClient';
import { useFormState } from './useFormState';
import { validatePhone } from '../utils/phone';
import { emptyEmployeeForm, validateEmployeeForm } from '../utils/formRules';
import type { EmployeeFormValues, EmployeeUniqueField, LiveChecks } from '../types';
import { CURP_LENGTH, NSS_LENGTH, RFC_LENGTH, normalizeCurp, normalizeRfc, type FieldErrors, validateEmail } from '../utils/validation';

const UNIQUE_FIELDS: EmployeeUniqueField[] = ['employee_number', 'rfc', 'curp', 'nss', 'email', 'phone'];

/** Campo del formulario al que corresponde cada error de negocio del backend (duplicados, datos que no coinciden). */
const ERROR_FIELDS: Partial<Record<string, keyof EmployeeFormValues>> = {
  EMAIL_TAKEN: 'email',
  EMPLOYEE_NUMBER_TAKEN: 'employee_number',
  RFC_TAKEN: 'rfc',
  RFC_BIRTH_DATE_MISMATCH: 'rfc',
  CURP_TAKEN: 'curp',
  CURP_BIRTH_DATE_MISMATCH: 'curp',
  NSS_TAKEN: 'nss',
  PHONE_TAKEN: 'phone',
  ACCOUNT_PHONE_MISMATCH: 'phone',
  ACCOUNT_PHONE_MISSING: 'phone',
  PASSWORD_REQUIRED: 'password',
};

/** Errores de campo devueltos por el backend (duplicados y validación). */
export const serverFieldErrors = (err: unknown): FieldErrors<EmployeeFormValues> => fieldErrorsFrom(err, ERROR_FIELDS);

interface EmployeeFormOptions {
  /** Edición: id del empleado y sus valores actuales (no cuentan como duplicados). */
  excludeId?: number;
  original?: Partial<Pick<EmployeeFormValues, EmployeeUniqueField>>;
  /** Edición: la contraseña vacía significa "no cambiarla". */
  passwordOptional?: boolean;
}

/**
 * Estado y envío comunes de los formularios de alta y edición de empleados.
 * - Cada campo muestra su error al salir de él (o de inmediato si viene del servidor).
 * - `canSubmit`: el botón de guardar solo se habilita con todos los campos correctos y verificados.
 */
export function useEmployeeForm({ excludeId, original, passwordOptional = false }: EmployeeFormOptions = {}) {
  const form = useFormState<EmployeeFormValues>(emptyEmployeeForm, {
    serverErrors: serverFieldErrors,
    untouchedOnLoad: ['password', 'password_confirm'], // al editar, vacía = no cambiarla
  });
  const { values, saving } = form;
  const [headwearExempt, setHeadwearExempt] = useState(false);

  // Validación en tiempo real (WebSocket, con respaldo HTTP) de los datos que deben ser únicos.
  // RFC, CURP y NSS solo se consultan completos: mientras se escriben no hay nada que verificar.
  const unchanged = (field: EmployeeUniqueField) => ({ excludeId, unchangedValue: original?.[field] });
  const live: LiveChecks = {
    employee_number: useAvailability('employee_number', values.employee_number, unchanged('employee_number')),
    rfc: useAvailability('rfc', values.rfc, { ...unchanged('rfc'), enabled: normalizeRfc(values.rfc).length === RFC_LENGTH }),
    curp: useAvailability('curp', values.curp, { ...unchanged('curp'), enabled: normalizeCurp(values.curp).length === CURP_LENGTH }),
    nss: useAvailability('nss', values.nss, { ...unchanged('nss'), enabled: values.nss.length === NSS_LENGTH }),
    email: useAvailability('email', values.email, unchanged('email')),
    // Alta: el teléfono se valida junto con el correo (si la persona ya trabaja en otra empresa,
    // deben ser de su misma cuenta). Al editar se valida solo.
    phone: useAvailability('phone', values.phone, {
      ...unchanged('phone'),
      enabled: !validatePhone(values.phone),
      related: excludeId === undefined && !validateEmail(values.email) ? values.email.trim() : undefined,
    }),
  };
  // La persona ya trabaja en otra empresa: se vincula su cuenta (conserva su contraseña).
  const linking = !passwordOptional && live.email.status === 'linkable';

  const clientErrors = validateEmployeeForm(values, { passwordOptional: passwordOptional || linking });
  const pendingLive = UNIQUE_FIELDS.some((f) => availabilityBlocks(live[f]));
  /** Todo lleno correctamente, sin duplicados y nada pendiente de verificar. */
  const canSubmit = Object.keys(clientErrors).length === 0 && !pendingLive && !saving;

  /** Red de seguridad al enviar (Enter): marca todo y resume en un popup lo que falta. */
  const validate = (): boolean => {
    const validation: FieldErrors<EmployeeFormValues> = { ...clientErrors };
    for (const field of UNIQUE_FIELDS) {
      const message = validation[field] ?? availabilityError(live[field]);
      if (message) validation[field] = message;
    }
    form.touchAll();
    const ok = Object.keys(validation).length === 0;
    if (!ok) void form.feedback.invalidForm(validation);
    return ok && !pendingLive;
  };

  return {
    values,
    setValues: form.setValues,
    loadValues: form.loadValues,
    touch: form.touch,
    headwearExempt,
    setHeadwearExempt,
    errors: form.visibleErrors(clientErrors),
    saving,
    canSubmit,
    validate,
    save: (action: () => Promise<void>) => form.save(action),
    live,
    linking,
  };
}
