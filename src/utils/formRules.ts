import { t } from '../i18n/core';
import type { CompanyFormValues, EmployeeFormValues, OptionalDocument, OptionalDocuments, TaxIdTypeItem } from '../types';
import { validatePhone } from './phone';
import { validateTaxId } from './taxId';
import {
  validateBirthDate,
  validateCompanyName,
  validateCurp,
  validateEmail,
  validateEmployeeNumber,
  validateMaxEmployees,
  validateName,
  validateNss,
  validatePassword,
  validatePasswordConfirm,
  validateRfc,
  type FieldErrors,
} from './validation';

/** Formulario de empleado vacío (alta): lo comparten el hook del formulario, sus campos y las pruebas. */
export const emptyEmployeeForm: EmployeeFormValues = {
  first_name: '',
  last_name: '',
  birth_date: '',
  curp: '',
  rfc: '',
  nss: '',
  employee_number: '',
  phone: '',
  email: '',
  password: '',
  password_confirm: '',
};

/**
 * RFC, CURP y NSS del empleado son opcionales (decisión del dueño del producto: la plataforma se abre a otros
 * países). Vacíos no se validan ni se consultan en vivo y viajan como null.
 */
export const OPTIONAL_DOCUMENTS: readonly OptionalDocument[] = ['rfc', 'curp', 'nss'];

/** Los documentos como los recibe el backend al registrar: lo escrito, o null si quedó vacío (sin capturar). */
export function documentsPayload({ rfc, curp, nss }: Pick<EmployeeFormValues, OptionalDocument>): OptionalDocuments {
  return { rfc: rfc.trim() || null, curp: curp.trim() || null, nss: nss.trim() || null };
}

/**
 * Reglas completas de cada formulario. Viven aparte de `validation.ts` porque usan la validación
 * internacional de teléfonos (libphonenumber): así el login, que solo valida correo y contraseña,
 * no descarga esos metadatos.
 */
export function validateCompanyForm(
  values: CompanyFormValues,
  { withAdmin = true, taxIdType }: { withAdmin?: boolean; taxIdType?: TaxIdTypeItem } = {},
): FieldErrors<CompanyFormValues> {
  const errors: FieldErrors<CompanyFormValues> = {
    name: validateCompanyName(values.name, t('forms.required.tradeName')),
    legal_name: validateCompanyName(values.legal_name, t('forms.required.legalName')),
    tax_id: validateTaxId(values.tax_id, taxIdType),
    phone: validatePhone(values.phone),
    max_employees: validateMaxEmployees(values.max_employees),
    ...(withAdmin
      ? {
          admin_email: validateEmail(values.admin_email),
          admin_password: validatePassword(values.admin_password),
          admin_password_confirm: validatePasswordConfirm(values.admin_password, values.admin_password_confirm),
        }
      : {}),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

/** `passwordOptional` se usa en edición: vacío = no cambiar. */
export function validateEmployeeForm(
  values: EmployeeFormValues,
  { passwordOptional = false } = {},
): FieldErrors<EmployeeFormValues> {
  const errors: FieldErrors<EmployeeFormValues> = {
    first_name: validateName(values.first_name, t('forms.required.firstName')),
    last_name: validateName(values.last_name, t('forms.required.lastName')),
    birth_date: validateBirthDate(values.birth_date),
    employee_number: validateEmployeeNumber(values.employee_number),
    rfc: validateRfc(values.rfc, values.birth_date),
    curp: validateCurp(values.curp, values.birth_date),
    nss: validateNss(values.nss),
    phone: validatePhone(values.phone),
    email: validateEmail(values.email),
    password: passwordOptional && !values.password ? undefined : validatePassword(values.password),
    password_confirm: passwordOptional && !values.password ? undefined : validatePasswordConfirm(values.password, values.password_confirm),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
}

