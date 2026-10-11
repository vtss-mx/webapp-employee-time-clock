import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/core';
import { TAX_ID_TYPES } from '../test/catalogs';
import { DeviceKeyError } from './deviceKey';
import { validateCompanyForm, validateEmployeeForm } from './formRules';
import { countryDirectory, validatePhone } from './phone';
import { describeDevice } from './userAgent';
import {
  MIN_EMPLOYEE_AGE,
  validateBirthDate,
  validateCompanyRfc,
  validateCurp,
  validateEmail,
  validateEmployeeNumber,
  validateMaxEmployees,
  validateNss,
  validatePassword,
  validatePasswordConfirm,
  validateRfc,
} from './validation';

/**
 * Las validaciones del cliente en inglés (en-US): cada regla con su mensaje, las fechas de los
 * documentos en el orden de Estados Unidos (mes/día/año) y los textos que siguen al idioma después
 * de crearse (errores que se traducen al leerse).
 */

// "Hoy" fijo: 15 de junio de 2026 a mediodía en la hora del Centro (UTC−6).
const TODAY = new Date('2026-06-15T18:00:00Z');

describe('validación en inglés (en-US)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
    await setLocale('en-US');
  });
  afterEach(() => vi.useRealTimers());

  it('correo y contraseña', () => {
    expect(validateEmail('')).toBe('Email is required');
    expect(validateEmail('no-es-correo')).toBe('Enter a valid email');
    expect(validatePassword('')).toBe('Password is required');
    expect(validatePassword('Ab1')).toBe('Minimum 12 characters');
    expect(validatePassword('a'.repeat(129) + 'A1')).toBe('Maximum 128 characters');
    expect(validatePassword('SOLOMAYUS12345')).toBe('Must include a lowercase letter');
    expect(validatePassword('solominus12345')).toBe('Must include an uppercase letter');
    expect(validatePassword('SinNumerosAqui')).toBe('Must include a number');
    expect(validatePasswordConfirm('Segura123456', '')).toBe('Re-enter the password');
    expect(validatePasswordConfirm('Segura123456', 'Segura124456')).toBe('Passwords do not match');
  });

  it('formulario del empleado: etiquetas traducidas, fecha de nacimiento y número de empleado', () => {
    const errors = validateEmployeeForm({ first_name: '', last_name: 'Ruiz3', birth_date: '', employee_number: '', rfc: '', curp: '', nss: '', phone: '', email: '', password: '', password_confirm: '' });
    expect(errors).toMatchObject({
      first_name: 'First name is required',
      last_name: 'Only letters, spaces, apostrophes, periods, and hyphens',
      birth_date: 'Date of birth is required',
      phone: 'Phone number is required',
    });
    // The employee number, RFC, CURP, and NSS are optional: blank means not provided.
    expect(errors).not.toHaveProperty('employee_number');
    expect(errors).not.toHaveProperty('rfc');
    expect(errors).not.toHaveProperty('curp');
    expect(errors).not.toHaveProperty('nss');
    expect(validateEmployeeForm({ ...validEmployee(), last_name: '' }).last_name).toBe('Last name is required');
    expect(validateEmployeeForm({ ...validEmployee(), first_name: 'A'.repeat(101) }).first_name).toBe('Maximum 100 characters');
    expect(validateBirthDate('no-es-fecha')).toBe('Invalid date');
    expect(validateBirthDate('2026-06-15')).toBe('Must be before today');
    expect(validateBirthDate('2015-01-01')).toBe(`The employee must be at least ${MIN_EMPLOYEE_AGE} years old`);
    expect(validateEmployeeNumber('*')).toBe('1-30 characters: letters, numbers, hyphens, or underscores');
  });

  it('RFC, CURP y NSS: las fechas del documento en el orden de en-US (mes/día/año)', () => {
    expect(validateRfc('XAXX010101000')).toBe("The generic RFC isn't valid; enter the real one");
    expect(validateRfc('TARS0309014K')).toBe('An individual RFC has 13 characters; you entered 12');
    expect(validateRfc('PEGJ9005ABAB1')).toBe('Check the RFC format (e.g., PEGJ900515AB1)');
    expect(validateRfc('PEGJ901315AB1')).toBe('The RFC date (yymmdd) is not valid');
    expect(validateRfc('TARS0309014K1', '2003-09-03')).toBe('The RFC indicates a birth date of 09/01/2003, but the date of birth is 09/03/2003');
    expect(validateCurp('TARS030901HSRNZB1')).toBe('The CURP has 18 characters; you entered 17');
    expect(validateCurp('HEGG560427MXXRRL04')).toBe('Check the CURP format (e.g., HEGG560427MVZRRL04)');
    expect(validateCurp('HEGG561327MVZRRL04')).toBe('The CURP date (yymmdd) is not valid');
    expect(validateCurp('HEGG560427MVZRRL05')).toBe("The CURP check digit doesn't match");
    expect(validateCurp('HEGG560427MVZRRL04', '1956-04-28')).toBe('The CURP indicates a birth date of 04/27/1956, but the date of birth is 04/28/1956');
    expect(validateCurp('HEGG560427MVZRRL04', '2056-04-27')).toMatch(/^The CURP's 17th character doesn't match the birth century/);
    expect(validateNss('123')).toBe('The NSS has 11 digits');
    expect(validateNss('12345678904')).toBe("The NSS check digit doesn't match");
  });

  it('formulario de la empresa: nombre comercial, razón social, identificador fiscal y límite de empleados', () => {
    const company = { name: '', legal_name: ' A ', tax_country: 'MX', tax_id_type: 'MX_RFC', tax_id: 'ABC1', phone: '+52662123456', max_employees: '0', max_validators: '0', admin_email: '', admin_password: '', admin_password_confirm: '' };
    const errors = validateCompanyForm(company, { taxIdType: TAX_ID_TYPES[0] });
    expect(errors).toMatchObject({
      name: 'Trade name is required',
      legal_name: 'Legal name is required',
      tax_id: 'The RFC must have 12 characters (legal entity) or 13 (individual)',
      phone: 'The phone number is not valid for country code +52',
      max_employees: 'Enter a whole number greater than 0',
    });
    expect(validateCompanyForm({ ...validCompany(), name: 'X'.repeat(201) }, { withAdmin: false }).name).toBe('Maximum 200 characters');
    expect(validateCompanyRfc('ABC991332XY1')).toBe('The RFC date (yymmdd) is not valid');
    // Los demás tipos: el largo y el formato de su regla del catálogo (los mismos textos del backend).
    const [ein, cuit] = ['US_EIN', 'AR_CUIT'].map((code) => TAX_ID_TYPES.find((type) => type.code === code));
    expect(validateCompanyForm({ ...company, tax_id: '1234' }, { taxIdType: ein }).tax_id).toBe('The EIN must have 9 characters');
    expect(validateCompanyForm({ ...company, tax_id: '11693450239' }, { taxIdType: cuit }).tax_id).toBe("The CUIT format isn't valid (e.g., 30500010912)");
    expect(validateMaxEmployees('2.5')).toBe('Enter a whole number greater than 0');
  });

  it('dispositivo leído del User-Agent', () => {
    expect(describeDevice(null).label).toBe('Unknown device');
    expect(describeDevice('curl/8').label).toBe('Browser · Unknown system');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari/604.1').label).toBe('Safari · iOS');
  });
});

