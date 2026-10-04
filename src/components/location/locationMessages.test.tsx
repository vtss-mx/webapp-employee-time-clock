import { LocateOff, MapPinOff, SearchX } from 'lucide-react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { MapsApiError } from '../../services/maps/googleMaps';
import { LOCATION_MESSAGES, LocationError, type LocationProblem } from '../../utils/geolocation';
import { locationProblemMessage, loginLocationMessage, mapsProblemMessage } from './locationMessages';

const iconOf = (message: { icon?: unknown }) => (message.icon as ReactElement).type;
const apiError = (code: string, message = 'Respuesta del servidor') => new ApiError({ statusCode: 403, code, message });

describe('locationProblemMessage', () => {
  it.each<[LocationProblem, 'warning' | 'error']>([
    ['denied', 'warning'],
    ['insecure', 'warning'],
    ['unsupported', 'error'],
    ['unavailable', 'error'],
    ['timeout', 'error'],
  ])('%s: popup de %s con el título, la explicación y los pasos del problema', (problem, variant) => {
    const message = locationProblemMessage(problem);
    const { title, text, steps } = LOCATION_MESSAGES[problem];
    expect(message).toMatchObject({ variant, eyebrow: 'Ubicación', title, text, details: steps, detailsStyle: 'steps', key: `location-${problem}` });
    expect(iconOf(message)).toBe(LocateOff);
  });

  it('el permiso bloqueado explica cómo permitirlo en cada teléfono', () => {
    expect(locationProblemMessage('denied').details).toEqual(expect.arrayContaining([expect.stringContaining('iPhone'), expect.stringContaining('Android')]));
  });
});

describe('loginLocationMessage', () => {
  it('un problema del dispositivo se explica como en "Mi ubicación"', () => {
    expect(loginLocationMessage(new LocationError('denied'))).toEqual(locationProblemMessage('denied'));
  });

  it('fuera del radio: advertencia con el mensaje del servidor y los pasos para entrar', () => {
    const message = loginLocationMessage(apiError('LOCATION_OUT_OF_RANGE', 'Estás a 850 m del acceso.'));
    expect(message).toMatchObject({ variant: 'warning', eyebrow: 'Ubicación', title: 'Estás fuera del lugar permitido', text: 'Estás a 850 m del acceso.', key: 'login-LOCATION_OUT_OF_RANGE' });
    expect(message?.details).toHaveLength(3);
  });

  it.each([
    ['LOCATION_INACCURATE', 'Tu ubicación no es precisa'],
    ['LOCATION_REQUIRED', 'Se necesita tu ubicación'],
  ])('%s: advertencia con su título, sin pasos', (code, title) => {
    const message = loginLocationMessage(apiError(code));
    expect(message).toMatchObject({ variant: 'warning', title, text: 'Respuesta del servidor', key: `login-${code}` });
    expect(message?.details).toBeUndefined();
  });

  it('otros errores no son de ubicación (los presenta quien llama)', () => {
    expect(loginLocationMessage(apiError('INVALID_CREDENTIALS'))).toBeNull();
    expect(loginLocationMessage(new Error('sin red'))).toBeNull();
  });
});

describe('mapsProblemMessage', () => {
  it('sin respuesta de Google: error para reintentar mientras se escribe a mano', () => {
    const message = mapsProblemMessage(new MapsApiError('geocoding', 'failed'));
    expect(message).toMatchObject({ variant: 'error', eyebrow: 'Google Maps', title: 'No se pudo consultar Google Maps', key: 'maps-geocoding-failed' });
    expect(iconOf(message)).toBe(MapPinOff);
  });

  it.each([
    ['maps', 'El mapa no está disponible', 'Maps JavaScript API'],
    ['places', 'La búsqueda de lugares no está disponible', 'Places API (New)'],
    ['geocoding', 'El autollenado del domicilio no está disponible', 'Geocoding API'],
    ['geolocation', 'No se pudo estimar tu ubicación', 'Geolocation API'],
  ] as const)('%s sin habilitar: advertencia que dice qué API falta', (api, title, apiName) => {
    const message = mapsProblemMessage(new MapsApiError(api, 'denied'));
    expect(message).toMatchObject({ variant: 'warning', eyebrow: 'Google Maps', title, key: `maps-${api}-denied` });
    expect(message.footnote).toContain(`«${apiName}»`);
    expect(iconOf(message)).toBe(api === 'places' ? SearchX : MapPinOff);
  });
});
