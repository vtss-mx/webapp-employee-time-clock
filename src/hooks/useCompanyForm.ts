import { fieldErrorsFrom } from '../services/apiClient';
import type { CompanyFormValues } from '../types';
import type { FieldLabels } from '../utils/changes';
import { validateCompanyForm } from '../utils/formRules';
import { formatPhone } from '../utils/phone';
import { normalizeRfc, validateEmail, type FieldErrors } from '../utils/validation';
import { availabilityBlocks, availabilityError, useAvailability } from './useAvailability';
import { useFormState } from './useFormState';

export const emptyCompanyForm: CompanyFormValues = {
  name: '',
  legal_name: '',
  rfc: '',
  phone: '',
  max_employees: '',
  admin_email: '',
  admin_password: '',
  admin_password_confirm: '',
};

/**
 * Cómo se leen los datos de la empresa en la confirmación del alta (lo que se registrará) y de la
 * edición ("antes → después"). La contraseña del administrador nunca se muestra: no está aquí.
 */
export const COMPANY_LABELS: FieldLabels<CompanyFormValues> = {
  name: 'Nombre comercial',
  legal_name: 'Razón social',
  rfc: 'RFC',
  phone: { label: 'Teléfono', format: formatPhone },
  max_employees: { label: 'Límite de empleados', format: (value) => (value.trim() ? `${value.trim()} empleados` : 'Sin límite') },
  admin_email: { label: 'Correo del administrador', format: (value) => value.trim().toLowerCase() },
};

/** Errores del servidor llevados al campo (RFC o correo ya registrados, validación). */
export const companyServerErrors = (err: unknown): FieldErrors<CompanyFormValues> =>
  fieldErrorsFrom<CompanyFormValues>(err, { COMPANY_RFC_TAKEN: 'rfc', EMAIL_TAKEN: 'admin_email' });

interface CompanyFormOptions {
  /** Alta: incluye el primer administrador. Edición: solo datos de la empresa. */
  withAdmin: boolean;
  /** Edición: la empresa misma (su RFC no cuenta como duplicado). */
  excludeId?: number;
  originalRfc?: string;
}

/** Formulario de empresa con validación en vivo y botón habilitado solo con todo correcto. */
export function useCompanyForm({ withAdmin, excludeId, originalRfc }: CompanyFormOptions) {
  const form = useFormState<CompanyFormValues>(emptyCompanyForm, {
    serverErrors: companyServerErrors,
    untouchedOnLoad: ['admin_email', 'admin_password', 'admin_password_confirm'],
  });
  const { values } = form;
  const rfcLength = normalizeRfc(values.rfc).length;
  // Validación en vivo por el canal del backend: RFC y correo del administrador (únicos) y el
  // teléfono (formato, con la misma regla que al guardar). La empresa tiene un solo correo: el de
  // su administrador.
  const live = {
    rfc: useAvailability('company_rfc', values.rfc, {
      excludeId,
      unchangedValue: originalRfc,
      enabled: rfcLength === 12 || rfcLength === 13,
    }),
    admin_email: useAvailability('company_admin_email', values.admin_email, {
      enabled: withAdmin && !validateEmail(values.admin_email),
    }),
    phone: useAvailability('company_phone', values.phone, { enabled: values.phone.length > 4 }),
  };

  const clientErrors = validateCompanyForm(values, { withAdmin });
  const errors = form.visibleErrors(clientErrors);
  const liveFields = ['rfc', 'admin_email', 'phone'] as const;
  for (const field of liveFields) errors[field] ??= availabilityError(live[field]);
  const canSubmit = Object.keys(clientErrors).length === 0 && !liveFields.some((field) => availabilityBlocks(live[field])) && !form.saving;

  return {
    values,
    setValues: form.setValues,
    loadValues: form.loadValues,
    touch: form.touch,
    errors,
    live,
    saving: form.saving,
    canSubmit,
    save: form.save,
    feedback: form.feedback,
  };
}
