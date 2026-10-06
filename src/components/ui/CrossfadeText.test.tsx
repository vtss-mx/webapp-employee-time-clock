import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setLocale, t } from '../../i18n/core';
import { CrossfadeText } from './CrossfadeText';

const layers = (container: HTMLElement) => [...container.querySelectorAll('.crossfade__layer')].map((layer) => [layer.className.replace('crossfade__layer ', ''), layer.textContent]);

describe('CrossfadeText: texto con fundido cruzado', () => {
  it('al cambiar, el anterior se desvanece (sin anunciarse) mientras entra el nuevo en el mismo lugar; se retira al terminar', () => {
    const { container, rerender } = render(<CrossfadeText text="Centra tu rostro" className="mi-texto" />);
    expect(container.querySelector('.crossfade')).toHaveClass('crossfade', 'mi-texto');
    expect(layers(container)).toEqual([['crossfade__layer--current', 'Centra tu rostro']]);

    // La misma frase con otra función que la escribe: no hay fundido.
    rerender(<CrossfadeText text={() => 'Centra tu rostro'} className="mi-texto" />);
    expect(layers(container)).toEqual([['crossfade__layer--current', 'Centra tu rostro']]);

    rerender(<CrossfadeText text="Mantente quieto" />);
    expect(layers(container)).toEqual([
      ['crossfade__layer--leaving', 'Centra tu rostro'],
      ['crossfade__layer--current', 'Mantente quieto'],
    ]);
    const leaving = container.querySelector('.crossfade__layer--leaving') as HTMLElement;
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    // Otro cambio a medio fundido: sale el vigente (el más viejo ya no se ve).
    rerender(<CrossfadeText text="Listo" />);
    expect(layers(container)).toEqual([
      ['crossfade__layer--leaving', 'Mantente quieto'],
      ['crossfade__layer--current', 'Listo'],
    ]);
    fireEvent.animationEnd(container.querySelector('.crossfade__layer--leaving') as HTMLElement);
    expect(layers(container)).toEqual([['crossfade__layer--current', 'Listo']]);
  });

  it('una función se escribe al dibujarse: con el cambio de idioma a medio fundido, también el que sale', async () => {
    const { container, rerender } = render(<CrossfadeText text={() => t('face.guidance.holdStill')} />);
    rerender(<CrossfadeText text={() => t('face.guidance.ready')} />);
    expect(layers(container)).toEqual([
      ['crossfade__layer--leaving', 'Mantente quieto'],
      ['crossfade__layer--current', 'Rostro detectado'],
    ]);
    await act(() => setLocale('en-US'));
    rerender(<CrossfadeText text={() => t('face.guidance.ready')} />);
    expect(layers(container)).toEqual([
      ['crossfade__layer--leaving', 'Hold still'],
      ['crossfade__layer--current', 'Face detected'],
    ]);
  });
});
