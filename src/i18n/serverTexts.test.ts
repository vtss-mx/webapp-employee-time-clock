import { describe, expect, it } from 'vitest';
import { setLocale } from './core';
import { forgetServerTexts, localizeServerText, parseEnvelopeI18n, rememberServerTexts, textsOf, type EnvelopeI18n } from './serverTexts';

/**
 * Textos del servidor en el idioma VIGENTE (regla 16: «todo en caliente, también lo que envía el servidor»): las
 * versiones de cada texto de una respuesta (`i18n` del sobre) se recuerdan para dibujar en el idioma activo lo que
 * ya se copió a otra parte (un popup abierto, el error de un campo, el resultado de checar).
 */
const both: EnvelopeI18n = {
  'es-MX': { message: 'Empleado restaurado', errors: ['Ese correo ya existe'], texts: ['Entrada registrada a las 09:05'] },
  'en-US': { message: 'Employee restored', errors: ['That email already exists'], texts: ['Checked in at 9:05 AM'] },
};

const numbered = (n: number): EnvelopeI18n => ({ 'es-MX': { message: `Texto ${n}`, errors: [], texts: [] }, 'en-US': { message: `Text ${n}`, errors: [], texts: [] } });

describe('i18n del sobre', () => {
  it('lee los idiomas que habla la app con su forma; lo demás se ignora', () => {
    expect(parseEnvelopeI18n(both)).toEqual(both);
    expect(parseEnvelopeI18n({ 'en-US': { message: 'Done', errors: [] } })).toEqual({ 'en-US': { message: 'Done', errors: [], texts: [] } }); // sin `texts`: lista vacía
    expect(parseEnvelopeI18n({ fr: { message: 'Fait', errors: [], texts: [] }, 'es-MX': { message: 1, errors: [] } })).toBeNull();
    expect(parseEnvelopeI18n({ 'es-MX': { message: 'Listo', errors: [2] } })).toBeNull();
    expect(parseEnvelopeI18n({ 'es-MX': 'Listo' })).toBeNull();
    expect(parseEnvelopeI18n(['es-MX'])).toBeNull();
    expect(parseEnvelopeI18n(null)).toBeNull(); // una lectura exitosa no lo lleva
  });

  it('cada texto se busca por cualquiera de sus versiones (mensaje, errores y textos de los datos)', () => {
    const texts = textsOf(both);
    expect(texts.get('Employee restored')).toEqual({ 'es-MX': 'Empleado restaurado', 'en-US': 'Employee restored' });
    expect(texts.get('Ese correo ya existe')?.['en-US']).toBe('That email already exists');
    expect(texts.get('Checked in at 9:05 AM')?.['es-MX']).toBe('Entrada registrada a las 09:05');
    expect(textsOf(null).size).toBe(0);
    // Un idioma con menos errores: el que falta no se inventa.
    const partial = textsOf({ 'es-MX': { message: 'Hola', errors: ['Uno', 'Dos'], texts: [] }, 'en-US': { message: 'Hi', errors: ['One'], texts: [] } });
    expect(partial.get('Dos')).toEqual({ 'es-MX': 'Dos' });
    expect(textsOf({ 'es-MX': { message: '', errors: [], texts: [] } }).size).toBe(0); // un texto vacío no se busca
  });
});

describe('textos del servidor en el idioma activo', () => {
  it('una copia del texto se dibuja en el idioma vigente; uno que no es del servidor, tal cual', async () => {
    rememberServerTexts(textsOf(both));
    expect(localizeServerText('Empleado restaurado')).toBe('Empleado restaurado');
    await setLocale('en-US');
    expect(localizeServerText('Empleado restaurado')).toBe('Employee restored');
    expect(localizeServerText('Entrada registrada a las 09:05')).toBe('Checked in at 9:05 AM');
    expect(localizeServerText('Guardar')).toBe('Guardar');
    // Las versiones propias de una respuesta mandan aunque la memoria ya no las tenga.
    forgetServerTexts();
    expect(localizeServerText('Empleado restaurado')).toBe('Empleado restaurado');
    expect(localizeServerText('Empleado restaurado', textsOf(both))).toBe('Employee restored');
  });

  it('la memoria se queda con los 500 textos más recientes', async () => {
    for (let n = 0; n <= 300; n++) rememberServerTexts(textsOf(numbered(n)));
    rememberServerTexts(textsOf(numbered(0))); // volver a recibirlo lo hace reciente
    for (let n = 301; n <= 520; n++) rememberServerTexts(textsOf(numbered(n)));
    await setLocale('en-US');
    expect(localizeServerText('Texto 1')).toBe('Texto 1'); // salió al pasar el tope
    expect(localizeServerText('Texto 0')).toBe('Text 0'); // reciente: sigue
    expect(localizeServerText('Texto 520')).toBe('Text 520');
  });
});
