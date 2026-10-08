import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { localizeServerText } from '../../i18n/serverTexts';
import { apiOk, jsonResponse, mockFetch } from '../../test/http';
import { describeError } from '../../utils/errorPresentation';
import { apiRequest, ApiError, errorMessage } from '../apiClient';
import { clientError, normalizeResponse } from './envelope';
import { validationSocket } from '../realtime/validationSocket';

/**
 * Idioma en el contrato con el backend (regla 16): cada petición lleva `Accept-Language` con el idioma
 * activo (el backend responde sus mensajes y catálogos ya traducidos) y los textos que arma la propia
 * app (sin respuesta, respuesta inesperada) siguen al idioma aunque el error ya exista.
 */
describe('Accept-Language', () => {
  it('toda petición lleva el idioma activo y lo cambia en cuanto cambia el idioma', async () => {
    const { calls } = mockFetch(apiOk({ ok: true }));
    await apiRequest('/catalogs');
    await setLocale('en-US');
    await apiRequest('/catalogs');
    const languages = calls.map((call) => (call.init.headers as Record<string, string>)['Accept-Language']);
    expect(languages).toEqual(['es-MX', 'en-US']);
    validationSocket.close();
  });
});

describe('textos que arma la app', () => {
  it('sin conexión: el mensaje y el título del popup se traducen al leerse', async () => {
    const error = clientError(0, 'trace-1');
    expect(error.message).toBe('No se pudo conectar con el servidor. Revisa tu conexión.');
    expect(describeError(error).title).toBe('Sin conexión con el servidor');
    await setLocale('en-US');
    expect(error.message).toBe("Couldn't reach the server. Check your connection.");
    expect(describeError(error)).toMatchObject({ title: "Can't reach the server", text: "Couldn't reach the server. Check your connection." });
  });

  it('respuesta inesperada o sin mensaje del servidor: texto de la app que sigue al idioma', async () => {
    const html = new ApiError(normalizeResponse(200, '<html>', { isJson: false }));
    const empty = new ApiError(normalizeResponse(404, { statusCode: 404, code: 'NOT_FOUND', message: '', data: null }));
    const legacy = new ApiError(normalizeResponse(500, { detail: [] }));
    const many = new ApiError(normalizeResponse(422, { detail: [{ loc: ['body', 'a'], msg: 'malo' }, { loc: ['body', 'b'], msg: 'peor' }] }));
    await setLocale('en-US');
    expect(html.message).toBe('Unexpected response from the server. Try again.');
    expect(empty.message).toBe('Not found');
    expect(legacy.message).toBe('An unexpected error occurred. Try again.');
    expect(many.message).toBe('Invalid data');
  });

  it('el mensaje del servidor nunca se traduce en la app (ya llega en el idioma de la petición)', async () => {
    mockFetch(jsonResponse({ success: false, statusCode: 409, code: 'EMAIL_TAKEN', message: 'Ese correo ya está registrado', data: null, errors: [] }, 409));
    const error = await apiRequest('/employees', { method: 'POST', body: {} }).catch((e: unknown) => e);
    await setLocale('en-US');
    expect((error as ApiError).message).toBe('Ese correo ya está registrado');
    const legacy = new ApiError(normalizeResponse(400, { detail: 'Texto del servidor' }));
    expect(legacy.message).toBe('Texto del servidor');
  });

  it('error sin mensaje: texto de respaldo en el idioma activo', async () => {
    expect(errorMessage(undefined)).toBe('Ocurrió un error inesperado');
    expect(describeError(undefined)).toMatchObject({ title: 'Ocurrió un problema', text: 'Ocurrió un error inesperado. Intenta de nuevo.' });
    await setLocale('en-US');
    expect(errorMessage(undefined)).toBe('An unexpected error occurred');
    expect(describeError(new ApiError({ statusCode: 418, code: 'TEAPOT', message: '' }))).toMatchObject({ title: "Couldn't complete the action", text: 'An unexpected error occurred. Try again.' });
    expect(describeError(new ApiError({ statusCode: 500, code: 'X', message: 'm' })).title).toBe('Server error');
  });
});

describe('textos del servidor en cada idioma (`i18n` del sobre)', () => {
  const i18n = {
    'es-MX': { message: 'Revisa los datos', errors: ['Ese correo ya está registrado'], texts: [] },
    'en-US': { message: 'Check the data', errors: ['That email is already registered'], texts: [] },
  };

  it('un error abierto cambia de idioma al instante: su mensaje, el de cada campo y su copia (sin repetir la petición)', async () => {
    mockFetch(
      jsonResponse(
        { success: false, statusCode: 422, code: 'VALIDATION_ERROR', message: 'Revisa los datos', data: null, errors: [{ code: 'TAKEN', message: 'Ese correo ya está registrado', field: 'email', details: null }], i18n },
        422,
      ),
    );
    const error = (await apiRequest('/employees', { method: 'POST', body: {} }).catch((e: unknown) => e)) as ApiError;
    const copy = error.fieldErrors.email; // lo que guarda un formulario
    expect(error.message).toBe('Revisa los datos');
    await setLocale('en-US');
    expect(error.message).toBe('Check the data');
    expect(error.errors[0].message).toBe('That email is already registered');
    expect(error.fieldErrors).toEqual({ email: 'That email is already registered' });
    expect(describeError(error).text).toBe('Check the data');
    expect(localizeServerText(copy)).toBe('That email is already registered');
  });

  it('sin `i18n` (una lectura exitosa o un servidor anterior) el texto queda como llegó; uno con otra forma se ignora', () => {
    const plain = normalizeResponse(200, { success: true, statusCode: 200, code: 'OK', message: 'Listo', data: 1, errors: [], i18n: null });
    expect(plain.i18n).toBeNull();
    const odd = normalizeResponse(409, { success: false, statusCode: 409, code: 'C', message: 'Choque', data: null, errors: [], i18n: { 'es-MX': 'Choque' } });
    expect(new ApiError(odd).message).toBe('Choque');
    const appText = normalizeResponse(404, { statusCode: 404, code: 'NOT_FOUND', message: '', data: null, i18n });
    expect(appText.i18n).toBeNull(); // sin mensaje del servidor el texto es de la app
  });
});
