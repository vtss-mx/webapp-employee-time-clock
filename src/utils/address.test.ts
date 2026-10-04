import { afterEach, describe, expect, it } from 'vitest';
import { loginLocationMessage } from '../components/location/locationMessages';
import { ApiError } from '../services/apiClient';
import {
  addressForPoint,
  addressFromParts,
  addressFromResults,
  addressLine,
  EMPTY_ADDRESS,
  formatPoint,
  missingAreaFields,
  normalizePostalCode,
  pickAddress,
  validateAddress,
  validatePostalCode,
  type AddressPart,
} from './address';
import { currentLocation, LocationError } from './geolocation';

const part = (types: string[], longText: string, shortText = longText): AddressPart => ({ types, longText, shortText });

/** Lo que Google devuelve para Plaza Zaragoza, Hermosillo. */
const HERMOSILLO = [
  part(['street_number'], '71'),
  part(['route'], 'Calle Dr. Paliza'),
  part(['sublocality', 'neighborhood'], 'Centro'),
  part(['locality', 'political'], 'Hermosillo'),
  part(['administrative_area_level_2'], 'Hermosillo'),
  part(['administrative_area_level_1'], 'Sonora', 'Son.'),
  part(['country'], 'México', 'mx'),
  part(['postal_code'], '83000'),
];

