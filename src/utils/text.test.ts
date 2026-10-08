import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { inSentence } from './text';

/** Un nombre de catálogo a mitad de frase: minúsculas en el idioma activo, salvo en alemán (sustantivos con mayúscula). */
describe('inSentence', () => {
  it('baja a minúsculas con las reglas del idioma activo', async () => {
    expect(inSentence('Entrada')).toBe('entrada');
    expect(inSentence('Ausencia Médica')).toBe('ausencia médica');
    await setLocale('en-US');
    expect(inSentence('Check in')).toBe('check in');
  });

  it('en alemán conserva la mayúscula del sustantivo', async () => {
    await setLocale('de-DE');
    expect(inSentence('Monat')).toBe('Monat');
    expect(inSentence('In Bearbeitung')).toBe('In Bearbeitung');
  });
});
