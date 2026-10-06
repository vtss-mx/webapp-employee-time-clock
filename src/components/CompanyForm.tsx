import { Building2, KeyRound, Landmark, ScanLine, UserCog, Users } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { liveFeedback } from '../hooks/useAvailability';
import { useT } from '../i18n';
import type { AvailabilityState, CompanyFormValues } from '../types';
import type { FieldErrors } from '../utils/validation';
import { VALIDATORS_MAX } from '../utils/validatorLimit';
import { ConfirmPasswordField, FormField } from './FormField';
import { TaxIdFields } from './TaxIdFields';
import { NumberField } from './ui/NumberField';
import { PhoneField } from './ui/PhoneField';

type Field = keyof CompanyFormValues;

interface CompanyFieldsProps {
  values: CompanyFormValues;
  errors: FieldErrors<CompanyFormValues>;
  onChange: (values: CompanyFormValues) => void;
  onTouch: (field: Field) => void;
  /** Validación en vivo (canal del backend) de los campos que la tienen. */
  live: Partial<Record<Field, AvailabilityState>>;
  disabled?: boolean;
  /** Edición: validadores activos de la empresa (el límite no puede ser menor). */
  minValidators?: number;
}

/** Normalización mientras se escribe (solo dígitos en el límite; el identificador fiscal, en `TaxIdFields`). */
const NORMALIZE: Partial<Record<Field, (value: string) => string>> = {
  max_employees: (v) => v.replace(/\D/g, '').slice(0, 7),
};

function makeBinder({ values, errors, onChange, onTouch, live, disabled }: CompanyFieldsProps) {
  return (name: Field, required = true) => {
    const feedback = liveFeedback(live[name]);
    const normalize = NORMALIZE[name];
    return {
      name,
      value: values[name],
      error: errors[name] ?? feedback.error,
      status: feedback.status,
      disabled,
      required,
      onBlur: () => onTouch(name),
      onChange: (e: ChangeEvent<HTMLInputElement>) => onChange({ ...values, [name]: normalize ? normalize(e.target.value) : e.target.value }),
    };
  };
}

/** Datos fiscales (identificador de cualquier país: `TaxIdFields`) y de contacto de la empresa. */
export function CompanyDataFields(props: CompanyFieldsProps) {
  const t = useT();
  const bind = makeBinder(props);
  return (
    <div className="form-grid">
      <FormField label={t('admin.form.name')} icon={<Building2 size={18} />} maxLength={200} autoComplete="organization" {...bind('name')} />
      <FormField label={t('admin.form.legalName')} icon={<Landmark size={18} />} maxLength={200} autoComplete="off" hint={t('admin.form.legalNameHint')} {...bind('legal_name')} />
      <TaxIdFields
        values={props.values}
        errors={props.errors}
        live={props.live.tax_id}
        onChange={(changes) => props.onChange({ ...props.values, ...changes })}
        onTouch={props.onTouch}
        disabled={props.disabled}
      />
      <PhoneField
        label={t('common.fields.phone')}
        name="phone"
        value={props.values.phone}
        onChange={(phone) => props.onChange({ ...props.values, phone })}
        onBlur={() => props.onTouch('phone')}
        error={props.errors.phone ?? liveFeedback(props.live.phone).error}
        status={liveFeedback(props.live.phone).status}
        disabled={props.disabled}
        required
        hint={t('admin.form.phoneHint')}
      />
      <FormField
        label={t('admin.form.maxEmployees')}
        icon={<Users size={18} />}
        inputMode="numeric"
        autoComplete="off"
        placeholder={t('admin.form.noLimit')}
        hint={t('admin.form.maxEmployeesHint')}
        {...bind('max_employees', false)}
      />
      <ValidatorLimitField {...props} />
    </div>
  );
}

/**
 * Límite de validadores activos (lo decide el ADMIN): 0 apaga el módulo en la empresa. Al editar no baja de los que
 * ya tiene activos (el backend tampoco lo acepta) y la ayuda lo dice; cada validador activo se cobra como un empleado.
 */
function ValidatorLimitField({ values, errors, onChange, onTouch, disabled, minValidators = 0 }: CompanyFieldsProps) {
  const t = useT();
  return (
    <NumberField
      label={t('admin.form.maxValidators')}
      name="max_validators"
      icon={<ScanLine size={18} />}
      value={values.max_validators}
      onChange={(max_validators) => onChange({ ...values, max_validators })}
      onBlur={() => onTouch('max_validators')}
      min={minValidators}
      max={VALIDATORS_MAX}
      unit={t('admin.form.maxValidatorsUnit', { count: Number(values.max_validators) || 0 })}
      error={errors.max_validators}
      hint={minValidators > 0 ? t('admin.form.maxValidatorsMinHint', { count: minValidators }) : t('admin.form.maxValidatorsHint')}
      disabled={disabled}
      required
    />
  );
}

/** Acceso del administrador de la empresa (correo con el que inicia sesión y contraseña inicial). */
export function CompanyAdminFields(props: CompanyFieldsProps) {
  const t = useT();
  const bind = makeBinder(props);
  return (
    <div className="form-grid">
      <FormField
        label={t('admin.form.adminEmail')}
        icon={<UserCog size={18} />}
        type="email"
        inputMode="email"
        autoComplete="off"
        hint={t('admin.form.adminEmailHint')}
        {...bind('admin_email')}
      />
      <FormField
        label={t('admin.form.adminPassword')}
        icon={<KeyRound size={18} />}
        type="password"
        autoComplete="new-password"
        hint={t('admin.form.adminPasswordHint')}
        {...bind('admin_password')}
      />
      <ConfirmPasswordField {...bind('admin_password_confirm')} />
    </div>
  );
}
