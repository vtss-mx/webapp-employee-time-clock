import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../i18n/core';
import { clockDisplay, clockStyle, clockText, clockValue, completeClock, hourLabel, maskClock, parseTyped } from './clock';
import { TimeField, type TimeFieldProps } from './TimeField';

/**
 * La hora en inglés (en-US): se escribe y se ve en 12 h con AM/PM ("07:30 PM") y el valor del
 * formulario sigue siendo "HH:MM" (24 h). El cambio de idioma reescribe la hora sin perderla.
 */

function Harness({ initial = '', ...props }: Partial<Omit<TimeFieldProps, 'value' | 'onChange'>> & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TimeField label="Start time" value={value} onChange={setValue} {...props} />
      <output>{value}</output>
    </>
  );
}

const input = () => screen.getByLabelText('Start time');
const output = () => document.querySelector('output')?.textContent;

describe('utilidades de la hora en 12 h', () => {
  it('estilo del idioma activo', async () => {
    expect(clockStyle()).toBe('h23');
    await setLocale('en-US');
    expect(clockStyle()).toBe('h12');
  });

  it('escribe y nombra horas con AM/PM (mediodía y medianoche son 12)', () => {
    expect(clockText(0, 'h12')).toBe('12:00 AM');
    expect(clockText(750, 'h12')).toBe('12:30 PM');
    expect(clockText(1170, 'h12')).toBe('07:30 PM');
    expect(hourLabel(0, 'h12')).toBe('12 AM');
    expect(hourLabel(13, 'h12')).toBe('01 PM');
    expect(hourLabel(13, 'h23')).toBe('13');
  });

  it('máscara: la "a" o la "p" escriben la marca, la última gana y se borra letra por letra', () => {
    expect(maskClock('0730p', 'h12')).toBe('07:30 P');
    expect(maskClock('07:30 PM', 'h12')).toBe('07:30 PM');
    expect(maskClock('07:30 PMa', 'h12')).toBe('07:30 A');
    expect(maskClock('07:30 ', 'h12')).toBe('07:30');
    expect(maskClock('p', 'h12')).toBe('P');
  });

  it('lectura: 01 a 12 con su marca; sin marca, como 24 h', () => {
    expect(parseTyped('07:30 PM', 'h12')).toBe(1170);
    expect(parseTyped('12:15 AM', 'h12')).toBe(15);
    expect(parseTyped('19:30', 'h12')).toBe(1170);
    expect(parseTyped('13:00 P', 'h12')).toBeNull();
    expect(parseTyped('07:75 A', 'h12')).toBeNull();
    expect(parseTyped('7:30 PM', 'h12')).toBeNull();
    expect(parseTyped('07:30')).toBe(450);
  });

  it('valor (24 h), lo que se ve y cómo se completa al salir', () => {
    expect(clockValue('07:30 P', 'h12')).toBe('19:30');
    expect(clockValue('07:3 P', 'h12')).toBe('');
    expect(clockValue('13:00 P', 'h12')).toBe('13:00 P'); // completa pero inexistente → la validación la marca
    expect(clockDisplay('19:30:00', 'h12')).toBe('07:30 PM');
    expect(clockDisplay('', 'h12')).toBe('');
    expect(completeClock('7 P', 'h12')).toBe('07:00 PM');
    expect(completeClock('19', 'h12')).toBe('07:00 PM');
    expect(completeClock('730', 'h12')).toBe('07:30 AM');
    expect(completeClock('25', 'h12')).toBe('25:00');
    expect(completeClock('', 'h12')).toBe('');
  });
});

describe('TimeField en inglés', () => {
  it('"0730p" → "07:30 P" (valor 19:30); al salir, "07:30 PM"', async () => {
    await setLocale('en-US');
    render(<Harness />);
    expect(input()).toHaveAttribute('placeholder', 'hh:mm AM');
    expect(input()).not.toHaveAttribute('maxlength');
    await userEvent.type(input(), '0730p');
    expect(input()).toHaveValue('07:30 P');
    expect(output()).toBe('19:30');
    await userEvent.tab();
    expect(input()).toHaveValue('07:30 PM');
    expect(output()).toBe('19:30');
  });

  it('explica en inglés una hora que no existe o fuera de los límites (en 12 h)', async () => {
    await setLocale('en-US');
    render(<Harness min="07:00" />);
    await userEvent.type(input(), '0630');
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a time between 07:00 AM and 11:59 PM');
    await userEvent.clear(input());
    await userEvent.type(input(), '1300p');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a time between 12:00 AM and 11:59 PM');
    expect(output()).toBe('13:00 P');
  });

  it('selector: lectura en 12 h, horas con AM/PM y sugeridas en el formato del idioma', async () => {
    await setLocale('en-US');
    render(<Harness initial="19:30" presets={['07:00', { value: '12:00', label: 'Noon' }]} />);
    expect(input()).toHaveValue('07:30 PM');
    await userEvent.click(screen.getByRole('button', { name: 'Choose time' }));
    const dialog = screen.getByRole('dialog', { name: 'Choose time' });
    const hours = screen.getByRole('listbox', { name: 'Hour' });
    await waitFor(() => expect(hours).toHaveFocus());
    expect(within(dialog).getByText('07:30 PM')).toBeInTheDocument();
    expect(within(hours).getByRole('option', { name: '07 PM' })).toHaveAttribute('aria-selected', 'true');
    expect(within(hours).getAllByRole('option')[0]).toHaveTextContent('12 AM');
    const presets = screen.getByRole('group', { name: 'Suggested times' });
    expect(within(presets).getByRole('button', { name: '07:00 AM' })).toBeInTheDocument();
    await userEvent.click(within(hours).getByRole('option', { name: '08 AM' }));
    expect(output()).toBe('08:30');
    expect(input()).toHaveValue('08:30 AM');
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Min' })).getByRole('option', { name: '45' }));
    expect(output()).toBe('08:45');
  });

  it('cambio de idioma en caliente: la hora se reescribe y el valor se conserva; lo escrito a medias se queda', async () => {
    render(<Harness initial="19:30" />);
    expect(input()).toHaveValue('19:30');
    expect(input()).toHaveAttribute('maxlength', '5');
    await act(() => setLocale('en-US'));
    expect(input()).toHaveValue('07:30 PM');
    expect(output()).toBe('19:30');
    expect(screen.getByRole('button', { name: 'Choose time' })).toBeInTheDocument();
    await act(() => setLocale('es-MX'));
    expect(input()).toHaveValue('19:30');

    await userEvent.clear(input());
    await userEvent.type(input(), '07');
    await act(() => setLocale('en-US'));
    expect(input()).toHaveValue('07');
    expect(output()).toBe('');
  });
});