describe('errores que se traducen al leerse (siguen al idioma activo)', () => {
  it('catálogo de países sin países activos', async () => {
    let error: unknown = null;
    try {
      countryDirectory([]);
    } catch (thrown) {
      error = thrown;
    }
    expect((error as Error).message).toBe('El catálogo de países no tiene países activos');
    await setLocale('en-US');
    expect((error as Error).message).toBe('The country catalog has no active countries');
  });

  it('el navegador no permite registrar el dispositivo', async () => {
    const error = new DeviceKeyError();
    expect(error.name).toBe('DeviceKeyError');
    expect(error.message).toMatch(/^Este navegador no permite registrar el dispositivo/);
    await setLocale('en-US');
    expect(error.message).toBe('This browser cannot register the device. Use an up-to-date Safari or Chrome, outside private mode.');
  });

  it('teléfono: el mensaje se pide al validar, en el idioma activo', async () => {
    expect(validatePhone('')).toBe('El teléfono es obligatorio');
    await setLocale('en-US');
    expect(validatePhone('')).toBe('Phone number is required');
  });
});

function validEmployee() {
  return { first_name: 'Ana', last_name: 'Ruiz', birth_date: '1990-01-01', employee_number: 'E1', rfc: 'RUAA900101AB1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '+526621234567', email: 'a@e.com', password: 'Segura123456', password_confirm: 'Segura123456' };
}

function validCompany() {
  return { name: 'Acme', legal_name: 'Acme SA de CV', tax_country: 'MX', tax_id_type: 'MX_RFC', tax_id: 'ACM010101AB1', phone: '+526621234567', max_employees: '', max_validators: '0', admin_email: '', admin_password: '', admin_password_confirm: '' };
}
