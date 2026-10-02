import { ApiError } from '../services/apiClient';
import type { CompanyFormValues } from '../types';
import { validateCompanyForm } from '../utils/formRules';
import { normalizeRfc, validateEmail, type FieldErrors } from '../utils/validation';
import { useAvailability, type AvailabilityState } from './useAvailability';
import { useFormState } from './useFormState';

export const emptyCompanyForm: CompanyFormValues = {
  name: '',
  legal_name: '',
  rfc: '',
  contact_email: '',
  phone: '',
  max_employees: '',
  admin_email: '',
  admin_password: '',
};

/** Errores del servidor llevados al campo (RFC o correo ya registrados, validación). */
export function companyServerErrors(err: unknown): FieldErrors<CompanyFormValues> {
  if (!(err instanceof ApiError)) return {};
  const result = { ...(err.fieldErrors as FieldErrors<CompanyFormValues>) };
  if (err.code === 'COMPANY_RFC_TAKEN') result.rfc = err.message;
  if (err.code === 'EMAIL_TAKEN') result.admin_email = err.message;
  return result;
}

const blocking = (state: AvailabilityState) => state.status === 'checking' || state.status === 'taken' || state.status === 'invalid';
const liveMessage = (state: AvailabilityState) => (state.status === 'taken' || state.status === 'invalid' ? state.message : undefined);

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
    untouchedOnLoad: ['admin_email', 'admin_password'],
  });
  const { values } = form;
  const rfcLength = normalizeRfc(values.rfc).length;
  // Validación en vivo por el canal del backend: RFC y correo del administrador (únicos) y los
  // datos de contacto (formato, con la misma regla que al guardar).
  const live = {
    rfc: useAvailability('company_rfc', values.rfc, {
      excludeId,
      unchangedValue: originalRfc,
      enabled: rfcLength === 12 || rfcLength === 13,
    }),
    admin_email: useAvailability('company_admin_email', values.admin_email, {
      enabled: withAdmin && !validateEmail(values.admin_email),
    }),
    contact_email: useAvailability('company_contact_email', values.contact_email, { enabled: !validateEmail(values.contact_email) }),
    phone: useAvailability('company_phone', values.phone, { enabled: values.phone.length > 4 }),
  };

  const clientErrors = validateCompanyForm(values, { withAdmin });
  const errors = form.visibleErrors(clientErrors);
  const liveFields = ['rfc', 'admin_email', 'contact_email', 'phone'] as const;
  for (const field of liveFields) errors[field] ??= liveMessage(live[field]);
  const canSubmit = Object.keys(clientErrors).length === 0 && !liveFields.some((field) => blocking(live[field])) && !form.saving;

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
