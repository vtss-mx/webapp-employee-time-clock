import { describe, expect, it } from 'vitest';
import { derive } from './derive';

/** Diccionario derivado (es-ES sobre es-MX): las mismas llaves, solo lo sobrescrito cambia, el resto se conserva. */
describe('derive', () => {
  const base = { actions: { save: 'Guardar', check: 'Checar' }, fields: { phone: 'Celular' }, plain: 'Igual' } as const;

  it('sobrescribe solo lo indicado, en cualquier nivel, y conserva lo demás', () => {
    const derived = derive(base, { actions: { check: 'Fichar' }, fields: { phone: 'Móvil' } });
    expect(derived).toEqual({ actions: { save: 'Guardar', check: 'Fichar' }, fields: { phone: 'Móvil' }, plain: 'Igual' });
    expect(derived).not.toBe(base); // un objeto nuevo: el original no se toca
    expect(base.actions.check).toBe('Checar');
  });

  it('sin cambios devuelve las mismas llaves y textos', () => {
    expect(derive(base, {})).toEqual(base);
  });
});
