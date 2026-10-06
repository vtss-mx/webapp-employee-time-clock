import { t } from '../i18n';
import { fieldErrorsFrom } from '../services/apiClient';
import type { CompanyFormValues } from '../types';
import type { CatalogApi } from '../utils/catalogs';
import type { FieldLabels } from '../utils/changes';
import { validateCompanyForm } from '../utils/formRules';
import { formatPhone } from '../utils/phone';
import { DEFAULT_TAX_COUNTRY, formatTaxId, RFC_TAX_ID_TYPE, taxIdKey, validateTaxId } from '../utils/taxId';
import { validateEmail, type FieldErrors } from '../utils/validation';
import { validateMaxValidators } from '../utils/validatorLimit';
import { availabilityBlocks, availabilityError, useAvailability } from './useAvailability';
import { useCatalogs } from './useCatalogs';
import { useFormState } from './useFormState';

export const emptyCompanyForm: CompanyFormValues = {
  name: '',
  legal_name: '',
  // País fiscal y tipo que se proponen (el RFC de México, como el backend sin ellos); el número es opcional.
  tax_country: DEFAULT_TAX_COUNTRY,
  tax_id_type: RFC_TAX_ID_TYPE,
  tax_id: '',
  phone: '',
  max_employees: '',
  // El módulo de validadores es opcional y cuesta (cada validador activo se cobra como un empleado): apagado.
  max_validators: '0',
  admin_email: '',
  admin_password: '',
  admin_password_confirm: '',
};

/** La empresa como se lee en sus confirmaciones: el identificador fiscal en una sola línea («RFC · PNO… · México»). */
export type CompanyView = CompanyFormValues & { tax: string };

/** El formulario con su identificador fiscal ya escrito para leerse (vacío si no lo capturó: «Sin capturar»). */
export const companyView = (values: CompanyFormValues, catalogs: Pick<CatalogApi, 'byCode' | 'nameOf'>): CompanyView => ({
  ...values,
  tax: formatTaxId(values, catalogs) ?? '',
});

/**
 * Cómo se leen los datos de la empresa en la confirmación del alta (lo que se registrará) y de la
 * edición ("antes → después"), en el idioma activo: el identificador fiscal con su tipo, su número y su país juntos
 * (`companyView`). La contraseña del administrador nunca se muestra: no está aquí.
 */
export const companyLabels = (): FieldLabels<CompanyView> => ({
  name: t('admin.form.name'),
  legal_name: t('admin.form.legalName'),
  tax: t('admin.form.taxId.number'),
  phone: { label: t('common.fields.phone'), format: formatPhone },
  max_employees: {
    label: t('admin.form.maxEmployees'),
    format: (value) => (value.trim() ? t('admin.form.employeeLimit', { count: Number(value.trim()) }) : t('admin.form.noLimit')),
  },
  max_validators: {
    label: t('admin.form.maxValidators'),
    format: (value) => (Number(value.trim()) > 0 ? t('admin.form.validatorLimit', { count: Number(value.trim()) }) : t('admin.form.noValidators')),
  },
  admin_email: { label: t('admin.form.adminEmail'), format: (value) => value.trim().toLowerCase() },
});

/** Errores del servidor llevados al campo (identificador fiscal o correo ya registrados, validación). */
export const companyServerErrors = (err: unknown): FieldErrors<CompanyFormValues> =>
  fieldErrorsFrom<CompanyFormValues>(err, { COMPANY_TAX_ID_TAKEN: 'tax_id', EMAIL_TAKEN: 'admin_email' });

interface CompanyFormOptions {
  /** Alta: incluye el primer administrador. Edición: solo datos de la empresa. */
  withAdmin: boolean;
  /** Edición: la empresa misma (su identificador fiscal no cuenta como duplicado). */
  excludeId?: number;
  /** Edición: el identificador que ya tiene (sin cambios no se vuelve a consultar). */
  original?: Pick<CompanyFormValues, 'tax_country' | 'tax_id_type' | 'tax_id'>;
  /** Edición: sus validadores activos (el límite no puede ser menor). */
  minValidators?: number;
}

/** Formulario de empresa con validación en vivo y botón habilitado solo con todo correcto. */
export function useCompanyForm({ withAdmin, excludeId, original, minValidators = 0 }: CompanyFormOptions) {
  const form = useFormState<CompanyFormValues>(emptyCompanyForm, {
    serverErrors: companyServerErrors,
    untouchedOnLoad: ['admin_email', 'admin_password', 'admin_password_confirm'],
  });
  const { values } = form;
  const taxIdType = useCatalogs().byCode('tax_id_types', values.tax_id_type);
  const taxIdError = validateTaxId(values.tax_id, taxIdType);
  // Validación en vivo por el canal del backend: el identificador fiscal (formato completo de su tipo, dígito
  // verificador y único: «país:tipo» viaja en `related`) y el correo del administrador (únicos) y el teléfono
  // (formato, con la misma regla que al guardar). La empresa tiene un solo correo: el de su administrador.
  const live = {
    tax_id: useAvailability('company_tax_id', values.tax_id, {
      excludeId,
      related: `${values.tax_country}:${values.tax_id_type}`,
      // Sin cambios (el mismo país, tipo y número que ya tiene) no se consulta.
      unchangedValue: original && taxIdKey(original) === taxIdKey(values) ? values.tax_id : undefined,
      enabled: !taxIdError,
    }),
    admin_email: useAvailability('company_admin_email', values.admin_email, {
      enabled: withAdmin && !validateEmail(values.admin_email),
    }),
    phone: useAvailability('company_phone', values.phone, { enabled: values.phone.length > 4 }),
  };

  const validatorsError = validateMaxValidators(values.max_validators, minValidators);
  const clientErrors = { ...validateCompanyForm(values, { withAdmin, taxIdType }), ...(validatorsError ? { max_validators: validatorsError } : {}) };
  const errors = form.visibleErrors(clientErrors);
  const liveFields = ['tax_id', 'admin_email', 'phone'] as const;
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
