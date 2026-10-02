import { describe, expect, it, vi } from 'vitest';
import { downloadUrl } from './download';
import { haptic } from './haptics';
import { envBoolean, envNumber, envString } from './env';
import { ageFrom, formatConfidence, formatDate, formatDateTime, formatPercent, initials, timeAgo } from './format';
import { hasKeys, isArrayOf, isNothing, isPage, isRecord } from './guards';
import { preferenceStore, tabStore } from './storage';
import {
  curpCheckDigit,
  luhnValid,
  maxBirthDate,
  normalizeCurp,
  normalizeRfc,
  validateBirthDate,
  validateCurp,
  validateEmail,
  validateEmployeeNumber,
  validateNss,
  validatePassword,
  validateRfc,
} from './validation';
import { validateEmployeeForm } from './formRules';
import { formatPhone, joinPhone, parseInternational, splitPhone, validatePhone } from './phone';

describe('env', () => {
  const env = { A: ' hola ', N: '42', BAD: 'x', T: 'yes', F: 'off', BOOL: true, EMPTY: '' };
  it('lee cadenas con valor por defecto', () => {
    expect(envString(env, 'A', 'd')).toBe('hola');
    expect(envString(env, 'EMPTY', 'd')).toBe('d');
    expect(envString(env, 'MISSING', 'd')).toBe('d');
  });
  it('lee números con límites y descarta valores inválidos', () => {
    expect(envNumber(env, 'N', 1)).toBe(42);
    expect(envNumber(env, 'N', 1, 0, 10)).toBe(10);
    expect(envNumber(env, 'N', 1, 50)).toBe(50);
    expect(envNumber(env, 'BAD', 7)).toBe(7);
    expect(envNumber(env, 'EMPTY', 7)).toBe(7);
  });
  it('lee booleanos en varios formatos', () => {
    expect(envBoolean(env, 'T', false)).toBe(true);
    expect(envBoolean(env, 'F', true)).toBe(false);
    expect(envBoolean(env, 'BOOL', false)).toBe(true);
    expect(envBoolean(env, 'BAD', true)).toBe(true);
    expect(envBoolean(env, 'MISSING', false)).toBe(false);
  });
});

describe('guards', () => {
  it('valida objetos, claves, páginas y colecciones', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(hasKeys('a', 'b')({ a: 1, b: 2 })).toBe(true);
    expect(hasKeys('a', 'b')({ a: 1 })).toBe(false);
    expect(isPage()({ items: [], total: 0 })).toBe(true);
    expect(isPage(hasKeys('id'))({ items: [{ id: 1 }, {}], total: 2 })).toBe(false);
    expect(isPage()({ items: 'x', total: 0 })).toBe(false);
    expect(isArrayOf(hasKeys('id'))([{ id: 1 }])).toBe(true);
    expect(isArrayOf(hasKeys('id'))({})).toBe(false);
    expect(isNothing(null) && isNothing(undefined) && !isNothing(0)).toBe(true);
  });
});

describe('format', () => {
  it('confianza truncada a 3 decimales y nunca 100 %', () => {
    expect(formatConfidence(null)).toBe('—');
    expect(formatConfidence(0.999996)).toBe('99.999 %');
    expect(formatConfidence(1)).toBe('99.999 %');
    expect(formatConfidence(0.95)).toBe('95 %');
  });

  it('formatea fechas, porcentajes e iniciales', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('no-fecha')).toBe('no-fecha');
    expect(formatDate('2026-03-15')).toMatch(/2026/);
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('x')).toBe('x');
    expect(formatDateTime('2026-03-15T10:00:00Z')).toMatch(/2026/);
    expect(formatPercent(0.834)).toBe('83%');
    expect(formatPercent(null)).toBe('—');
    expect(initials('juan perez')).toBe('JP');
    expect(initials('admin@empresa.com')).toBe('AE');
  });
  it('calcula edad y tiempo relativo', () => {
    const year = new Date().getFullYear();
    expect(ageFrom(`${year - 30}-01-01`)).toBeGreaterThanOrEqual(29);
    expect(timeAgo(null)).toBe('—');
    expect(timeAgo(new Date().toISOString())).toBe('hace un momento');
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toMatch(/5 minutos/);
    expect(timeAgo(new Date(Date.now() - 3 * 3_600_000).toISOString())).toMatch(/3 horas/);
    expect(timeAgo(new Date(Date.now() - 3 * 86_400_000).toISOString())).toMatch(/3 días/);
    expect(timeAgo('2020-06-15T12:00:00Z')).toMatch(/2020/);
  });
});

