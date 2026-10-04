import { Check, FileBadge, Hash, HeartPulse, IdCard, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { liveFeedback } from '../hooks/useAvailability';
import type { EmployeeFormValues, LiveChecks } from '../types';
import {
  CURP_LENGTH,
  MIN_EMPLOYEE_AGE,
  maxBirthDate,
  normalizeCurp,
  normalizeRfc,
  NSS_LENGTH,
  RFC_LENGTH,
  type FieldErrors,
} from '../utils/validation';
import { ConfirmPasswordField, FormField } from './FormField';
import { DateField } from './ui/DateField';
import { PhoneField } from './ui/PhoneField';

type Field = keyof EmployeeFormValues;

interface EmployeeFormFieldsProps {
  values: EmployeeFormValues;
  errors: FieldErrors<EmployeeFormValues>;
  onChange: (values: EmployeeFormValues) => void;
  /** El usuario salió del campo: a partir de ahí se muestra su error. */
  onTouch?: (field: Field) => void;
  disabled?: boolean;
  /** En edición la contraseña es opcional. */
  isEdit?: boolean;
  /** Validación en tiempo real de los datos únicos (número de empleado, RFC, CURP, NSS, correo, teléfono). */
  live?: Partial<LiveChecks>;
  /** Alta de una persona que ya trabaja en otra empresa: conserva su contraseña (no se pide). */
  linking?: boolean;
  /** Cuenta compartida con otra empresa: correo, teléfono y contraseña solo los cambia la persona. */
  accountLocked?: boolean;
}

const SHARED_ACCOUNT_HINT = 'Cuenta compartida con otra empresa: solo la persona puede cambiarlo';

/** Cómo se escribe cada campo: se normaliza mientras se teclea (mayúsculas, solo dígitos...). */
const NORMALIZE: Partial<Record<Field, (value: string) => string>> = {
  rfc: (v) => normalizeRfc(v).slice(0, RFC_LENGTH),
  curp: (v) => normalizeCurp(v).slice(0, CURP_LENGTH),
  nss: (v) => v.replace(/\D/g, '').slice(0, NSS_LENGTH),
};

/**
 * Campos del empleado. Sin `maxLength` en RFC/CURP/NSS/teléfono: al pegar "PEGJ-900515-AB1" el
 * navegador cortaría antes de quitar los guiones; la longitud se limita al normalizar.
 * Las etiquetas evitan la palabra "Número": Chrome la toma como tarjeta de pago y en http://
 * muestra un aviso en rojo (ver autofillSafety.test.tsx).
 */
export function EmployeeFormFields({
  values,
  errors,
  onChange,
  onTouch,
  disabled,
  isEdit = false,
  live = {},
  linking = false,
  accountLocked = false,
}: EmployeeFormFieldsProps) {
  const phoneLive = liveFeedback(live.phone);
  const bind = (name: Field) => {
    const feedback = name in live ? liveFeedback(live[name as keyof LiveChecks]) : {};
    const normalize = NORMALIZE[name];
    return {
      name,
      value: values[name],
      error: errors[name] ?? feedback.error,
      status: feedback.status,
      disabled,
      required: (name !== 'password' && name !== 'password_confirm') || !isEdit,
      onBlur: () => onTouch?.(name),
      onChange: (e: ChangeEvent<HTMLInputElement>) =>
        onChange({ ...values, [name]: normalize ? normalize(e.target.value) : e.target.value }),
    };
  };

  return (
    <div className="form-grid">
      <FormField label="Nombres" icon={<UserRound size={18} />} autoComplete="given-name" maxLength={100} {...bind('first_name')} />
      <FormField label="Apellidos" icon={<UserRound size={18} />} autoComplete="family-name" maxLength={100} {...bind('last_name')} />
      <DateField
        label="Fecha de nacimiento"
        name="birth_date"
        value={values.birth_date}
        error={errors.birth_date}
        disabled={disabled}
        min="1920-01-01"
        max={maxBirthDate()}
        openTo={`${new Date().getFullYear() - 30}-01-01`}
        hint={`Edad mínima: ${MIN_EMPLOYEE_AGE} años`}
        required
        onChange={(birth_date) => {
          onChange({ ...values, birth_date });
          if (birth_date) onTouch?.('birth_date');
        }}
      />
      <FormField
        label="CURP"
        icon={<FileBadge size={18} />}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="HEGG560427MVZRRL04"
        hint="18 caracteres. Debe coincidir con la fecha de nacimiento"
        {...bind('curp')}
      />
      <FormField
        label="RFC"
        icon={<IdCard size={18} />}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="PEGJ900515AB1"
        hint="13 caracteres. Debe coincidir con la fecha de nacimiento"
        {...bind('rfc')}
      />
      <FormField
        label="No. de Seguridad Social (NSS)"
        icon={<HeartPulse size={18} />}
        autoComplete="off"
        inputMode="numeric"
        placeholder="11 dígitos del IMSS"
        hint="11 dígitos, como aparece en el IMSS"
        {...bind('nss')}
      />
      <FormField
        label="No. de empleado"
        icon={<Hash size={18} />}
        maxLength={30}
        autoCapitalize="characters"
        hint="Único. Letras, números, guion o guion bajo"
        {...bind('employee_number')}
      />
      <PhoneField
        label="Teléfono celular"
        name="phone"
        value={values.phone}
        onChange={(phone) => onChange({ ...values, phone })}
        onBlur={() => onTouch?.('phone')}
        error={errors.phone ?? phoneLive.error}
        status={phoneLive.status}
        disabled={disabled || accountLocked}
        required
        hint={accountLocked ? SHARED_ACCOUNT_HINT : 'Elige el país y escribe el número'}
      />
      <FormField
        label="Correo electrónico"
        icon={<Mail size={18} />}
        type="email"
        autoComplete="off"
        inputMode="email"
        {...bind('email')}
        {...(accountLocked ? { disabled: true, hint: SHARED_ACCOUNT_HINT } : {})}
      />
      {/* Persona de otra empresa: entra con su misma contraseña. Cuenta compartida: solo ella la cambia. */}
      {!linking && !accountLocked && (
        <FormField
          label={isEdit ? 'Nueva contraseña' : 'Contraseña'}
          icon={<KeyRound size={18} />}
          type="password"
          autoComplete="new-password"
          hint={isEdit ? 'Déjala vacía para no cambiarla' : 'Mínimo 8 caracteres, con mayúscula, minúscula y número'}
          {...bind('password')}
        />
      )}
      {!linking && !accountLocked && (isEdit ? values.password !== '' : true) && <ConfirmPasswordField {...bind('password_confirm')} />}
    </div>
  );
}

/** Excepción para prendas de cabeza por motivos religiosos o médicos (lentes y cubrebocas siempre se exigen). */
export function HeadwearExemptField({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`checkbox ${checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" className="checkbox__input" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="checkbox__box" aria-hidden>
        <Check size={16} strokeWidth={3} />
      </span>
      <span>
        <strong className="row" style={{ gap: 6 }}>
          <ShieldCheck size={16} color="var(--primary)" /> Excepción de prenda de cabeza
        </strong>
        <small className="muted">
          Permite verificar sin retirar prendas usadas por motivos religiosos o médicos. Lentes y cubrebocas se
          deben retirar siempre.
        </small>
      </span>
    </label>
  );
}
