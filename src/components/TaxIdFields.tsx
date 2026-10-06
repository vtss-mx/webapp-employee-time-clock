import { FileBadge, Globe, IdCard } from 'lucide-react';
import { useId, useMemo } from 'react';
import { liveFeedback } from '../hooks/useAvailability';
import { useCatalogs } from '../hooks/useCatalogs';
import { useT } from '../i18n';
import type { AvailabilityState, CompanyFormValues } from '../types';
import { mainTaxIdType, normalizeTaxId, taxIdHint, taxIdTypesFor } from '../utils/taxId';
import type { FieldErrors } from '../utils/validation';
import { describedBy, FieldLabel, FieldMessage, FormField } from './FormField';
import { useCountryOptions } from './location/AddressFields';
import { Select } from './ui/Select';

type TaxIdValues = Pick<CompanyFormValues, 'tax_country' | 'tax_id_type' | 'tax_id'>;

interface TaxIdFieldsProps {
  values: TaxIdValues;
  errors: FieldErrors<TaxIdValues>;
  /** Validación en vivo del número (formato de su tipo, dígito verificador y si otra empresa ya lo tiene). */
  live?: AvailabilityState;
  onChange: (changes: Partial<TaxIdValues>) => void;
  onTouch: (field: 'tax_id') => void;
  disabled?: boolean;
}

/**
 * Identificador fiscal de una empresa de cualquier país (decisión del dueño del producto, 2026-10-06): país fiscal
 * (lista con búsqueda de los países del catálogo), tipo de identificador (los del país y «Otro», del catálogo
 * `tax_id_types`) y número, con su formato y un ejemplo en la ayuda. Todo opcional: sin número, el país y el tipo no
 * se guardan. Al cambiar de país se propone su tipo principal; el número se conserva (si no cumple, se avisa).
 */
export function TaxIdFields({ values, errors, live, onChange, onTouch, disabled }: TaxIdFieldsProps) {
  const t = useT();
  const { tax_id_types: types, byCode } = useCatalogs();
  const countryOptions = useCountryOptions();
  const typeOptions = useMemo(
    () => taxIdTypesFor(types, values.tax_country).map((item) => ({ value: item.code, label: item.short_name, description: item.name })),
    [types, values.tax_country],
  );
  const type = byCode('tax_id_types', values.tax_id_type);
  const feedback = liveFeedback(live);
  const countryId = useId();
  const typeId = useId();
  const countryHint = t('admin.form.taxId.countryHint');
  const typeHint = type?.name;

  return (
    <>
      <div className={`field ${errors.tax_country ? 'field--error' : ''}`}>
        <FieldLabel htmlFor={countryId} label={t('admin.form.taxId.country')} />
        <Select
          id={countryId}
          className="select--block"
          icon={<Globe size={18} />}
          value={values.tax_country}
          options={countryOptions}
          searchable={{ placeholder: t('location.address.country.search'), empty: t('location.address.country.empty') }}
          disabled={disabled}
          aria-describedby={describedBy(countryId, errors.tax_country, countryHint)}
          onChange={(country) => onChange({ tax_country: country, tax_id_type: mainTaxIdType(types, country) })}
        />
        <FieldMessage id={countryId} error={errors.tax_country} hint={countryHint} />
      </div>
      <div className={`field ${errors.tax_id_type ? 'field--error' : ''}`}>
        <FieldLabel htmlFor={typeId} label={t('admin.form.taxId.type')} />
        <Select
          id={typeId}
          className="select--block"
          icon={<FileBadge size={18} />}
          value={values.tax_id_type}
          options={typeOptions}
          disabled={disabled}
          aria-describedby={describedBy(typeId, errors.tax_id_type, typeHint)}
          onChange={(code) => onChange({ tax_id_type: code })}
        />
        <FieldMessage id={typeId} error={errors.tax_id_type} hint={typeHint} />
      </div>
      <FormField
        label={t('admin.form.taxId.number')}
        name="tax_id"
        icon={<IdCard size={18} />}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={type?.example}
        hint={taxIdHint(type)}
        value={values.tax_id}
        error={errors.tax_id ?? feedback.error}
        status={feedback.status}
        disabled={disabled}
        onBlur={() => onTouch('tax_id')}
        onChange={(e) => onChange({ tax_id: normalizeTaxId(e.target.value, type) })}
      />
    </>
  );
}
