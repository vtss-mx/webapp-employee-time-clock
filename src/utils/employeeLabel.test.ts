import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { employeeLabel, employeeNumberLabel } from './employeeLabel';
import { OPTIONAL_FIELDS, optionalPayload } from './formRules';

describe('nombrar a un empleado (el número es opcional)', () => {
  it('con número: «nombre · número» y, con prefijo, «No. número»', () => {
    expect(employeeNumberLabel('EMP-7')).toBe('No. EMP-7');
    expect(employeeLabel({ full_name: 'Ana Ruiz', employee_number: 'EMP-7' })).toBe('Ana Ruiz · EMP-7');
    expect(employeeLabel({ full_name: 'Ana Ruiz', employee_number: 'EMP-7' }, { prefixed: true })).toBe('Ana Ruiz · No. EMP-7');
  });

  it('sin número: solo el nombre, sin separadores colgando ni «null»', () => {
    for (const employee_number of [null, undefined, '']) {
      expect(employeeNumberLabel(employee_number)).toBe('');
      expect(employeeLabel({ full_name: 'Ana Ruiz', employee_number })).toBe('Ana Ruiz');
      expect(employeeLabel({ full_name: 'Ana Ruiz', employee_number }, { prefixed: true })).toBe('Ana Ruiz');
    }
    expect(employeeLabel({ full_name: 'Ana Ruiz' })).toBe('Ana Ruiz');
  });

  it('sigue al idioma activo', async () => {
    await setLocale('en-US');
    expect(employeeLabel({ full_name: 'Ana Ruiz', employee_number: 'EMP-7' }, { prefixed: true })).toBe('Ana Ruiz · No. EMP-7');
    expect(employeeNumberLabel(null)).toBe('');
  });
});

describe('datos opcionales del empleado', () => {
  it('número, RFC, CURP y NSS: lo escrito sin espacios o null si quedó vacío', () => {
    expect(OPTIONAL_FIELDS).toEqual(['employee_number', 'rfc', 'curp', 'nss']);
    expect(optionalPayload({ employee_number: ' EMP-9 ', rfc: '  ', curp: '', nss: '12345678903' })).toEqual({
      employee_number: 'EMP-9',
      rfc: null,
      curp: null,
      nss: '12345678903',
    });
    expect(optionalPayload({ employee_number: '', rfc: '', curp: '', nss: '' })).toEqual({ employee_number: null, rfc: null, curp: null, nss: null });
  });
});
