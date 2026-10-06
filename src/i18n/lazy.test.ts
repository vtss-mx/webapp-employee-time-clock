import { describe, expect, it } from 'vitest';
import { setLocale, t } from './core';
import { localizedError, resolveLazy } from './lazy';

/** Textos que se calculan al dibujarse y errores de la app que siguen al idioma activo. */
describe('resolveLazy', () => {
  it('devuelve el valor fijo o el de la función en el idioma activo', async () => {
    expect(resolveLazy('fijo')).toBe('fijo');
    const lazy = () => t('common.actions.save');
    expect(resolveLazy(lazy)).toBe('Guardar');
    await setLocale('en-US');
    expect(resolveLazy(lazy)).toBe('Save');
  });
});

describe('localizedError', () => {
  it('traduce su mensaje cada vez que se lee y conserva nombre y causa', async () => {
    const cause = new Error('raíz');
    const error = localizedError(() => t('errors.unexpected'), { cause, name: 'CameraError' });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CameraError');
    expect(error.cause).toBe(cause);
    expect(error.message).toBe('Ocurrió un error inesperado');
    await setLocale('en-US');
    expect(error.message).toBe('An unexpected error occurred');
    expect(localizedError(() => 'x').name).toBe('Error');
  });
});
