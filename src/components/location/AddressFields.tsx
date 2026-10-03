import { Building, Hash, Landmark, Mailbox, MapPinned, Signpost } from 'lucide-react';
import { useId, useMemo, type ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { ADDRESS_MAX, normalizePostalCode, type AddressValues } from '../../utils/address';
import { flagOf } from '../../utils/phone';
import { FieldLabel, FieldMessage, FormField } from '../FormField';
import { Select, type SelectOption } from '../ui/Select';

interface AddressFieldsProps {
  values: AddressValues;
  errors: Partial<Record<keyof AddressValues, string>>;
  onChange: (field: keyof AddressValues, value: string) => void;
  onTouch: (field: keyof AddressValues) => void;
  disabled?: boolean;
}

type TextField = Exclude<keyof AddressValues, 'country_code'>;

/** Etiqueta, ícono y ayuda de cada campo de texto (en el orden en que se piden). */
const FIELDS: Array<{ field: TextField; label: string; icon: ReactNode; required: boolean; hint?: string; inputMode?: 'numeric' | 'text' }> = [
  { field: 'street', label: 'Calle', icon: <Signpost size={18} />, required: true },
  { field: 'exterior_number', label: 'Número exterior', icon: <Hash size={18} />, required: true, hint: 'Si no tiene, escribe S/N' },
  { field: 'interior_number', label: 'Número interior', icon: <Building size={18} />, required: false, hint: 'Opcional: local, piso, oficina...' },
  { field: 'postal_code', label: 'Código postal', icon: <Mailbox size={18} />, required: true },
];
const REGION_FIELDS: Array<{ field: TextField; label: string; icon: ReactNode }> = [
  { field: 'state', label: 'Estado', icon: <Landmark size={18} /> },
  { field: 'municipality', label: 'Municipio o alcaldía', icon: <MapPinned size={18} /> },
  { field: 'city', label: 'Ciudad', icon: <Building size={18} /> },
];

/** Países activos del catálogo (los destacados primero) con su bandera, para la lista con búsqueda. */
function useCountryOptions(): Array<SelectOption> {
  const { countries } = useCatalogs();
  return useMemo(
    () =>
      countries
        .filter((c) => c.active)
        .sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort_order - b.sort_order)
        .map((c) => ({ value: c.code, label: c.name, icon: <span className="flag">{flagOf(c.code)}</span> })),
    [countries],
  );
}

/**
 * Domicilio: calle, número exterior e interior, código postal, país (lista con búsqueda del
 * catálogo), estado, municipio y ciudad. El mapa (LocationPicker) los llena cuando puede.
 */
export function AddressFields({ values, errors, onChange, onTouch, disabled = false }: AddressFieldsProps) {
  const countryOptions = useCountryOptions();
  const countryId = useId();
  const text = (field: TextField, label: string, icon: ReactNode, extra: { required?: boolean; hint?: string } = {}) => (
    <FormField
      key={field}
      label={label}
      icon={icon}
      required={extra.required ?? true}
      hint={extra.hint}
      maxLength={ADDRESS_MAX[field]}
      autoComplete="off"
      inputMode={field === 'postal_code' && values.country_code === 'MX' ? 'numeric' : undefined}
      disabled={disabled}
      value={values[field]}
      error={errors[field]}
      onBlur={() => onTouch(field)}
      onChange={(e) => onChange(field, field === 'postal_code' ? normalizePostalCode(e.target.value) : e.target.value)}
    />
  );

  return (
    <div className="form-grid address-fields">
      {FIELDS.map(({ field, label, icon, required, hint }) => text(field, label, icon, { required, hint }))}
      <div className={`field ${errors.country_code ? 'field--error' : ''}`}>
        <FieldLabel htmlFor={countryId} label="País" required />
        <Select
          id={countryId}
          className="select--block"
          value={values.country_code}
          options={countryOptions}
          placeholder="Elige el país"
          searchable={{ placeholder: 'Buscar país', empty: 'Ningún país coincide' }}
          disabled={disabled}
          onChange={(code) => {
            onChange('country_code', code);
            onTouch('country_code');
          }}
        />
        <FieldMessage id={countryId} error={errors.country_code} />
      </div>
      {REGION_FIELDS.map(({ field, label, icon }) => text(field, label, icon))}
    </div>
  );
}
