import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { catalogsFixture, catalogsWith } from '../test/catalogs';
import { renderWithProviders } from '../test/render';
import { ConfidenceSlider } from './ConfidenceSlider';

/** Catálogo donde el nivel 99 ya es muy estricto (rechaza ≥ 10 % de capturas legítimas). */
const strict99 = catalogsWith({
  confidence_levels: catalogsFixture.confidence_levels.map((level) => (level.code === '99' ? { ...level, rejection_rate: 12 } : level)),
});

describe('ConfidenceSlider', () => {
  it('un nivel muy estricto por debajo de 100 pide confirmación sin el aviso del máximo calibrado; cancelar no guarda', async () => {
    const onSave = vi.fn();
    renderWithProviders(<ConfidenceSlider value={0.95} onSave={onSave} />, { catalogs: strict99 });
    fireEvent.change(screen.getByRole('slider', { name: 'Nivel de confianza requerido' }), { target: { value: '99' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nivel' }));

    const popup = await screen.findByRole('alertdialog', { name: '¿Exigir 99 % de confianza?' });
    expect(popup).toHaveTextContent('Aproximadamente 12 % de las capturas legítimas');
    expect(popup).not.toHaveTextContent('Ningún sistema biométrico puede garantizar el 100 %');
    await userEvent.click(within(popup).getByRole('button', { name: 'Cancelar' }));
    expect(onSave).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar nivel' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Guardar nivel' }));
    expect(onSave).toHaveBeenCalledWith(0.99);
  });

  it('sin niveles activos en el catálogo no se dibuja', () => {
    const { container } = renderWithProviders(<ConfidenceSlider value={0.9} onSave={() => undefined} />, {
      catalogs: catalogsWith({ confidence_levels: [] }),
    });
    expect(container).toBeEmptyDOMElement();
  });
});