describe('validation', () => {
  it('valida campos individuales', () => {
    expect(validateEmail('')).toBeDefined();
    expect(validateEmail('no-es-correo')).toBeDefined();
    expect(validateEmail('a@b.com')).toBeUndefined();
    expect(validatePassword('corta')).toBeDefined();
    expect(validatePassword('Segura123')).toBeUndefined();
    expect(validateBirthDate('')).toBeDefined();
    expect(validateBirthDate(maxBirthDate())).toBeUndefined();
    // Regresión: a las 23:30 hora local (UTC ya es el día siguiente) la fecha máxima sigue siendo válida.
    expect(maxBirthDate(new Date(2026, 8, 30, 23, 30))).toBe('2010-09-30');
    expect(validateBirthDate('2999-01-01')).toBeDefined();
    expect(validateEmployeeNumber('')).toBeDefined();
    expect(validateEmployeeNumber('EMP-001')).toBeUndefined();
  });
  it('valida el formulario completo y permite contraseña opcional al editar', () => {
    const values = { first_name: 'Ana', last_name: 'Ruiz', birth_date: '1990-01-01', employee_number: 'EMP-1', rfc: 'RUAA900101AB1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '+526621234567', email: 'ana@e.com', password: '' };
    expect(validateEmployeeForm(values)).toHaveProperty('password');
    expect(validateEmployeeForm(values, { passwordOptional: true })).toEqual({});
  });
});

describe('RFC', () => {
  it('normaliza: mayúsculas, sin espacios, guiones ni caracteres no válidos', () => {
    expect(normalizeRfc(' pegj-900515 ab1 ')).toBe('PEGJ900515AB1');
    expect(normalizeRfc('ñañe000229xya')).toBe('ÑAÑE000229XYA');
    expect(normalizeRfc('pe.gj')).toBe('PEGJ');
  });

  it.each([
    ['', 'obligatorio'],
    ['XAXX010101000', 'genérico'],
    ['PEG900515AB1', '13 caracteres'],
    ['PEGJ9005ABAB1', 'formato'],
    ['PEGJ901315AB1', 'fecha del RFC'],
    ['PEGJ010229AB1', 'fecha del RFC'],
  ])('rechaza %s', (value, message) => {
    expect(validateRfc(value)).toContain(message);
  });

  it('acepta RFC válidos (incluye 29 de febrero de 2000) y verifica la fecha de nacimiento', () => {
    expect(validateRfc('pegj-900515-ab1')).toBeUndefined();
    expect(validateRfc('ÑAÑE000229XYA')).toBeUndefined();
    expect(validateRfc('PEGJ900515AB1', '1990-05-15')).toBeUndefined();
    expect(validateRfc('PEGJ900515AB1', '1990-05-16')).toBe('El RFC no coincide con la fecha de nacimiento');
    expect(validateRfc('PEGJ900515AB1', '')).toBeUndefined(); // sin fecha aún: no se compara
  });

  it('el formulario exige el RFC y su coincidencia con la fecha', () => {
    const base = { first_name: 'Ana', last_name: 'Ruiz', birth_date: '1990-01-01', employee_number: 'E1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '+526621234567', email: 'a@e.com', password: 'Segura123' };
    expect(validateEmployeeForm({ ...base, rfc: '' })).toHaveProperty('rfc', 'El RFC es obligatorio');
    expect(validateEmployeeForm({ ...base, rfc: 'RUAA900102AB1' })).toHaveProperty('rfc');
    expect(validateEmployeeForm({ ...base, rfc: 'RUAA900101AB1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '+526621234567' })).toEqual({});
  });
});

describe('CURP, NSS y teléfono (mismas reglas que el backend)', () => {
  it('CURP: formato, entidad, fecha, dígito verificador y coincidencia con la fecha de nacimiento', () => {
    expect(normalizeCurp(' hegg-560427-mvzrrl04 ')).toBe('HEGG560427MVZRRL04');
    expect(validateCurp('HEGG560427MVZRRL04')).toBeUndefined(); // ejemplo oficial de RENAPO
    expect(curpCheckDigit('HEGG560427MVZRRL0')).toBe('4');
    expect(validateCurp('')).toBe('La CURP es obligatoria');
    expect(validateCurp('HEGG560427MVZRRL0')).toContain('18 caracteres');
    expect(validateCurp('HEGG560427MXXRRL04')).toContain('formato');
    expect(validateCurp('HEGG561327MVZRRL04')).toContain('fecha');
    expect(validateCurp('HEGG560427MVZRRL05')).toContain('dígito verificador');
    expect(validateCurp('HEGG560427MVZRRL04', '1956-04-27')).toBeUndefined();
    expect(validateCurp('HEGG560427MVZRRL04', '1956-04-28')).toBe('La CURP no coincide con la fecha de nacimiento');
    expect(validateCurp('RUAA900101MSRRZL09', '1990-01-01')).toBeUndefined();
  });

  it('NSS: 11 dígitos con dígito verificador (Luhn)', () => {
    expect(luhnValid('12345678903')).toBe(true);
    expect(validateNss('1234 5678 903')).toBeUndefined();
    expect(validateNss('12345678904')).toContain('dígito verificador');
    expect(validateNss('123')).toContain('11 dígitos');
    expect(validateNss('')).toBe('El NSS es obligatorio');
  });

  it('teléfono internacional (E.164): valida por país igual que el backend y se muestra con lada', () => {
    expect(validatePhone('+526621234567')).toBeUndefined();
    expect(validatePhone('+14155552671')).toBeUndefined();
    expect(validatePhone('+34612345678')).toBeUndefined();
    expect(validatePhone('+52662123456')).toBe('El teléfono no es válido para la lada +52');
    expect(validatePhone('+525555555555')).toContain('no es válido'); // un solo dígito repetido
    expect(validatePhone('123')).toContain('no es válido');
    expect(validatePhone('')).toBe('El teléfono es obligatorio');
    expect(formatPhone('+526621234567')).toBe('+52 662 123 4567');
    expect(formatPhone('texto')).toBe('texto');
  });

  it('teléfono: país y número ↔ E.164, también al pegar con lada', () => {
    expect(joinPhone('MX', '662 123 4567')).toBe('+526621234567');
    expect(joinPhone('MX', '')).toBe('');
    expect(splitPhone('+526621234567')).toEqual({ country: 'MX', national: '6621234567' });
    expect(splitPhone('+14165551234', 'MX')).toEqual({ country: 'CA', national: '4165551234' }); // +1 compartido
    expect(splitPhone('+1415', 'US')).toEqual({ country: 'US', national: '415' }); // escribiendo
    expect(splitPhone('', 'ES')).toEqual({ country: 'ES', national: '' });
    expect(parseInternational('0034 612 34 56 78')).toEqual({ country: 'ES', national: '612345678' });
    expect(parseInternational('hola')).toBeNull();
  });
});

describe('storage y descarga', () => {
  it('guarda y elimina valores sin lanzar excepciones', () => {
    preferenceStore.set('k', 'v');
    expect(preferenceStore.get('k')).toBe('v');
    preferenceStore.remove('k');
    expect(preferenceStore.get('k')).toBeNull();
    tabStore.set('t', '1');
    expect(tabStore.get('t')).toBe('1');
  });
  it('tolera un storage bloqueado', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(preferenceStore.get('x')).toBeNull();
  });
  it('descarga mediante un enlace temporal', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadUrl('data:image/png;base64,AAA', 'qr.png');
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
  });
});

describe('haptic', () => {
  it('vibra breve al acertar y en patrón al fallar; sin soporte no hace nada', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    haptic('success');
    haptic('error');
    expect(vibrate.mock.calls).toEqual([[18], [[40, 60, 40]]]);
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    expect(() => haptic('success')).not.toThrow();
  });
});
