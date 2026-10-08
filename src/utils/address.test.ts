import { afterEach, describe, expect, it } from 'vitest';
import { loginLocationMessage } from '../components/location/locationMessages';
import { setLocale } from '../i18n/core';
import { ApiError } from '../services/apiClient';
import {
  ADDRESS_FIELDS,
  addressForPoint,
  addressFromParts,
  addressFromResults,
  addressLine,
  addressPayload,
  cleanNotes,
  distanceMeters,
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

/** Lo que Google devuelve para Plaza Zaragoza, Hermosillo (en México la colonia es `sublocality_level_1`). */
const HERMOSILLO = [
  part(['street_number'], '71'),
  part(['route'], 'Calle Dr. Paliza'),
  part(['sublocality_level_1', 'sublocality', 'political'], 'Centro'),
  part(['locality', 'political'], 'Hermosillo'),
  part(['administrative_area_level_2'], 'Hermosillo'),
  part(['administrative_area_level_1'], 'Sonora', 'Son.'),
  part(['country'], 'México', 'mx'),
  part(['postal_code'], '83000'),
];

describe('domicilio desde Google', () => {
  it('cada campo sale de su componente (país en ISO, estado con su nombre completo, la colonia)', () => {
    expect(addressFromParts(HERMOSILLO)).toEqual({
      street: 'Calle Dr. Paliza',
      exterior_number: '71',
      postal_code: '83000',
      country_code: 'MX',
      state: 'Sonora',
      municipality: 'Hermosillo',
      city: 'Hermosillo',
      neighborhood: 'Centro',
    });
    // CDMX: la alcaldía es el municipio; sin "locality" la ciudad sale del siguiente nivel.
    expect(addressFromParts([part(['administrative_area_level_2'], 'Cuauhtémoc'), part(['administrative_area_level_1'], 'Ciudad de México')])).toEqual({
      municipality: 'Cuauhtémoc',
      state: 'Ciudad de México',
      city: 'Cuauhtémoc',
    });
    expect(addressFromParts([])).toEqual({});
  });

  it('México: la colonia (sublocality) llena su campo y el nombre del edificio (premise) nunca es la calle ni el número', () => {
    const colonia = [part(['premise'], 'Torre Hermosillo'), part(['sublocality_level_1', 'sublocality', 'political'], 'Centro'), part(['administrative_area_level_2', 'political'], 'Hermosillo')];
    expect(addressFromParts(colonia)).toEqual({ municipality: 'Hermosillo', city: 'Hermosillo', neighborhood: 'Centro' });
    // La colonia: primero sublocality_level_1, luego sublocality y al final neighborhood (otros países).
    const both = [part(['neighborhood', 'political'], 'Barrio'), part(['sublocality', 'political'], 'Zona'), part(['sublocality_level_1', 'sublocality'], 'Pitic')];
    expect(addressFromParts(both).neighborhood).toBe('Pitic');
    expect(addressFromParts([part(['neighborhood', 'political'], 'Barrio'), part(['sublocality', 'political'], 'Zona')]).neighborhood).toBe('Zona');
    expect(addressFromParts([part(['neighborhood', 'political'], 'Mission District')]).neighborhood).toBe('Mission District');
    // Solo la ciudad (sin municipio): el municipio es la misma; con número interior (subpremise) también se usa.
    expect(addressFromParts([part(['locality', 'political'], 'Zapopan'), part(['subpremise'], '4B')])).toEqual({ interior_number: '4B', municipality: 'Zapopan', city: 'Zapopan' });
    // Otros países: el nivel 3 (comuna, municipio) cubre al municipio y a la ciudad.
    expect(addressFromParts([part(['administrative_area_level_3'], 'Bolonia')])).toEqual({ municipality: 'Bolonia', city: 'Bolonia' });
    // Reino Unido: la ciudad postal.
    expect(addressFromParts([part(['postal_town'], 'London'), part(['administrative_area_level_2'], 'Greater London')])).toEqual({ municipality: 'Greater London', city: 'London' });
  });

  it('varios resultados del mismo punto: manda el más preciso y los demás completan solo lo de la zona', () => {
    const exact = [part(['street_number'], '71'), part(['route'], 'Calle Dr. Paliza'), part(['locality'], 'Hermosillo')];
    const postalCode = [part(['postal_code'], '83000'), part(['country'], 'México', 'MX'), part(['locality'], 'Otra ciudad'), part(['sublocality_level_1'], 'Centro')];
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
      neighborhood: 'Centro', // la colonia también es de la zona: sale de otro resultado
    });
    // El número exterior y el interior nunca salen de otro resultado (serían los de otra casa).
    expect(addressFromResults([[part(['locality'], 'Hermosillo')], otherHouse])).toEqual({ street: 'Otra calle', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo' });
    // Un primer resultado sin datos (p. ej. un plus code) no impide armar el domicilio con los demás.
    expect(addressFromResults([[part(['plus_code'], '3394+5R')], exact])).toEqual({ street: 'Calle Dr. Paliza', municipality: 'Hermosillo', city: 'Hermosillo' });
    expect(addressFromResults([])).toEqual({});
  });

  it('sabe si al domicilio le falta algo de la zona (calle, colonia, código postal, estado, municipio, ciudad o país)', () => {
    const complete = addressFromParts(HERMOSILLO);
    expect(missingAreaFields(complete)).toBe(false);
    expect(missingAreaFields({ ...complete, exterior_number: undefined })).toBe(false); // el número no es de la zona
    expect(missingAreaFields({ ...complete, postal_code: undefined })).toBe(true);
    expect(missingAreaFields({ ...complete, neighborhood: undefined })).toBe(true);
    expect(missingAreaFields({ ...complete, country_code: '' })).toBe(true);
    expect(missingAreaFields({})).toBe(true);
  });

  it('el punto nuevo reemplaza el domicilio; conserva el interior y el país si Google no los trae, y siempre las referencias', () => {
    const current = { ...EMPTY_ADDRESS, street: 'Otra', exterior_number: '9', interior_number: 'B', country_code: 'US', city: 'Austin', neighborhood: 'Downtown', reference_notes: 'Puerta azul' };
    expect(addressForPoint(current, { street: 'Reforma', state: 'CDMX' })).toEqual({
      ...EMPTY_ADDRESS,
      street: 'Reforma',
      interior_number: 'B',
      country_code: 'US',
      state: 'CDMX',
      reference_notes: 'Puerta azul', // las escribe la persona: nunca las cambia Google
    });
    expect(addressForPoint(current, { neighborhood: 'Centro', interior_number: '4', reference_notes: 'de Google' })).toMatchObject({ neighborhood: 'Centro', interior_number: '4', reference_notes: 'Puerta azul' });
  });
});

describe('caminos sin nombre', () => {
  it('"Vía Sin Nombre" y similares no llenan la calle; lo demás del punto sí', () => {
    for (const unnamed of ['Vía Sin Nombre', 'via sin nombre', 'Calle sin nombre', 'Camino Sin Nombre', 'Sin nombre', 'Unnamed Road']) {
      expect(addressFromParts([part(['route'], unnamed), part(['postal_code'], '34610')]), unnamed).toEqual({ postal_code: '34610' });
    }
    expect(addressFromParts([part(['route'], 'Calle Sin Nombre de la Colonia')]).street).toBe('Calle Sin Nombre de la Colonia');
  });
});

describe('validación y formato del domicilio', () => {
  it('los campos van en el orden en que se capturan (el mismo del backend)', () => {
    expect(ADDRESS_FIELDS).toEqual(['country_code', 'state', 'municipality', 'city', 'neighborhood', 'postal_code', 'street', 'exterior_number', 'interior_number', 'reference_notes']);
  });

  it('obligatorios (también la colonia), longitudes y código postal según el país', () => {
    expect(validateAddress(EMPTY_ADDRESS)).toEqual({
      state: 'Escribe el estado o provincia',
      municipality: 'Escribe el municipio o alcaldía',
      city: 'Escribe la ciudad o localidad',
      neighborhood: 'Escribe la colonia o barrio',
      postal_code: 'Escribe el código postal',
      street: 'Escribe la calle',
      exterior_number: 'Escribe el número exterior (o S/N)',
    });
    expect(Object.keys(validateAddress(EMPTY_ADDRESS))[0]).toBe('state'); // en el orden del formulario
    const ok = pickAddress({ ...addressFromParts(HERMOSILLO), interior_number: null });
    expect(validateAddress(ok)).toEqual({});
    expect(validateAddress({ ...ok, street: 'x'.repeat(151), country_code: '' })).toEqual({ street: 'Máximo 150 caracteres', country_code: 'Elige el país' });
    // Como el backend: 2 letras como mínimo en los textos obligatorios; el número exterior puede ser "7".
    expect(validateAddress({ ...ok, neighborhood: ' C ', city: 'H', exterior_number: '7' })).toEqual({ neighborhood: 'Escribe al menos 2 caracteres', city: 'Escribe al menos 2 caracteres' });
    expect(validateAddress({ ...ok, neighborhood: 'x'.repeat(121) })).toEqual({ neighborhood: 'Máximo 120 caracteres' });
    // Las referencias son opcionales y se miden como se guardan (sin espacios ni renglones de sobra).
    expect(validateAddress({ ...ok, reference_notes: `${'x'.repeat(300)}\n\n   ` })).toEqual({});
    expect(validateAddress({ ...ok, reference_notes: 'x'.repeat(301) })).toEqual({ reference_notes: 'Máximo 300 caracteres' });
    expect(validatePostalCode('8300', 'MX')).toBe('El código postal de México tiene 5 dígitos');
    expect(validatePostalCode('sw1a 1aa', 'GB')).toBeUndefined();
    expect(validatePostalCode('#', 'US')).toBe('El código postal no es válido');
    expect(normalizePostalCode(' sw1a   1aa')).toBe('SW1A 1AA');
  });

  it('una línea para listados (con la colonia, sin las referencias) y el punto con 5 decimales', () => {
    const address = { ...addressFromParts(HERMOSILLO), interior_number: '2', reference_notes: 'Frente a la plaza' };
    expect(addressLine(address)).toBe('Calle Dr. Paliza 71 Interior 2, Centro, 83000 Hermosillo, Sonora');
    expect(addressLine({ ...address, neighborhood: null })).toBe('Calle Dr. Paliza 71 Interior 2, 83000 Hermosillo, Sonora'); // guardado antes de pedir la colonia
    expect(addressLine({ city: 'Mérida', state: 'Mérida', country_code: 'MX' }, { withCountry: true })).toBe('Mérida, MX');
    expect(addressLine(null)).toBe('');
    expect(formatPoint({ lat: 29.0729, lng: -110.9559 })).toBe('29.07290, -110.95590');
    expect(pickAddress(null)).toEqual(EMPTY_ADDRESS);
    expect(pickAddress({ street: '  Juárez ' }, { trim: true }).street).toBe('Juárez');
  });

  it('las referencias se limpian como las guarda el backend: cada indicación en su renglón', () => {
    expect(cleanNotes('  Entre   Juárez y Morelos \r\n\n  Frente a la plaza  \n ')).toBe('Entre Juárez y Morelos\nFrente a la plaza');
    expect(cleanNotes(' \n ')).toBe('');
    expect(pickAddress({ reference_notes: ' Puerta  2 \n\n Timbre ' }, { trim: true }).reference_notes).toBe('Puerta 2\nTimbre');
    expect(pickAddress({ reference_notes: ' Puerta  2 ' }).reference_notes).toBe(' Puerta  2 '); // sin `trim`, tal como se escribe
  });

  it('lo que se envía: sin espacios de sobra, los opcionales vacíos como null y el punto', () => {
    const values = { ...pickAddress(addressFromParts(HERMOSILLO)), street: ' Calle Dr. Paliza ', reference_notes: ' \n ' };
    expect(addressPayload(values, { lat: 29.07, lng: -110.95 })).toEqual({
      ...addressFromParts(HERMOSILLO),
      interior_number: null,
      reference_notes: null,
      latitude: 29.07,
      longitude: -110.95,
    });
    expect(addressPayload({ ...values, interior_number: '4', reference_notes: 'Puerta 2' }, null)).toMatchObject({ interior_number: '4', reference_notes: 'Puerta 2', latitude: null, longitude: null });
  });

  it('distancia en línea recta (la misma fórmula del backend)', () => {
    const plaza = { lat: 29.0729, lng: -110.9559 };
    expect(distanceMeters(plaza, plaza)).toBe(0);
    expect(distanceMeters(plaza, { lat: 29.0734, lng: -110.9559 })).toBeGreaterThan(50);
    expect(distanceMeters(plaza, { lat: 29.0734, lng: -110.9559 })).toBeLessThan(60);
    expect(Math.round(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 }) / 1000)).toBe(20_015); // media vuelta al mundo
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

describe('domicilio en inglés (en-US)', () => {
  it('las validaciones y la palabra del número interior siguen al idioma; los datos van tal cual', async () => {
    await setLocale('en-US');
    expect(validateAddress({ ...EMPTY_ADDRESS, city: 'H', street: 'x'.repeat(151) })).toMatchObject({
      state: 'Enter the state or province',
      city: 'Enter at least 2 characters',
      street: 'Maximum 150 characters',
      exterior_number: 'Enter the street number (or N/A)',
      postal_code: 'Enter the postal code',
    });
    expect(validatePostalCode('8300', 'MX')).toBe('A Mexican postal code has 5 digits');
    expect(validatePostalCode('#', 'US')).toBe('The postal code is not valid');
    expect(addressLine({ street: 'Calle Dr. Paliza', exterior_number: '71', interior_number: '2', neighborhood: 'Centro', postal_code: '83000', city: 'Hermosillo', state: 'Sonora' })).toBe(
      'Calle Dr. Paliza 71 Unit 2, Centro, 83000 Hermosillo, Sonora',
    );
    expect(new LocationError('denied').message).toBe('Location permission is blocked in this browser.');
    expect(loginLocationMessage(new ApiError({ statusCode: 403, code: 'LOCATION_OUT_OF_RANGE', message: 'x' }))?.details).toEqual([
      'Move closer to the access point where this validator operates.',
      'Turn on precise location (GPS) on the device.',
      'Sign in again.',
    ]);
  });
});
