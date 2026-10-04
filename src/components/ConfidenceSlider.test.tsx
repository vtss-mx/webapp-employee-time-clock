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

/** Mueve el control a esa posición y pide guardar: devuelve el slider. */
async function pick(position: string, label = 'Nivel de confianza requerido') {
  const slider = screen.getByRole('slider', { name: label });
  fireEvent.change(slider, { target: { value: position } });
  await userEvent.click(screen.getByRole('button', { name: 'Guardar nivel' }));
  return slider;
}

describe('ConfidenceSlider', () => {
  it('un nivel muy estricto por debajo de 100 pide confirmación sin el aviso del máximo calibrado; cancelar no guarda', async () => {
    const onSave = vi.fn();
    renderWithProviders(<ConfidenceSlider value={0.95} onSave={onSave} />, { catalogs: strict99 });
    const slider = await pick('99');

    const popup = await screen.findByRole('alertdialog', { name: '¿Exigir 99 % de confianza?' });
    expect(popup).toHaveClass('msg--warning');
    expect(popup).toHaveTextContent('Es el nivel más estricto');
    expect(within(popup).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Nivel de confianza requeridoAntes: 95 % (Alto)Después: 99 % (Estricto)');
    const advice = within(popup).getByRole('region', { name: 'Antes de exigirlo' });
    expect(advice).toHaveTextContent('Aproximadamente 12 % de las capturas legítimas');
    expect(advice).not.toHaveTextContent('Ningún sistema biométrico puede garantizar el 100 %');
    await userEvent.click(within(popup).getByRole('button', { name: 'Cancelar' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(slider).toHaveValue('99'); // el control queda donde estaba, sin guardar

    await userEvent.click(screen.getByRole('button', { name: 'Guardar nivel' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Guardar nivel' }));
    expect(onSave).toHaveBeenCalledWith(0.99);
  });

  it('subir a un nivel no tan estricto también se confirma, con sus cifras medidas', async () => {
    const onSave = vi.fn();
    renderWithProviders(<ConfidenceSlider value={0.9} onSave={onSave} />);
    await pick('95');
    const popup = await screen.findByRole('dialog', { name: '¿Exigir 95 % de confianza?' });
    expect(popup).toHaveTextContent('Un nivel más alto protege mejor');
    expect(within(popup).getByRole('region', { name: 'Con este nivel' })).toHaveTextContent('Similitud exigida0.427');
    expect(popup).toHaveTextContent('Aplica en segundos a todas las verificaciones faciales de la empresa.');
    await userEvent.click(within(popup).getByRole('button', { name: 'Guardar nivel' }));
    expect(onSave).toHaveBeenCalledWith(0.95);
  });

  it('bajar el nivel se advierte en rojo: acepta con más facilidad a una persona parecida', async () => {
    const onSave = vi.fn();
    renderWithProviders(<ConfidenceSlider value={0.95} label="Nivel para identificar" onSave={onSave} />);
    await pick('80', 'Nivel para identificar');
    const popup = await screen.findByRole('alertdialog', { name: '¿Exigir 80 % de confianza?' });
    expect(popup).toHaveClass('msg--error');
    expect(popup).toHaveTextContent('acepta con más facilidad a una persona parecida');
    expect(within(popup).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Nivel para identificarAntes: 95 % (Alto)Después: 80 % (Flexible)');
    await userEvent.click(within(popup).getByRole('button', { name: 'Cancelar' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sin niveles activos en el catálogo no se dibuja', () => {
    const { container } = renderWithProviders(<ConfidenceSlider value={0.9} onSave={() => undefined} />, {
      catalogs: catalogsWith({ confidence_levels: [] }),
    });
    expect(container).toBeEmptyDOMElement();
  });
});
