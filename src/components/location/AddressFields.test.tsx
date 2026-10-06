import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
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

/** Los campos, en el orden, con las etiquetas y las ayudas que pidió el dueño del producto. */
const OWNER_FIELDS: Array<[string, string]> = [
  ['País', 'País donde se encuentra la dirección.'],
  ['Estado o provincia', 'Entidad federativa o región.'],
  ['Municipio o alcaldía', 'División administrativa a la que pertenece.'],
  ['Ciudad o localidad', 'Ciudad, pueblo o localidad; puede tener un nombre distinto al municipio.'],
  ['Colonia o barrio', 'Zona o asentamiento dentro de la localidad.'],
  ['Código postal', 'Código de la zona postal.'],
  ['Calle o vialidad', 'Nombre de la calle, avenida, carretera, etcétera.'],
  ['Número exterior', 'Número que identifica el inmueble; puede contener letras.'],
  ['Número interior', 'Departamento, oficina o local dentro del inmueble. Es opcional.'],
  ['Referencias', 'Indicaciones adicionales para localizarlo, como entrecalles o puntos cercanos. Son opcionales.'],
];
const TEXT_LABELS = OWNER_FIELDS.slice(1).map(([label]) => label);

describe('AddressFields', () => {
  it('pide los campos en el orden del dueño del producto, con sus etiquetas, ayudas y límites', () => {
    renderFields();
    const labels = [...document.querySelectorAll('.address-fields label')].map((label) => label.textContent);
    expect(labels).toEqual(OWNER_FIELDS.map(([label]) => label));
    for (const [label, hint] of OWNER_FIELDS.slice(1)) expect(screen.getByLabelText(label)).toHaveAccessibleDescription(hint);
    expect(countryButton()).toHaveAccessibleDescription('País donde se encuentra la dirección.');
    expect(countryButton()).toHaveTextContent('México');
    for (const label of ['Estado o provincia', 'Municipio o alcaldía', 'Ciudad o localidad', 'Colonia o barrio', 'Código postal', 'Calle o vialidad', 'Número exterior']) {
      expect(screen.getByLabelText(label), label).toBeRequired();
    }
    expect(screen.getByLabelText('Número interior')).not.toBeRequired();
    expect(screen.getByLabelText('Referencias')).not.toBeRequired();
    expect(screen.getByLabelText('Calle o vialidad')).toHaveAttribute('maxLength', '150');
    expect(screen.getByLabelText('Colonia o barrio')).toHaveAttribute('maxLength', '120');
  });

  it('las referencias son un campo propio de varios renglones, a lo ancho y con contador', async () => {
    const { onChange, onTouch } = renderFields({ initial: { ...EMPTY_ADDRESS, reference_notes: 'Puerta 2' } });
    const notes = screen.getByLabelText('Referencias');
    expect(notes.tagName).toBe('TEXTAREA');
    expect(notes).toHaveClass('textarea');
    expect(notes).toHaveAttribute('maxLength', '300');
    expect(notes).toHaveAttribute('rows', '3');
    expect(notes.closest('.field')).toHaveClass('address-fields__wide');
    const counter = () => notes.closest('.field')?.querySelector('.field__counter');
    expect(counter()).toHaveTextContent('8/300');
    expect(counter()).toHaveAttribute('aria-hidden', 'true'); // el límite ya lo anuncia el control
    expect(counter()).not.toHaveClass('is-full');

    await userEvent.type(notes, '{Enter}Timbre');
    expect(onChange).toHaveBeenLastCalledWith('reference_notes', 'Puerta 2\nTimbre');
    expect(counter()).toHaveTextContent('15/300');
    await userEvent.tab();
    expect(onTouch).toHaveBeenCalledWith('reference_notes');
  });

  it('el contador avisa al llegar al límite; el error de las referencias se muestra junto a él', () => {
    renderFields({ initial: { ...EMPTY_ADDRESS, reference_notes: 'x'.repeat(300) }, errors: { reference_notes: 'Máximo 300 caracteres' } });
    const field = screen.getByLabelText('Referencias').closest('.field');
    expect(field?.querySelector('.field__counter')).toHaveClass('is-full');
    expect(field).toHaveClass('field--error');
    expect(screen.getByRole('alert')).toHaveTextContent('Máximo 300 caracteres');
  });

  it('cada campo entrega lo escrito y avisa al salir de él', async () => {
    const { onChange, onTouch } = renderFields();
    await userEvent.type(screen.getByLabelText('Calle o vialidad'), 'Juárez');
    expect(onChange).toHaveBeenLastCalledWith('street', 'Juárez');
    await userEvent.tab();
    expect(onTouch).toHaveBeenCalledWith('street');
    await userEvent.type(screen.getByLabelText('Municipio o alcaldía'), 'Cajeme');
    expect(onChange).toHaveBeenLastCalledWith('municipality', 'Cajeme');
    await userEvent.type(screen.getByLabelText('Colonia o barrio'), 'Centro');
    expect(onChange).toHaveBeenLastCalledWith('neighborhood', 'Centro');
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
    renderFields({ errors: { city: 'Escribe la ciudad o localidad' } });
    expect(countryButton().closest('.field')).not.toHaveClass('field--error');
    expect(screen.getByLabelText('Ciudad o localidad')).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe la ciudad o localidad');
  });

  it('deshabilitado no deja escribir ni elegir', () => {
    renderFields({ disabled: true });
    for (const label of TEXT_LABELS) expect(screen.getByLabelText(label), label).toBeDisabled();
    expect(countryButton()).toBeDisabled();
  });
});

