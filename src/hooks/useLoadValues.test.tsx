import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLoadValues } from './useLoadValues';

/**
 * Un formulario de edición se llena por VALORES (regla 16, en caliente): volver a pedir el registro al cambiar el
 * idioma trae un objeto nuevo con los mismos datos y lo que la persona escribió no se pisa.
 */
describe('useLoadValues', () => {
  it('llena al llegar, no con un objeto nuevo de los mismos valores, sí con valores distintos; sin datos, nada', () => {
    const load = vi.fn();
    const { rerender } = renderHook(({ values }: { values: { name: string } | null }) => useLoadValues(values, load), { initialProps: { values: null as { name: string } | null } });
    expect(load).not.toHaveBeenCalled();
    rerender({ values: { name: 'Acme' } });
    expect(load).toHaveBeenLastCalledWith({ name: 'Acme' });
    rerender({ values: { name: 'Acme' } }); // el mismo registro, pedido otra vez en otro idioma
    expect(load).toHaveBeenCalledOnce();
    rerender({ values: { name: 'Globex' } }); // otro registro o "Reintentar" tras un conflicto
    expect(load).toHaveBeenCalledTimes(2);
  });
});