describe('domicilio desde Google', () => {
  it('cada campo sale de su componente (país en ISO, estado con su nombre completo)', () => {
    expect(addressFromParts(HERMOSILLO)).toEqual({
      street: 'Calle Dr. Paliza',
      exterior_number: '71',
      postal_code: '83000',
      country_code: 'MX',
      state: 'Sonora',
      municipality: 'Hermosillo',
      city: 'Hermosillo',
    });
    // CDMX: la alcaldía es el municipio; sin "locality" la ciudad sale del siguiente nivel.
    expect(addressFromParts([part(['administrative_area_level_2'], 'Cuauhtémoc'), part(['administrative_area_level_1'], 'Ciudad de México')])).toEqual({
      municipality: 'Cuauhtémoc',
      state: 'Ciudad de México',
      city: 'Cuauhtémoc',
    });
    expect(addressFromParts([])).toEqual({});
  });

  it('México: la colonia (sublocality) y el nombre del edificio (premise) nunca son la ciudad, la calle ni el número', () => {
    const colonia = [part(['premise'], 'Torre Hermosillo'), part(['sublocality_level_1', 'sublocality', 'political'], 'Centro'), part(['administrative_area_level_2', 'political'], 'Hermosillo')];
    expect(addressFromParts(colonia)).toEqual({ municipality: 'Hermosillo', city: 'Hermosillo' });
    // Solo la ciudad (sin municipio): el municipio es la misma; con número interior (subpremise) también se usa.
    expect(addressFromParts([part(['locality', 'political'], 'Zapopan'), part(['subpremise'], '4B')])).toEqual({ interior_number: '4B', municipality: 'Zapopan', city: 'Zapopan' });
    // Otros países: el nivel 3 (comuna, municipio) cubre al municipio y a la ciudad.
    expect(addressFromParts([part(['administrative_area_level_3'], 'Bolonia')])).toEqual({ municipality: 'Bolonia', city: 'Bolonia' });
    // Reino Unido: la ciudad postal.
    expect(addressFromParts([part(['postal_town'], 'London'), part(['administrative_area_level_2'], 'Greater London')])).toEqual({ municipality: 'Greater London', city: 'London' });
  });

  it('varios resultados del mismo punto: manda el más preciso y los demás completan solo lo de la zona', () => {
    const exact = [part(['street_number'], '71'), part(['route'], 'Calle Dr. Paliza'), part(['locality'], 'Hermosillo')];
    const postalCode = [part(['postal_code'], '83000'), part(['country'], 'México', 'MX'), part(['locality'], 'Otra ciudad')];
    const otherHouse = [part(['street_number'], '99'), part(['route'], 'Otra calle'), part(['subpremise'], '3'), part(['administrative_area_level_1'], 'Sonora')];
    const municipality = [part(['administrative_area_level_2'], 'Hermosillo')];
    expect(addressFromResults([exact, postalCode, otherHouse, municipality])).toEqual({
      street: 'Calle Dr. Paliza', // del más preciso, aunque otro traiga otra calle
      exterior_number: '71',
      postal_code: '83000',
      country_code: 'MX',
      state: 'Sonora',
      municipality: 'Hermosillo', // del más preciso (su ciudad), no del resultado del municipio
      city: 'Hermosillo', // la del más preciso, no la del código postal
    });
    // El número exterior y el interior nunca salen de otro resultado (serían los de otra casa).
    expect(addressFromResults([[part(['locality'], 'Hermosillo')], otherHouse])).toEqual({ street: 'Otra calle', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo' });
    // Un primer resultado sin datos (p. ej. un plus code) no impide armar el domicilio con los demás.
    expect(addressFromResults([[part(['plus_code'], '3394+5R')], exact])).toEqual({ street: 'Calle Dr. Paliza', municipality: 'Hermosillo', city: 'Hermosillo' });
    expect(addressFromResults([])).toEqual({});
  });

  it('sabe si al domicilio le falta algo de la zona (calle, código postal, estado, municipio, ciudad o país)', () => {
    const complete = addressFromParts(HERMOSILLO);
    expect(missingAreaFields(complete)).toBe(false);
    expect(missingAreaFields({ ...complete, exterior_number: undefined })).toBe(false); // el número no es de la zona
    expect(missingAreaFields({ ...complete, postal_code: undefined })).toBe(true);
    expect(missingAreaFields({ ...complete, country_code: '' })).toBe(true);
    expect(missingAreaFields({})).toBe(true);
  });

  it('el punto nuevo reemplaza el domicilio; conserva el interior y el país si Google no los trae', () => {
    const current = { ...EMPTY_ADDRESS, street: 'Otra', exterior_number: '9', interior_number: 'B', country_code: 'US', city: 'Austin' };
    expect(addressForPoint(current, { street: 'Reforma', state: 'CDMX' })).toEqual({
      ...EMPTY_ADDRESS,
      street: 'Reforma',
      interior_number: 'B',
      country_code: 'US',
      state: 'CDMX',
    });
  });
});

describe('validación y formato del domicilio', () => {
  it('obligatorios, longitudes y código postal según el país', () => {
    expect(validateAddress(EMPTY_ADDRESS)).toEqual({
      street: 'Escribe la calle',
      exterior_number: 'Escribe el número exterior (o S/N)',
      postal_code: 'Escribe el código postal',
      state: 'Escribe el estado',
      municipality: 'Escribe el municipio o alcaldía',
      city: 'Escribe la ciudad',
    });
    const ok = pickAddress({ ...addressFromParts(HERMOSILLO), interior_number: null });
    expect(validateAddress(ok)).toEqual({});
    expect(validateAddress({ ...ok, street: 'x'.repeat(151), country_code: '' })).toEqual({ street: 'Máximo 150 caracteres', country_code: 'Elige el país' });
    expect(validatePostalCode('8300', 'MX')).toBe('El código postal de México tiene 5 dígitos');
    expect(validatePostalCode('sw1a 1aa', 'GB')).toBeUndefined();
    expect(validatePostalCode('#', 'US')).toBe('El código postal no es válido');
    expect(normalizePostalCode(' sw1a   1aa')).toBe('SW1A 1AA');
  });

  it('una línea para listados y el punto con 5 decimales', () => {
    const address = { ...addressFromParts(HERMOSILLO), interior_number: '2' };
    expect(addressLine(address)).toBe('Calle Dr. Paliza 71 Int. 2, 83000 Hermosillo, Sonora');
    expect(addressLine({ city: 'Mérida', state: 'Mérida', country_code: 'MX' }, { withCountry: true })).toBe('Mérida, MX');
    expect(addressLine(null)).toBe('');
    expect(formatPoint({ lat: 29.0729, lng: -110.9559 })).toBe('29.07290, -110.95590');
    expect(pickAddress(null)).toEqual(EMPTY_ADDRESS);
    expect(pickAddress({ street: '  Juárez ' }, { trim: true }).street).toBe('Juárez');
  });
});

describe('ubicación del dispositivo', () => {
  afterEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });
  const stub = (geolocation: unknown) => Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });

  it('lectura precisa y sin caché; los errores del navegador tienen su motivo', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    let options: PositionOptions | undefined;
    stub({
      getCurrentPosition: (ok: PositionCallback, _fail: PositionErrorCallback, opts: PositionOptions) => {
        options = opts;
        ok({ coords: { latitude: 1, longitude: 2, accuracy: 8 } } as GeolocationPosition);
      },
    });
    await expect(currentLocation()).resolves.toEqual({ latitude: 1, longitude: 2, accuracy: 8 });
    expect(options).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });

    for (const [code, problem] of [[1, 'denied'], [2, 'unavailable'], [3, 'timeout'], [9, 'unavailable']] as const) {
      stub({ getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) => fail({ code } as GeolocationPositionError) });
      await expect(currentLocation()).rejects.toMatchObject({ problem });
    }
  });

  it('sin conexión segura o sin soporte no se pide', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    await expect(currentLocation()).rejects.toMatchObject({ problem: 'insecure' });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    const saved = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    Reflect.deleteProperty(navigator, 'geolocation'); // navegador sin geolocalización
    if ('geolocation' in navigator) stub(undefined);
    await expect(currentLocation()).rejects.toBeInstanceOf(LocationError);
    if (saved) Object.defineProperty(navigator, 'geolocation', saved);
  });
});

describe('mensajes de ubicación', () => {
  it('inicio de sesión: errores de ubicación con su aviso; los demás, no', () => {
    expect(loginLocationMessage(new LocationError('denied'))?.title).toBe('Permite el acceso a tu ubicación');
    const inaccurate = new ApiError({ statusCode: 403, code: 'LOCATION_INACCURATE', message: 'No es precisa (±900 m).' });
    expect(loginLocationMessage(inaccurate)).toMatchObject({ title: 'Tu ubicación no es precisa', text: 'No es precisa (±900 m).', details: undefined });
    expect(loginLocationMessage(new ApiError({ statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'x' }))).toBeNull();
    expect(loginLocationMessage(new Error('x'))).toBeNull();
  });
});
