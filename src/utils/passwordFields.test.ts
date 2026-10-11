import { describe, expect, it } from 'vitest';
import { ApiError, fieldErrorsFrom } from '../services/apiClient';
import { passwordErrorFields, validatePassword } from './validation';

/** El rechazo del servidor sobre una contraseña, como error del campo de un formulario. */
const errorFor = (code: string, field = 'password') =>
  fieldErrorsFrom<{ next: string }>(new ApiError({ statusCode: 422, code, message: 'texto del servidor', errors: [{ code, message: 'texto del servidor', field, details: null }] }), passwordErrorFields<{ next: string }>('next'));

describe('largo mínimo de la contraseña (solo UX: el servidor la vuelve a validar)', () => {
  it('subió a 12 caracteres con la migración 0096 del backend', () => {
    expect(validatePassword('Corta123456')).toBe('Mínimo 12 caracteres');
    expect(validatePassword('Segura123456')).toBeUndefined();
  });
});

describe('códigos del servidor sobre la contraseña, llevados a SU campo', () => {
  it('largo, filtrada, reciclada y obligatoria van al campo de la contraseña', () => {
    expect(errorFor('PASSWORD_TOO_SHORT')).toEqual({ next: 'texto del servidor' });
    expect(errorFor('PASSWORD_BREACHED')).toEqual({ next: 'texto del servidor' });
    expect(errorFor('PASSWORD_REUSED')).toEqual({ next: 'texto del servidor' });
    expect(errorFor('PASSWORD_REQUIRED')).toEqual({ next: 'texto del servidor' });
  });

  it('también cuando el servidor lo manda por el NOMBRE del campo', () => {
    expect(errorFor('UNPROCESSABLE', 'new_password')).toEqual({ next: 'texto del servidor' });
    expect(errorFor('UNPROCESSABLE', 'password')).toEqual({ next: 'texto del servidor' });
  });

  it('un código que no es de la contraseña no marca ese campo', () => {
    expect(errorFor('CURRENT_PASSWORD_INVALID', 'current')).toEqual({ current: 'texto del servidor' });
  });

  it('el mapa es UNA definición: el mismo para cualquier nombre de campo', () => {
    expect(Object.keys(passwordErrorFields<{ clave: string }>('clave'))).toEqual(['PASSWORD_TOO_SHORT', 'PASSWORD_BREACHED', 'PASSWORD_REUSED', 'PASSWORD_REQUIRED', 'new_password', 'password']);
    expect(passwordErrorFields<{ clave: string }>('clave').PASSWORD_BREACHED).toBe('clave');
  });
});
