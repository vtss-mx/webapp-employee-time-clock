import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
import { catalogsWith, TAX_ID_TYPES, testCatalogs } from '../test/catalogs';
import type { TaxIdTypeItem } from '../types';
import { formatTaxId, mainTaxIdType, normalizeTaxId, taxIdHint, taxIdKey, taxIdTypesFor, validateTaxId } from './taxId';

/** Tipo de prueba por código (los mismos registros que el seed del backend). */
const type = (code: string) => TAX_ID_TYPES.find((item) => item.code === code) as TaxIdTypeItem;

describe('identificador fiscal: tipos por país', () => {
  it('ofrece los del país y «Otro», activos y en el orden del catálogo; propone el primero del país', () => {
    expect(taxIdTypesFor(TAX_ID_TYPES, 'FR').map((item) => item.code)).toEqual(['FR_SIREN', 'FR_SIRET', 'OTHER']);
    expect(taxIdTypesFor(TAX_ID_TYPES, 'GT').map((item) => item.code)).toEqual(['OTHER']);
    expect(mainTaxIdType(TAX_ID_TYPES, 'GB')).toBe('GB_VAT');
    expect(mainTaxIdType(TAX_ID_TYPES, 'GT')).toBe('OTHER'); // un país sin tipos propios
    const inactive = TAX_ID_TYPES.map((item) => (item.code === 'US_EIN' ? { ...item, active: false } : item));
    expect(taxIdTypesFor(inactive, 'US').map((item) => item.code)).toEqual(['OTHER']);
    expect(mainTaxIdType(inactive, 'US')).toBe('OTHER');
  });
});

describe('identificador fiscal: captura y validación del cliente', () => {
  it('normaliza mientras se escribe: mayúsculas, sin separadores y hasta el largo de su tipo', () => {
    expect(normalizeTaxId('12-345.678/9 99', type('US_EIN'))).toBe('123456789');
    expect(normalizeTaxId('b-1234 5678')).toBe('B12345678'); // sin tipo (catálogo sin cargar): sin tope
  });

  it('vacío es opcional; el RFC con su regla completa; los demás con el largo y la regla del catálogo', () => {
    expect(validateTaxId('', type('US_EIN'))).toBeUndefined();
    expect(validateTaxId('12345', undefined)).toBeUndefined(); // un tipo que el catálogo no tiene: decide el backend
    expect(validateTaxId('XAXX010101000', type('MX_RFC'))).toBe('El RFC genérico no es válido; escribe el RFC real');
    expect(validateTaxId('PNO120315AB1', type('MX_RFC'))).toBeUndefined();
    expect(validateTaxId('1234', type('US_EIN'))).toBe('El número de EIN debe tener 9 caracteres');
    expect(validateTaxId('1234', type('CA_BN'))).toBe('El número de BN debe tener de 9 a 15 caracteres');
    expect(validateTaxId('X'.repeat(31), type('OTHER'))).toBe('El número de ID fiscal debe tener de 3 a 30 caracteres');
    expect(validateTaxId('11693450239', type('AR_CUIT'))).toBe('Formato de CUIT no válido (p. ej. 30500010912)');
    expect(validateTaxId('33693450238', type('AR_CUIT'))).toBeUndefined(); // el dígito verificador lo revisa el backend
    expect(validateTaxId('GB123456789', type('GB_VAT'))).toBeUndefined();
    // Una regla que el navegador no entiende no bloquea: la aplica el backend.
    expect(validateTaxId('ABC', { ...type('OTHER'), pattern: '([' })).toBeUndefined();
  });

  it('la ayuda dice el formato y un ejemplo del tipo; sin tipo, solo que es opcional', async () => {
    expect(taxIdHint(type('US_EIN'))).toBe('Opcional · 9 dígitos · p. ej. 123456789');
    expect(taxIdHint({ ...type('US_EIN'), description: null })).toBe('Opcional · Número de identificación del empleador · p. ej. 123456789');
    expect(taxIdHint(undefined)).toBe('Opcional');
    await setLocale('en-US');
    expect(taxIdHint(type('US_EIN'))).toBe('Optional · 9 dígitos · e.g., 123456789');
    expect(validateTaxId('1234', type('US_EIN'))).toBe('The EIN must have 9 characters');
  });
});

describe('identificador fiscal: comparar y mostrar', () => {
  it('sin número no hay identificador: el país y el tipo no cuentan', () => {
    expect(taxIdKey({ tax_country: 'MX', tax_id_type: 'MX_RFC', tax_id: '' })).toBe(taxIdKey({ tax_country: 'US', tax_id_type: 'US_EIN', tax_id: null }));
    expect(taxIdKey({ tax_country: 'US', tax_id_type: 'US_EIN', tax_id: ' 123456789 ' })).toBe('US|US_EIN|123456789');
  });

  it('«RFC · PNO120315AB1 · México»: la sigla y el país del catálogo; sin número, nada', () => {
    expect(formatTaxId({ tax_country: 'MX', tax_id_type: 'MX_RFC', tax_id: 'PNO120315AB1' }, testCatalogs)).toBe('RFC · PNO120315AB1 · México');
    expect(formatTaxId({ tax_country: 'US', tax_id_type: 'US_EIN', tax_id: '123456789' }, testCatalogs)).toBe('EIN · 123456789 · Estados Unidos');
    expect(formatTaxId({ tax_country: null, tax_id_type: null, tax_id: null }, testCatalogs)).toBeNull();
    // Un tipo que el catálogo ya no tiene se nombra con su código.
    const missing = catalogsWith({ tax_id_types: [] });
    expect(formatTaxId({ tax_country: 'US', tax_id_type: 'US_EIN', tax_id: '123456789' }, missing)).toBe('US_EIN · 123456789 · Estados Unidos');
    expect(formatTaxId({ tax_country: 'XX', tax_id_type: null, tax_id: '1' }, missing)).toBe(' · 1 · XX');
  });
});

describe('tipos de identificador fiscal del seed del backend', () => {
  it('el ejemplo de cada tipo cumple su propia regla', () => {
    expect(TAX_ID_TYPES.length).toBeGreaterThan(0);
    for (const item of TAX_ID_TYPES) expect(new RegExp(item.pattern).test(item.example), item.code).toBe(true);
  });
});
