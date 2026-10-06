import { LocateOff } from 'lucide-react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { locationProblemCopy, LocationError, type LocationProblem } from '../../utils/geolocation';
import { locationProblemMessage, loginLocationMessage } from './locationMessages';

const iconOf = (message: { icon?: unknown }) => (message.icon as ReactElement).type;
const apiError = (code: string, message = 'Respuesta del servidor') => new ApiError({ statusCode: 403, code, message });

describe('locationProblemMessage', () => {
  it.each<[LocationProblem, 'warning' | 'error']>([
    ['insecure', 'warning'],
    ['unsupported', 'error'],
    ['unavailable', 'error'],
    ['timeout', 'error'],
  ])('%s: popup de %s con el título, la explicación y los pasos del problema', (problem, variant) => {
    const message = locationProblemMessage(problem);
    const { title, text } = locationProblemCopy(problem);
    expect(message).toMatchObject({ variant, eyebrow: 'Ubicación', title, text, details: undefined, detailsStyle: 'steps', key: `location-${problem}` });
    expect(iconOf(message)).toBe(LocateOff);
  });

  it('el permiso bloqueado explica cómo permitirlo en cada teléfono', () => {
    expect(locationProblemMessage('denied')).toMatchObject({ variant: 'warning', title: 'Permite el acceso a tu ubicación', text: expect.stringContaining('validador') as string });
    expect(locationProblemMessage('denied').details).toEqual(expect.arrayContaining([expect.stringContaining('iPhone'), expect.stringContaining('Android')]));
    // Por qué se pide y cómo seguir dependen de la pantalla; los pasos para permitirla son los mismos.
    expect(locationProblemMessage('denied').details?.at(-1)).toBe('Vuelve a la aplicación e inicia sesión de nuevo.');
    expect(locationProblemMessage('denied', 'map')).toMatchObject({ text: expect.stringContaining('mapa') as string });
    expect(locationProblemMessage('denied', 'map').details?.at(-1)).toContain('Mi ubicación');
    expect(locationProblemMessage('timeout', 'attendance').details).toBeUndefined();
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
