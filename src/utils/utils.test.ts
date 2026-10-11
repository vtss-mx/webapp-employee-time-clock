import { describe, expect, it, vi } from 'vitest';
import { haptic } from './haptics';
import { envBoolean, envNumber, envNumberList, envString } from './env';
import {
  ageFrom,
  businessDate,
  businessHour,
  businessToday,
  DEFAULT_TIME_ZONE,
  formatConfidence,
  formatDate,
  formatDateTime,
  formatPercent,
  initials,
  setBusinessTimeZone,
  timeAgo,
} from './format';
import { hasKeys, isArrayOf, isNothing, isPage, isRecord } from './guards';
import { purgeLegacyStorage } from './legacyStorage';
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
  validatePasswordConfirm,
  validateRfc,
} from './validation';
import { validateEmployeeForm } from './formRules';
import { catalogsFixture, catalogsWith } from '../test/catalogs';
import { isCatalogs } from './catalogs';
import { countryDirectory, formatNational, formatPhone, joinPhone, validatePhone, type PhoneParts } from './phone';

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
  it('lee listas de números: ordenadas, sin repetidos y dentro de los límites', () => {
    const lists = { SIZES: '30, 10,20,10, 0, 80, x', NONE: 'x, 0' };
    expect(envNumberList(lists, 'SIZES', [5], 1, 50)).toEqual([10, 20, 30]);
    expect(envNumberList(lists, 'NONE', [5], 1, 50)).toEqual([5]);
    expect(envNumberList(lists, 'MISSING', [10, 20])).toEqual([10, 20]);
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
  it('fechas y horas en la zona del negocio (hora del Centro), no en la del dispositivo', () => {
    const instant = '2026-10-03T05:30:00Z'; // 23:30 del 2 de octubre en el Centro (UTC−6)
    expect(businessToday(new Date(instant))).toBe('2026-10-02');
    expect(businessHour(new Date(instant))).toBe(23);
    expect(formatDateTime(instant)).toMatch(/2 oct 2026/);
    expect(formatDate('2026-03-15')).toMatch(/15 mar 2026/); // fecha de calendario: no se desplaza
    setBusinessTimeZone('Asia/Tokyo');
    expect(businessToday(new Date(instant))).toBe('2026-10-03');
    setBusinessTimeZone('Zona/Inexistente'); // se ignora: sigue la de Tokio
    expect(businessToday(new Date(instant))).toBe('2026-10-03');
    setBusinessTimeZone(null);
    setBusinessTimeZone(DEFAULT_TIME_ZONE);
    expect(businessDate(new Date(instant)).getDate()).toBe(2);
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
    expect(validatePassword('Segura123456')).toBeUndefined();
    expect(validateBirthDate('')).toBeDefined();
    expect(validateBirthDate(maxBirthDate())).toBeUndefined();
    // Regresión: a las 23:30 hora local (UTC ya es el día siguiente) la fecha máxima sigue siendo válida.
    expect(maxBirthDate(new Date(2026, 8, 30, 23, 30))).toBe('2010-09-30');
    expect(validateBirthDate('2999-01-01')).toBeDefined();
    // El número es opcional: vacío no es un error; con valor, su formato.
    expect(validateEmployeeNumber('')).toBeUndefined();
    expect(validateEmployeeNumber('   ')).toBeUndefined();
    expect(validateEmployeeNumber('EMP-001')).toBeUndefined();
    expect(validateEmployeeNumber(' EMP 1 ')).toBe('1-30 caracteres: letras, números, guion o guion bajo');
  });
  it('valida el formulario completo y permite contraseña opcional al editar', () => {
    const values = { first_name: 'Ana', last_name: 'Ruiz', birth_date: '1990-01-01', employee_number: 'EMP-1', rfc: 'RUAA900101AB1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '+526621234567', email: 'ana@e.com', password: '', password_confirm: '' };
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
    expect(validateRfc('PEGJ900515AB1', '1990-05-16')).toBe('El RFC indica nacimiento el 15/05/1990, pero la fecha de nacimiento es 16/05/1990');
    // El caso de la captura: RFC del 1 de septiembre con la fecha escrita como 03/09/2003.
    expect(validateRfc('TARS0309014K1', '2003-09-03')).toBe('El RFC indica nacimiento el 01/09/2003, pero la fecha de nacimiento es 03/09/2003');
    expect(validateRfc('TARS0309014K')).toBe('El RFC de una persona física tiene 13 caracteres; llevas 12');
    expect(validateRfc('PEGJ900515AB1', '')).toBeUndefined(); // sin fecha aún: no se compara
  });

  it('RFC, CURP y NSS son opcionales: vacíos no tienen nada que validar', () => {
    expect(validateRfc('')).toBeUndefined();
    expect(validateRfc(' - ', '1990-01-01')).toBeUndefined();
    expect(validateCurp('', '1990-01-01')).toBeUndefined();
    expect(validateNss(' ')).toBeUndefined();
  });

  it('el formulario acepta el RFC vacío y, si se captura, exige que coincida con la fecha', () => {
    const base = { first_name: 'Ana', last_name: 'Ruiz', birth_date: '1990-01-01', employee_number: 'E1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '+526621234567', email: 'a@e.com', password: 'Segura123456', password_confirm: 'Segura123456' };
    expect(validateEmployeeForm({ ...base, rfc: '' })).toEqual({});
    expect(validateEmployeeForm({ ...base, rfc: '', curp: '', nss: '' })).toEqual({});
    expect(validateEmployeeForm({ ...base, rfc: 'RUAA900102AB1' })).toHaveProperty('rfc');
    expect(validateEmployeeForm({ ...base, rfc: 'RUAA900101AB1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '+526621234567' })).toEqual({});
  });
});

describe('CURP, NSS y teléfono (mismas reglas que el backend)', () => {
  it('CURP: formato, entidad, fecha, dígito verificador y coincidencia con la fecha de nacimiento', () => {
    expect(normalizeCurp(' hegg-560427-mvzrrl04 ')).toBe('HEGG560427MVZRRL04');
    expect(validateCurp('HEGG560427MVZRRL04')).toBeUndefined(); // ejemplo oficial de RENAPO
    expect(curpCheckDigit('HEGG560427MVZRRL0')).toBe('4');
    expect(validateCurp('HEGG560427MVZRRL0')).toContain('18 caracteres');
    expect(validateCurp('HEGG560427MXXRRL04')).toContain('formato');
    expect(validateCurp('HEGG561327MVZRRL04')).toContain('fecha');
    expect(validateCurp('HEGG560427MVZRRL05')).toContain('dígito verificador');
    expect(validateCurp('HEGG560427MVZRRL04', '1956-04-27')).toBeUndefined();
    expect(validateCurp('HEGG560427MVZRRL04', '1956-04-28')).toBe('La CURP indica nacimiento el 27/04/1956, pero la fecha de nacimiento es 28/04/1956');
    expect(validateCurp('HEGG560427MVZRRL04', '2056-04-27')).toContain('siglo');
    expect(validateCurp('TARS030901HSRNZB1')).toBe('La CURP tiene 18 caracteres; llevas 17');
    expect(validateCurp('RUAA900101MSRRZL09', '1990-01-01')).toBeUndefined();
  });

  it('NSS: 11 dígitos con dígito verificador (Luhn)', () => {
    expect(luhnValid('12345678903')).toBe(true);
    expect(validateNss('1234 5678 903')).toBeUndefined();
    expect(validateNss('12345678904')).toContain('dígito verificador');
    expect(validateNss('123')).toContain('11 dígitos');
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
    const phones = countryDirectory(catalogsFixture.countries);
    const country = (code: string) => phones.options.find((c) => c.code === code);
    const parts = (result: PhoneParts | null) => result && { country: result.country.code, national: result.national };
    const mx = phones.defaultCountry;
    expect(joinPhone(mx, '662 123 4567')).toBe('+526621234567');
    expect(joinPhone(mx, '')).toBe('');
    expect(formatNational(mx, '6621234567')).toBe('662 123 4567');
    expect(parts(phones.split('+526621234567'))).toEqual({ country: 'MX', national: '6621234567' });
    expect(parts(phones.split('+14165551234', mx))).toEqual({ country: 'CA', national: '4165551234' }); // +1 compartido
    expect(parts(phones.split('+1415', country('US')))).toEqual({ country: 'US', national: '415' }); // escribiendo
    expect(parts(phones.split('', country('ES')))).toEqual({ country: 'ES', national: '' });
    expect(parts(phones.split('6621234567', country('ES')))).toEqual({ country: 'ES', national: '6621234567' }); // sin lada
    expect(parts(phones.parse('0034 612 34 56 78'))).toEqual({ country: 'ES', national: '612345678' });
    expect(parts(phones.parse('+1 268 464 1234', country('US')))).toEqual({ country: 'AG', national: '2684641234' }); // Antigua
    expect(phones.parse('hola')).toBeNull();
  });

  it('teléfono: países del catálogo (activos y en su orden); por omisión, el primer frecuente', () => {
    const phones = countryDirectory(catalogsFixture.countries);
    expect(phones.options.map((c) => c.code)).toEqual(catalogsFixture.countries.map((c) => c.code));
    expect(phones.defaultCountry).toMatchObject({ code: 'MX', name: 'México', dialCode: '+52', featured: true, flag: '🇲🇽' });

    const [mx, us, ...rest] = catalogsFixture.countries;
    const edited = countryDirectory([{ ...mx, active: false }, { ...us, sort_order: 0 }, { ...rest[0], code: 'XX' }, ...rest.slice(1)]);
    expect(edited.options.map((c) => c.code)).not.toContain('MX'); // inactivo
    expect(edited.options.map((c) => c.code)).not.toContain('XX'); // sin metadatos de libphonenumber
    expect(edited.defaultCountry.code).toBe('US');
    // Número de un país inactivo y sin otro con su lada: se queda el país preferido.
    expect(edited.parse('+526621234567')?.country.code).toBe('US');

    const notFeatured = countryDirectory(catalogsFixture.countries.filter((c) => !c.featured));
    expect(notFeatured.defaultCountry.code).toBe('AF');
    expect(() => countryDirectory([])).toThrow(/no tiene países activos/);
  });
});

describe('catálogos', () => {
  it('búsqueda por código (también inactivos), nombre con respaldo y listas de activos', () => {
    const [periodic, ...others] = catalogsFixture.reverification_reasons;
    const catalogs = catalogsWith({ reverification_reasons: [{ ...periodic, active: false }, ...others] });
    expect(catalogs.byCode('roles', 'COMPANY')?.name).toBe('Empresa');
    expect(catalogs.byCode('reverification_reasons', 'PERIODIC')?.name).toBe('Actualización periódica de identidad'); // inactivo
    expect(catalogs.byCode('roles', null)).toBeUndefined();
    expect(catalogs.byCode('roles', 'GUEST')).toBeUndefined();
    expect(catalogs.nameOf('verification_methods', 'QR_FACE')).toBe('QR + rostro');
    expect(catalogs.nameOf('roles', 'GUEST')).toBe('GUEST'); // sin registro: el código
    expect(catalogs.nameOf('verification_reasons', null, 'Fallida')).toBe('Fallida');
    expect(catalogs.nameOf('roles', undefined)).toBe('');
    expect(catalogs.active('reverification_reasons').map((r) => r.code)).toEqual(others.map((r) => r.code));
    expect(catalogs.active('roles')).toBe(catalogs.active('roles')); // calculada una vez
    expect(catalogs.countries).toBe(catalogsFixture.countries);
  });

  it('valida la forma de GET /api/catalogs', () => {
    expect(isCatalogs(catalogsFixture)).toBe(true);
    expect(isCatalogs({ ...catalogsFixture, face_errors: null })).toBe(false);
    expect(isCatalogs({ ...catalogsFixture, roles: [{ code: 'ADMIN' }] })).toBe(false);
    expect(isCatalogs([])).toBe(false);
  });
});

describe('almacenamiento heredado', () => {
  it('la app no guarda en Web Storage: solo borra lo que dejaron versiones anteriores', () => {
    const legacy = ['tc.login.email', 'tc.sidebar.collapsed', 'tc.camera.granted', 'tc.signed-in', 'tc.camera.user', 'tc.camera.environment'];
    legacy.forEach((key) => localStorage.setItem(key, '1'));
    sessionStorage.setItem('tc.chunk-reload', '1');
    localStorage.setItem('otra-app', 'x'); // lo ajeno no se toca
    purgeLegacyStorage();
    expect(legacy.map((key) => localStorage.getItem(key))).toEqual(legacy.map(() => null));
    expect(sessionStorage.getItem('tc.chunk-reload')).toBeNull();
    expect(localStorage.getItem('otra-app')).toBe('x');
  });
  it('tolera un almacenamiento bloqueado', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => purgeLegacyStorage()).not.toThrow();
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

describe('confirmar contraseña', () => {
  const employee = { first_name: 'Ana', last_name: 'Ruiz', birth_date: '1990-01-01', employee_number: 'EMP-1', rfc: 'RUAA900101AB1', curp: 'RUAA900101MSRRZL09', nss: '12345678903', phone: '+526621234567', email: 'a@e.com', password: 'Segura123456', password_confirm: 'Segura123456' };

  it('toda contraseña que se asigna se repite y debe coincidir', () => {
    expect(validatePasswordConfirm('Segura123456', 'Segura123456')).toBeUndefined();
    expect(validatePasswordConfirm('Segura123456', '')).toBe('Repite la contraseña');
    expect(validatePasswordConfirm('Segura123456', 'Segura124456')).toBe('Las contraseñas no coinciden');
    expect(validateEmployeeForm({ ...employee, password_confirm: 'Otra12345678' }).password_confirm).toBe('Las contraseñas no coinciden');
    // Edición sin cambiar la contraseña: no se pide repetirla.
    expect(validateEmployeeForm({ ...employee, password: '', password_confirm: '' }, { passwordOptional: true }).password_confirm).toBeUndefined();
  });
});
