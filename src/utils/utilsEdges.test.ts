import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogsFixture } from '../test/catalogs';
import { ApiError } from '../services/apiClient';
import { parseRemembered } from './cameraDevices';
import { describeError } from './errorPresentation';
import { ageFrom, formatDate } from './format';
import { countryDirectory } from './phone';
import {
  validateBirthDate,
  validateCompanyName,
  validateCompanyRfc,
  validateEmployeeNumber,
  validateMaxEmployees,
  validateName,
  validatePassword,
} from './validation';

/**
 * Casos límite de las utilidades puras: cada regla con su mensaje (las mismas del backend), fechas
 * en la zona del negocio con un "hoy" fijo y lecturas defensivas de datos guardados o recibidos.
 */

// "Hoy" fijo: 15 de junio de 2026 a mediodía en la hora del Centro (UTC−6).
const TODAY = new Date('2026-06-15T18:00:00Z');

describe('validación de formularios: cada regla con su mensaje', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ['a'.repeat(129) + 'A1', 'Máximo 128 caracteres'],
    ['SOLOMAYUS1', 'Debe incluir una letra minúscula'],
    ['solominus1', 'Debe incluir una letra mayúscula'],
    ['SinNumeros', 'Debe incluir un número'],
  ])('contraseña %s → %s', (value, message) => {
    expect(validatePassword(value)).toBe(message);
  });

  it('nombres: obligatorio, largo máximo y solo letras', () => {
    expect(validateName('   ', 'El nombre')).toBe('El nombre es obligatorio');
    expect(validateName('A'.repeat(101), 'El nombre')).toBe('Máximo 100 caracteres');
    expect(validateName('Ana3', 'El nombre')).toBe('Solo letras, espacios, apóstrofes, puntos y guiones');
    expect(validateName(" María-José O'Neil ", 'El nombre')).toBeUndefined();
  });

  it('número de empleado: empieza con letra o número y solo admite guion o guion bajo', () => {
    expect(validateEmployeeNumber('-EMP')).toBe('1-30 caracteres: letras, números, guion o guion bajo');
    expect(validateEmployeeNumber('EMP 1')).toBe('1-30 caracteres: letras, números, guion o guion bajo');
    expect(validateEmployeeNumber('E'.repeat(31))).toBe('1-30 caracteres: letras, números, guion o guion bajo');
  });

  it('fecha de nacimiento: inválida, de hoy, menor de la edad mínima (aún sin cumplir años) o de más de 100 años', () => {
    expect(validateBirthDate('no-es-fecha')).toBe('Fecha inválida');
    expect(validateBirthDate('2026-06-15')).toBe('Debe ser anterior a hoy');
    // Cumple 16 en diciembre (mes posterior) o el 20 de junio (mismo mes, día posterior): aún tiene 15.
    expect(validateBirthDate('2010-12-01')).toBe('El empleado debe tener al menos 16 años');
    expect(validateBirthDate('2010-06-20')).toBe('El empleado debe tener al menos 16 años');
    expect(validateBirthDate('2010-06-15')).toBeUndefined(); // cumple 16 hoy
    expect(validateBirthDate('1920-01-01')).toBe('Fecha inválida');
  });

  it('edad cumplida hoy en la zona del negocio', () => {
    expect(ageFrom('2000-12-01')).toBe(25); // cumpleaños en un mes posterior
    expect(ageFrom('2000-06-20')).toBe(25); // mismo mes, día posterior
    expect(ageFrom('2000-06-15')).toBe(26); // hoy
    expect(ageFrom('2000-01-31')).toBe(26);
  });

  it('límite de empleados del plan: vacío o entero de 1 a 1 000 000', () => {
    expect(validateMaxEmployees('')).toBeUndefined();
    expect(validateMaxEmployees('25')).toBeUndefined();
    expect(validateMaxEmployees('1000000')).toBeUndefined();
    expect(validateMaxEmployees('1000001')).toBe('Escribe un número entero mayor a 0');
    expect(validateMaxEmployees('0')).toBe('Escribe un número entero mayor a 0');
    expect(validateMaxEmployees('2.5')).toBe('Escribe un número entero mayor a 0');
  });

  it('RFC de empresa: el genérico (13 caracteres) se rechaza con la regla de persona física, como el backend', () => {
    expect(validateCompanyRfc('XAXX010101000')).toBe('Captura el RFC personal del empleado; el RFC genérico no es válido');
    expect(validateCompanyRfc('ABC900515AB1')).toBeUndefined(); // persona moral (12)
    expect(validateCompanyRfc(' - ')).toBe('El RFC es obligatorio');
    expect(validateCompanyRfc('ABC9005')).toBe('El RFC debe tener 12 caracteres (persona moral) o 13 (persona física)');
    expect(validateCompanyRfc('ABC901315AB1')).toBe('La fecha del RFC (aammdd) no es válida');
  });

  it('nombre de empresa: espacios repetidos no cuentan y máximo 200 caracteres', () => {
    expect(validateCompanyName('  A   ', 'La razón social')).toBe('La razón social es obligatorio');
    expect(validateCompanyName('X'.repeat(201), 'La razón social')).toBe('Máximo 200 caracteres');
    expect(validateCompanyName(' Abarrotes   del  Centro ', 'La razón social')).toBeUndefined();
  });
});

describe('formato y lecturas defensivas', () => {
  it('una fecha de calendario imposible se muestra tal cual', () => {
    expect(formatDate('2026-13-45')).toBe('2026-13-45');
  });

  it('el mensaje de un error de la API vacío usa el texto por omisión', () => {
    const error = new ApiError({ statusCode: 409, code: 'CONFLICT', message: '', errors: [] });
    expect(describeError(error).text).toBe('Ocurrió un error inesperado. Intenta nuevamente.');
  });

  it('cámara recordada incompleta (sin lado o sin id) se ignora', () => {
    expect(parseRemembered({ deviceId: 'cam-1' })).toBeNull();
    expect(parseRemembered({ deviceId: '', kind: 'front' })).toBeNull();
    expect(parseRemembered({ deviceId: 7, kind: 'front' })).toBeNull();
    expect(parseRemembered(null)).toBeNull();
    expect(parseRemembered('cam-1')).toBeNull(); // formato anterior (texto): se ignora
    expect(parseRemembered({ deviceId: 'cam-1', kind: 'front' })).toEqual({ deviceId: 'cam-1', kind: 'front' });
  });

  it('teléfono de un país que no está en el catálogo: se queda el preferido si comparte la lada', () => {
    const withoutCanada = countryDirectory(catalogsFixture.countries.filter((c) => c.code !== 'CA'));
    const us = withoutCanada.options.find((c) => c.code === 'US');
    expect(withoutCanada.parse('+1 416 555 1234', us)?.country.code).toBe('US');
  });

});

describe('configuración', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('un tamaño de página que no está entre las opciones usa la primera opción', async () => {
    vi.stubEnv('VITE_PAGE_SIZES', '5,15,25');
    vi.stubEnv('VITE_PAGE_SIZE', '10');
    vi.resetModules();
    const { config } = await import('./config');
    expect(config.pageSizes).toEqual([5, 15, 25]);
    expect(config.pageSize).toBe(5);
  });

  it('un tamaño de página válido se respeta', async () => {
    vi.stubEnv('VITE_PAGE_SIZES', '5,15,25');
    vi.stubEnv('VITE_PAGE_SIZE', '15');
    vi.resetModules();
    const { config } = await import('./config');
    expect(config.pageSize).toBe(15);
  });
});
