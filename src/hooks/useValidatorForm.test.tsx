import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { WithCatalogs } from '../test/render';
import { settingsFrom, useValidatorForm, validateRadius, validateValidatorName, type ValidatorFormValues } from './useValidatorForm';

const wrapper = ({ children }: { children: ReactNode }) => (
  <FeedbackProvider>
    <WithCatalogs>{children}</WithCatalogs>
  </FeedbackProvider>
);

const VALUES: ValidatorFormValues = {
  name: '  Recepción planta 1 ',
  email: '',
  password: '',
  confirm: '',
  radius: '150',
  street: 'Juárez',
  exterior_number: 'S/N',
  interior_number: '',
  postal_code: '83000',
  country_code: 'MX',
  state: 'Sonora',
  municipality: 'Hermosillo',
  city: 'Hermosillo',
};

describe('useValidatorForm: reglas del cliente (solo UX; el backend valida igual)', () => {
  it('nombre: mínimo 2 y máximo 120 caracteres', () => {
    expect(validateValidatorName(' A ')).toMatch(/Escribe un nombre/);
    expect(validateValidatorName('x'.repeat(121))).toBe('Máximo 120 caracteres');
    expect(validateValidatorName('Acceso norte')).toBeUndefined();
  });

  it('radio: obligatorio, en metros enteros y dentro de los límites del backend', () => {
    expect(validateRadius(' ')).toBe('Indica el radio en metros');
    expect(validateRadius('12.5')).toBe('Escribe metros enteros');
    expect(validateRadius('cien')).toBe('Escribe metros enteros');
    expect(validateRadius('5')).toBe('Entre 10 y 10,000 m');
    expect(validateRadius('10001')).toBe('Entre 10 y 10,000 m');
    expect(validateRadius('100')).toBeUndefined();
  });

  it('lo que se guarda: domicilio con su punto, interior vacío como null y el radio solo si es válido', () => {
    expect(settingsFrom(VALUES, 'QR_OR_FACE', { lat: 29.07, lng: -110.95 }, true)).toEqual({
      name: 'Recepción planta 1',
      mode: 'QR_OR_FACE',
      address: { street: 'Juárez', exterior_number: 'S/N', interior_number: null, postal_code: '83000', country_code: 'MX', state: 'Sonora', municipality: 'Hermosillo', city: 'Hermosillo', latitude: 29.07, longitude: -110.95 },
      location_required: true,
      location_radius_m: 150,
    });
    const withoutPoint = settingsFrom({ ...VALUES, radius: '3' }, 'QR_OR_FACE', null, false);
    expect(withoutPoint.address).toMatchObject({ latitude: null, longitude: null });
    expect(withoutPoint.location_radius_m).toBeNull();
    expect(settingsFrom({ ...VALUES, radius: '' }, 'QR_OR_FACE', null, false).location_radius_m).toBeNull();
  });

  it('el radio vacío solo es error si se exige la ubicación', () => {
    const { result } = renderHook(() => useValidatorForm(null), { wrapper });
    act(() => result.current.set('radius', ''));
    act(() => result.current.touch('radius'));
    expect(result.current.errors.radius).toBeUndefined();
    act(() => result.current.setLocationRequired(true));
    expect(result.current.errors.radius).toBe('Indica el radio en metros');
  });
});
