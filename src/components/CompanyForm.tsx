import { Building2, IdCard, KeyRound, Landmark, UserCog, Users } from 'lucide-react';
import type { ChangeEvent } from 'react';
import type { AvailabilityState } from '../hooks/useAvailability';
import type { CompanyFormValues } from '../types';
import { normalizeRfc, type FieldErrors } from '../utils/validation';
import { ConfirmPasswordField, FormField, liveFeedback } from './FormField';
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
}

/** Normalización mientras se escribe (RFC en mayúsculas, solo dígitos en teléfono y límite). */
const NORMALIZE: Partial<Record<Field, (value: string) => string>> = {
  rfc: (v) => normalizeRfc(v).slice(0, 13),
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

/** Datos fiscales y de contacto de la empresa. */
export function CompanyDataFields(props: CompanyFieldsProps) {
  const bind = makeBinder(props);
  return (
    <div className="form-grid">
      <FormField label="Nombre comercial" icon={<Building2 size={18} />} maxLength={200} autoComplete="organization" {...bind('name')} />
      <FormField label="Razón social" icon={<Landmark size={18} />} maxLength={200} autoComplete="off" hint="Como aparece en la constancia fiscal" {...bind('legal_name')} />
      <FormField
        label="RFC de la empresa"
        icon={<IdCard size={18} />}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="PNO120315AB1"
        hint="12 caracteres (persona moral) o 13 (persona física)"
        {...bind('rfc')}
      />
      <PhoneField
        label="Teléfono"
        name="phone"
        value={props.values.phone}
        onChange={(phone) => props.onChange({ ...props.values, phone })}
        onBlur={() => props.onTouch('phone')}
        error={props.errors.phone ?? liveFeedback(props.live.phone).error}
        status={liveFeedback(props.live.phone).status}
        disabled={props.disabled}
        required
        hint="Elige el país y escribe el número"
      />
      <FormField
        label="Límite de empleados"
        icon={<Users size={18} />}
        inputMode="numeric"
        autoComplete="off"
        placeholder="Sin límite"
        hint="Opcional: máximo de empleados que la empresa puede registrar"
        {...bind('max_employees', false)}
      />
    </div>
  );
}

/** Acceso del administrador de la empresa (correo con el que inicia sesión y contraseña inicial). */
export function CompanyAdminFields(props: CompanyFieldsProps) {
  const bind = makeBinder(props);
  return (
    <div className="form-grid">
      <FormField
        label="Correo del administrador"
        icon={<UserCog size={18} />}
        type="email"
        inputMode="email"
        autoComplete="off"
        hint="Con este correo iniciará sesión; es también el correo de la empresa"
        {...bind('admin_email')}
      />
      <FormField
        label="Contraseña inicial"
        icon={<KeyRound size={18} />}
        type="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, con mayúscula, minúscula y número"
        {...bind('admin_password')}
      />
      <ConfirmPasswordField {...bind('admin_password_confirm')} />
    </div>
  );
}
