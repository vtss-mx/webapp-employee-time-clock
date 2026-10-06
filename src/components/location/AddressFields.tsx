import { Building2, DoorOpen, Globe, Hash, House, Landmark, Mailbox, MapPinned, Signpost } from 'lucide-react';
import { useId, useMemo, type ReactNode } from 'react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useT } from '../../i18n';
import { ADDRESS_MAX, normalizePostalCode, type AddressValues } from '../../utils/address';
import { flagOf } from '../../utils/phone';
import { describedBy, FieldLabel, FieldMessage, FormField, TextAreaField } from '../FormField';
import { Select, type SelectOption } from '../ui/Select';

interface AddressFieldsProps {
  values: AddressValues;
  errors: Partial<Record<keyof AddressValues, string>>;
  onChange: (field: keyof AddressValues, value: string) => void;
  onTouch: (field: keyof AddressValues) => void;
  disabled?: boolean;
}

type TextField = Exclude<keyof AddressValues, 'country_code' | 'reference_notes'>;

/** Llave de la etiqueta y la ayuda de cada campo de texto (`location.address.<copy>`; textos del dueño del producto). */
type FieldCopy = 'state' | 'municipality' | 'city' | 'neighborhood' | 'postalCode' | 'street' | 'exteriorNumber' | 'interiorNumber';

/** Campos de texto en el orden en que se piden (después del país y antes de las referencias). */
const TEXT_FIELDS: Array<{ field: TextField; copy: FieldCopy; icon: ReactNode; required: boolean }> = [
  { field: 'state', copy: 'state', icon: <Landmark size={18} />, required: true },
  { field: 'municipality', copy: 'municipality', icon: <MapPinned size={18} />, required: true },
  { field: 'city', copy: 'city', icon: <Building2 size={18} />, required: true },
  { field: 'neighborhood', copy: 'neighborhood', icon: <House size={18} />, required: true },
  { field: 'postal_code', copy: 'postalCode', icon: <Mailbox size={18} />, required: true },
  { field: 'street', copy: 'street', icon: <Signpost size={18} />, required: true },
  { field: 'exterior_number', copy: 'exteriorNumber', icon: <Hash size={18} />, required: true },
  { field: 'interior_number', copy: 'interiorNumber', icon: <DoorOpen size={18} />, required: false },
];

/** Países activos del catálogo (los destacados primero) con su bandera, para la lista con búsqueda. */
export function useCountryOptions(): Array<SelectOption> {
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
 * Domicilio, en el orden y con los textos que pidió el dueño del producto: país (lista con búsqueda
 * del catálogo), estado o provincia, municipio o alcaldía, ciudad o localidad, colonia o barrio,
 * código postal, calle o vialidad, número exterior, número interior y referencias (varios renglones,
 * con contador). El mapa (LocationPicker) los llena cuando puede; las referencias, nunca.
 */
export function AddressFields({ values, errors, onChange, onTouch, disabled = false }: AddressFieldsProps) {
  const t = useT();
  const countryHint = t('location.address.country.hint');
  const countryOptions = useCountryOptions();
  const countryId = useId();

  return (
    <div className="form-grid address-fields">
      <div className={`field ${errors.country_code ? 'field--error' : ''}`}>
        <FieldLabel htmlFor={countryId} label={t('location.address.country.label')} required />
        <Select
          id={countryId}
          className="select--block"
          icon={<Globe size={18} />}
          value={values.country_code}
          options={countryOptions}
          placeholder={t('location.address.country.placeholder')}
          searchable={{ placeholder: t('location.address.country.search'), empty: t('location.address.country.empty') }}
          disabled={disabled}
          aria-describedby={describedBy(countryId, errors.country_code, countryHint)}
          onChange={(code) => {
            onChange('country_code', code);
            onTouch('country_code');
          }}
        />
        <FieldMessage id={countryId} error={errors.country_code} hint={countryHint} />
      </div>
      {TEXT_FIELDS.map(({ field, copy, icon, required }) => (
        <FormField
          key={field}
          label={t(`location.address.${copy}.label`)}
          icon={icon}
          required={required}
          hint={t(`location.address.${copy}.hint`)}
          maxLength={ADDRESS_MAX[field]}
          autoComplete="off"
          inputMode={field === 'postal_code' && values.country_code === 'MX' ? 'numeric' : undefined}
          disabled={disabled}
          value={values[field]}
          error={errors[field]}
          onBlur={() => onTouch(field)}
          onChange={(e) => onChange(field, field === 'postal_code' ? normalizePostalCode(e.target.value) : e.target.value)}
        />
      ))}
      <TextAreaField
        className="address-fields__wide"
        label={t('location.address.referenceNotes.label')}
        hint={t('location.address.referenceNotes.hint')}
        rows={3}
        maxLength={ADDRESS_MAX.reference_notes}
        counter
        autoComplete="off"
        placeholder={t('location.address.referenceNotes.placeholder')}
        disabled={disabled}
        value={values.reference_notes}
        error={errors.reference_notes}
        onBlur={() => onTouch('reference_notes')}
        onChange={(value) => onChange('reference_notes', value)}
      />
    </div>
  );
}
