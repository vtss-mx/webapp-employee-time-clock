import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { LOCALES, setLocale, t } from '../../i18n/core';
import { DateField, dateLayout, dateSeparator, displayToValue, isoToDisplay, maskDate } from './DateField';

/**
 * El separador de la fecha sale del idioma activo (`Intl`, no una lista): «/» en es-MX, en-US, pt-BR, fr-FR, it-IT y
 * es-ES, «.» en de-DE. Se aplica a lo que se muestra, a lo que se teclea (también se aceptan «/», «.» y «-», que se
 * normalizan) y al cambio de idioma en caliente, sin perder el valor.
 */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField label="Datum" value={value} onChange={setValue} min="1920-01-01" max="2030-12-31" />
      <output>{value}</output>
    </>
  );
}

const output = () => document.querySelector('output')?.textContent;

describe('separador de la fecha por idioma', () => {
  it('cada idioma de la app tiene su separador y el marcador de posición del diccionario lo usa', async () => {
    const expected: Record<string, string> = { 'de-DE': '.' };
    for (const locale of LOCALES) {
      await setLocale(locale);
      const separator = dateSeparator();
      expect(separator, locale).toBe(expected[locale] ?? '/');
      // El marcador («dd/mm/aaaa», «TT.MM.JJJJ») escrito en el diccionario coincide con lo que Intl dice del idioma.
      expect(t('ui.dateField.placeholder').split(separator), locale).toHaveLength(3);
      expect(t('ui.dateField.invalid'), locale).toContain(t('ui.dateField.placeholder'));
    }
  });

  it('en alemán muestra, enmascara y entiende la fecha con punto; acepta «/», «.» y «-» al teclear', async () => {
    await setLocale('de-DE');
    expect(dateLayout()).toEqual({ order: 'dmy', separator: '.' });
    expect(isoToDisplay('2001-01-09')).toBe('09.01.2001');
    expect(maskDate('09/01/2001')).toBe('09.01.2001');
    expect(maskDate('09-01-2001')).toBe('09.01.2001');
    expect(maskDate('091')).toBe('09.1');
    expect(displayToValue('09.01.2001')).toBe('2001-01-09');
    expect(displayToValue('09/01/2001')).toBe('2001-01-09'); // cualquier separador se entiende
    expect(displayToValue('09-01')).toBe('');
    expect(displayToValue('31.02.2001')).toBe('31.02.2001'); // completa pero inexistente → inválida
  });

  it('el campo en alemán: TT.MM.JJJJ, lo tecleado con «/» se normaliza y el valor sigue siendo ISO', async () => {
    await setLocale('de-DE');
    render(<Harness />);
    const input = screen.getByLabelText('Datum');
    expect(input).toHaveAttribute('placeholder', 'TT.MM.JJJJ');
    await userEvent.type(input, '15/03/1990');
    expect(input).toHaveValue('15.03.1990');
    expect(output()).toBe('1990-03-15');
  });

  it('cambio de idioma en caliente: el separador cambia al instante sin perder el valor ni lo escrito a medias', async () => {
    render(<Harness initial="1990-03-15" />);
    const input = screen.getByLabelText('Datum');
    expect(input).toHaveValue('15/03/1990');

    await act(() => setLocale('de-DE'));
    expect(input).toHaveValue('15.03.1990'); // mismo orden, otro separador: el texto se reescribe
    expect(output()).toBe('1990-03-15');
    expect(input).toHaveAttribute('placeholder', 'TT.MM.JJJJ');

    await act(() => setLocale('en-US'));
    expect(input).toHaveValue('03/15/1990');
    expect(output()).toBe('1990-03-15');

    await userEvent.clear(input);
    await userEvent.type(input, '0412');
    expect(input).toHaveValue('04/12');
    await act(() => setLocale('de-DE'));
    expect(input).toHaveValue('04.12'); // a medias: se conserva, con el separador del idioma nuevo
    expect(output()).toBe('');
  });

  it('un valor externo completo pero inexistente se muestra tal cual, con cualquier separador', async () => {
    await setLocale('de-DE');
    function External() {
      const [value, setValue] = useState('');
      return (
        <>
          <DateField label="Datum" value={value} onChange={setValue} />
          <button type="button" onClick={() => setValue('31.02.2001')}>
            inexistente
          </button>
        </>
      );
    }
    render(<External />);
    await userEvent.click(screen.getByRole('button', { name: 'inexistente' }));
    expect(screen.getByLabelText('Datum')).toHaveValue('31.02.2001');
  });
});
