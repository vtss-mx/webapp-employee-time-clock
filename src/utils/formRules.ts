import type { CompanyFormValues, EmployeeFormValues } from '../types';
import { validatePhone } from './phone';
import {
  validateBirthDate,
  validateCompanyName,
  validateCompanyRfc,
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
 * Reglas completas de cada formulario. Viven aparte de `validation.ts` porque usan la validación
 * internacional de teléfonos (libphonenumber): así el login, que solo valida correo y contraseña,
 * no descarga esos metadatos.
 */
export function validateCompanyForm(values: CompanyFormValues, { withAdmin = true } = {}): FieldErrors<CompanyFormValues> {
  const errors: FieldErrors<CompanyFormValues> = {
    name: validateCompanyName(values.name, 'El nombre comercial'),
    legal_name: validateCompanyName(values.legal_name, 'La razón social'),
    rfc: validateCompanyRfc(values.rfc),
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
    first_name: validateName(values.first_name, 'El nombre'),
    last_name: validateName(values.last_name, 'El apellido'),
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

