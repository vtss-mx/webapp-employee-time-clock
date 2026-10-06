import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { activate, setLocale, type Dictionary, type MessageKey } from './core';
import { Trans, useLocale, useT } from './react';

/** Enlaces con React: `useT` redibuja al cambiar el idioma y `Trans` arma frases con partes enriquecidas. */
function Greeting() {
  const t = useT();
  return (
    <p>
      {useLocale()} · {t('common.actions.save')}
    </p>
  );
}

describe('useT / useLocale', () => {
  it('redibuja con el idioma nuevo al instante, sin desmontar el componente', async () => {
    const { container } = render(<Greeting />);
    const paragraph = container.querySelector('p');
    expect(paragraph).toHaveTextContent('es-MX · Guardar');
    await act(() => setLocale('en-US'));
    expect(paragraph).toHaveTextContent('en-US · Save');
    expect(container.querySelector('p')).toBe(paragraph); // el mismo nodo: nada se volvió a montar
  });
});

describe('Trans', () => {
  it('inserta nodos en la frase traducida en el orden de cada idioma', async () => {
    render(<Trans k="feedback.queue" values={{ position: <strong>2</strong>, total: <em>5</em> }} />);
    expect(screen.getByText('2').tagName).toBe('STRONG');
    expect(screen.getByText('5').tagName).toBe('EM');
    expect(document.body).toHaveTextContent('2 de 5');
    await act(() => setLocale('en-US'));
    expect(document.body).toHaveTextContent('2 of 5');
  });

  it('con `count` elige la forma del plural', () => {
    activate('es-MX', { app: { tagline: 'Lema' }, people_one: '{count} persona: {who}', people_other: '{count} personas: {who}' } as unknown as Dictionary);
    const k = 'people' as MessageKey;
    const { rerender } = render(<Trans k={k} values={{ count: 1, who: <b>Ana</b> } as never} />);
    expect(document.body).toHaveTextContent('1 persona: Ana');
    rerender(<Trans k={k} values={{ count: 3, who: <b>Ana y Luis</b> } as never} />);
    expect(document.body).toHaveTextContent('3 personas: Ana y Luis');
  });
});
