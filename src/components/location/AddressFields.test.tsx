import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { catalogsWith } from '../../test/catalogs';
import { renderWithProviders } from '../../test/render';
import type { CountryItem } from '../../types';
import { EMPTY_ADDRESS, type AddressValues } from '../../utils/address';
import { AddressFields } from './AddressFields';

interface HarnessProps {
  initial?: AddressValues;
  errors?: Partial<Record<keyof AddressValues, string>>;
  disabled?: boolean;
  onChange: (field: keyof AddressValues, value: string) => void;
  onTouch: (field: keyof AddressValues) => void;
}

/** El formulario que usa los campos: guarda lo que recibe. */
function Harness({ initial = EMPTY_ADDRESS, errors = {}, disabled, onChange, onTouch }: HarnessProps) {
  const [values, setValues] = useState(initial);
  return (
    <AddressFields
      values={values}
      errors={errors}
      disabled={disabled}
      onTouch={onTouch}
      onChange={(field, value) => {
        onChange(field, value);
        setValues((current) => ({ ...current, [field]: value }));
      }}
    />
  );
}

function renderFields(props: Partial<Omit<HarnessProps, 'onChange' | 'onTouch'>> = {}, options: Parameters<typeof renderWithProviders>[1] = {}) {
  const onChange = vi.fn<(field: keyof AddressValues, value: string) => void>();
  const onTouch = vi.fn<(field: keyof AddressValues) => void>();
  const view = renderWithProviders(<Harness {...props} onChange={onChange} onTouch={onTouch} />, options);
  return { ...view, onChange, onTouch };
}

const countryButton = () => screen.getByRole('button', { name: /País/ });
const country = (code: string, name: string, featured: boolean, sort_order: number, active = true): CountryItem => ({
  code,
  name,
  description: null,
  dial_code: '+1',
  featured,
  sort_order,
  active,
});

describe('AddressFields', () => {
  it('pide calle, números, código postal, país, estado, municipio y ciudad, con sus límites y ayudas', () => {
    renderFields();
    const labels = [...document.querySelectorAll('.address-fields label')].map((label) => label.textContent);
    expect(labels).toEqual(['Calle', 'Número exterior', 'Número interior', 'Código postal', 'País', 'Estado', 'Municipio o alcaldía', 'Ciudad']);
    expect(screen.getByLabelText('Calle')).toBeRequired();
    expect(screen.getByLabelText('Calle')).toHaveAttribute('maxLength', '150');
    expect(screen.getByLabelText('Número interior')).not.toBeRequired();
    expect(screen.getByLabelText('Número interior')).toHaveAccessibleDescription('Opcional: local, piso, oficina...');
    expect(screen.getByLabelText('Número exterior')).toHaveAccessibleDescription('Si no tiene, escribe S/N');
    expect(screen.getByLabelText('Ciudad')).toBeRequired();
    expect(countryButton()).toHaveTextContent('México');
  });

  it('cada campo entrega lo escrito y avisa al salir de él', async () => {
    const { onChange, onTouch } = renderFields();
    await userEvent.type(screen.getByLabelText('Calle'), 'Juárez');
    expect(onChange).toHaveBeenLastCalledWith('street', 'Juárez');
    await userEvent.tab();
    expect(onTouch).toHaveBeenCalledWith('street');
    await userEvent.type(screen.getByLabelText('Municipio o alcaldía'), 'Cajeme');
    expect(onChange).toHaveBeenLastCalledWith('municipality', 'Cajeme');
  });

  it('el código postal se normaliza (mayúsculas, sin espacios repetidos) y en México usa teclado numérico', async () => {
    const { onChange } = renderFields({ initial: { ...EMPTY_ADDRESS, country_code: 'CA' } });
    const postal = screen.getByLabelText('Código postal');
    expect(postal).not.toHaveAttribute('inputMode');
    await userEvent.type(postal, ' k1a  0b1');
    expect(postal).toHaveValue('K1A 0B1');
    expect(onChange).toHaveBeenLastCalledWith('postal_code', 'K1A 0B1');
  });

  it('en México el código postal pide teclado numérico', () => {
    renderFields();
    expect(screen.getByLabelText('Código postal')).toHaveAttribute('inputMode', 'numeric');
  });

  it('el país se elige de la lista con búsqueda y el campo queda tocado', async () => {
    const { onChange, onTouch } = renderFields();
    await userEvent.click(countryButton());
    await userEvent.type(screen.getByRole('combobox', { name: 'Buscar país' }), 'estados');
    await userEvent.click(screen.getByRole('option', { name: /Estados Unidos/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('country_code', 'US');
    expect(onTouch).toHaveBeenCalledExactlyOnceWith('country_code');
    expect(countryButton()).toHaveTextContent('Estados Unidos');
  });

  it('la lista ofrece solo los países activos: los destacados primero y luego en el orden del catálogo', async () => {
    const catalogs = catalogsWith({
      countries: [country('AR', 'Argentina', false, 1), country('MX', 'México', true, 3), country('XX', 'Inactivo', true, 0, false), country('BR', 'Brasil', false, 2), country('US', 'Estados Unidos', true, 4)],
    });
    renderFields({}, { catalogs });
    await userEvent.click(countryButton());
    const names = within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual([expect.stringContaining('México'), expect.stringContaining('Estados Unidos'), expect.stringContaining('Argentina'), expect.stringContaining('Brasil')]);
    expect(screen.getByRole('option', { name: /México/ })).toHaveTextContent('🇲🇽');
  });

  it('el error del país marca su campo y se anuncia', () => {
    const { container } = renderFields({ initial: { ...EMPTY_ADDRESS, country_code: '' }, errors: { country_code: 'Elige el país' } });
    expect(countryButton()).toHaveTextContent('Elige el país');
    expect(screen.getByRole('alert')).toHaveTextContent('Elige el país');
    expect(countryButton().closest('.field')).toHaveClass('field--error');
    expect(container.querySelectorAll('.field--error')).toHaveLength(1);
  });

  it('sin error el país no se marca; los errores de texto se muestran en su campo', () => {
    renderFields({ errors: { city: 'Escribe la ciudad' } });
    expect(countryButton().closest('.field')).not.toHaveClass('field--error');
    expect(screen.getByLabelText('Ciudad')).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe la ciudad');
  });

  it('deshabilitado no deja escribir ni elegir', () => {
    renderFields({ disabled: true });
    for (const label of ['Calle', 'Número exterior', 'Número interior', 'Código postal', 'Estado', 'Municipio o alcaldía', 'Ciudad']) expect(screen.getByLabelText(label)).toBeDisabled();
    expect(countryButton()).toBeDisabled();
  });
});
