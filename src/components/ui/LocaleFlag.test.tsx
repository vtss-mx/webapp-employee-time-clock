import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../i18n';
import { ENDONYMS } from '../../i18n/endonyms';
import { LocaleFlag } from './LocaleFlag';

/** Banderas propias (SVG, sin emoji): una por idioma, decorativas, con el tamaño pedido. */
describe('LocaleFlag', () => {
  it.each(LOCALES)('%s: dibuja la bandera de su país como SVG decorativo', (locale) => {
    const { container } = render(<LocaleFlag locale={locale} />);
    const svg = container.querySelector('svg.locale-flag');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-country', ENDONYMS[locale].flag);
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveAttribute('height', '14');
    expect(svg?.querySelectorAll('rect, path, circle').length).toBeGreaterThan(1);
  });

  it('respeta la proporción 20:14 con otro ancho y agrega la clase pedida', () => {
    const { container } = render(<LocaleFlag locale="es-MX" width={30} className="grande" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('height', '21');
    expect(svg).toHaveClass('locale-flag', 'grande');
  });
});