describe('AddressFields en inglés (en-US)', () => {
  /** Las etiquetas del dueño del producto en inglés, en el mismo orden. */
  const ENGLISH_LABELS = ['Country', 'State or province', 'Municipality or borough', 'City or town', 'Neighborhood', 'Postal code', 'Street', 'Street number', 'Unit number', 'Reference notes'];

  it('pide los mismos campos con sus etiquetas, ayudas y ejemplos en inglés', async () => {
    await setLocale('en-US');
    renderFields({ initial: { ...EMPTY_ADDRESS, country_code: '' } });
    expect([...document.querySelectorAll('.address-fields label')].map((label) => label.textContent)).toEqual(ENGLISH_LABELS);
    const country = screen.getByRole('button', { name: /Country/ });
    expect(country).toHaveAccessibleDescription('Country where the address is located.');
    expect(country).toHaveTextContent('Choose the country');
    expect(screen.getByLabelText('Neighborhood')).toHaveAccessibleDescription('Area or district within the city or town.');
    expect(screen.getByLabelText('Unit number')).toHaveAccessibleDescription('Apartment, office, or suite within the building. Optional.');
    expect(screen.getByLabelText('Reference notes')).toHaveAttribute('placeholder', 'Between Oak Street and Pine Avenue, across from the park');
    await userEvent.click(country);
    expect(screen.getByRole('combobox', { name: 'Search country' })).toBeInTheDocument();
  });

  it('cambio en caliente: lo escrito se conserva y las etiquetas y ayudas pasan a inglés', async () => {
    const { onChange } = renderFields();
    await userEvent.type(screen.getByLabelText('Calle o vialidad'), 'Juárez');
    await userEvent.type(screen.getByLabelText('Referencias'), 'Puerta azul');
    await act(() => setLocale('en-US'));
    expect(screen.getByLabelText('Street')).toHaveValue('Juárez');
    expect(screen.getByLabelText('Street')).toHaveAccessibleDescription('Name of the street, avenue, highway, and so on.');
    expect(screen.getByLabelText('Reference notes')).toHaveValue('Puerta azul');
    expect(screen.queryByLabelText('Calle o vialidad')).toBeNull();
    expect(screen.getByRole('button', { name: /Country/ })).toHaveTextContent('México'); // el nombre del catálogo lo envía el servidor
    expect(onChange).toHaveBeenLastCalledWith('reference_notes', 'Puerta azul'); // cambiar el idioma no envía nada
  });
});
