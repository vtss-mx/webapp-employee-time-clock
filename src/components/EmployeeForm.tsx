import { FileBadge, Hash, HeartPulse, IdCard, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { liveFeedback } from '../hooks/useAvailability';
import { useT } from '../i18n';
import type { EmployeeFormValues, LiveChecks } from '../types';
import { OPTIONAL_FIELDS } from '../utils/formRules';
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
import { Checkbox } from './ui/Checkbox';
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
  const t = useT();
  const sharedAccountHint = t('employees.fields.sharedAccount');
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
      // Opcionales: número, RFC, CURP y NSS siempre; la contraseña al editar (vacía = no cambiarla).
      required: !(OPTIONAL_FIELDS as readonly Field[]).includes(name) && (!isEdit || (name !== 'password' && name !== 'password_confirm')),
      onBlur: () => onTouch?.(name),
      onChange: (e: ChangeEvent<HTMLInputElement>) =>
        onChange({ ...values, [name]: normalize ? normalize(e.target.value) : e.target.value }),
    };
  };

  return (
    <div className="form-grid">
      <FormField label={t('employees.fields.firstName')} icon={<UserRound size={18} />} autoComplete="given-name" maxLength={100} {...bind('first_name')} />
      <FormField label={t('employees.fields.lastName')} icon={<UserRound size={18} />} autoComplete="family-name" maxLength={100} {...bind('last_name')} />
      <DateField
        label={t('employees.fields.birthDate')}
        name="birth_date"
        value={values.birth_date}
        error={errors.birth_date}
        disabled={disabled}
        min="1920-01-01"
        max={maxBirthDate()}
        openTo={`${new Date().getFullYear() - 30}-01-01`}
        hint={t('employees.fields.minAge', { age: MIN_EMPLOYEE_AGE })}
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
        hint={t('employees.fields.curpHint')}
        {...bind('curp')}
      />
      <FormField
        label="RFC"
        icon={<IdCard size={18} />}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="PEGJ900515AB1"
        hint={t('employees.fields.rfcHint')}
        {...bind('rfc')}
      />
      <FormField
        label={t('employees.fields.nss')}
        icon={<HeartPulse size={18} />}
        autoComplete="off"
        inputMode="numeric"
        placeholder={t('employees.fields.nssPlaceholder')}
        hint={t('employees.fields.nssHint')}
        {...bind('nss')}
      />
      <FormField
        label={t('employees.fields.employeeNumber')}
        icon={<Hash size={18} />}
        maxLength={30}
        autoCapitalize="characters"
        hint={t('employees.fields.employeeNumberHint')}
        {...bind('employee_number')}
      />
      <PhoneField
        label={t('common.fields.mobilePhone')}
        name="phone"
        value={values.phone}
        onChange={(phone) => onChange({ ...values, phone })}
        onBlur={() => onTouch?.('phone')}
        error={errors.phone ?? phoneLive.error}
        status={phoneLive.status}
        disabled={disabled || accountLocked}
        required
        hint={accountLocked ? sharedAccountHint : t('employees.fields.phoneHint')}
      />
      <FormField
        label={t('common.fields.email')}
        icon={<Mail size={18} />}
        type="email"
        autoComplete="off"
        inputMode="email"
        {...bind('email')}
        {...(accountLocked ? { disabled: true, hint: sharedAccountHint } : {})}
      />
      {/* Persona de otra empresa: entra con su misma contraseña. Cuenta compartida: solo ella la cambia. */}
      {!linking && !accountLocked && (
        <FormField
          label={t(isEdit ? 'employees.fields.newPassword' : 'employees.fields.password')}
          icon={<KeyRound size={18} />}
          type="password"
          autoComplete="new-password"
          hint={t(isEdit ? 'employees.fields.keepPassword' : 'employees.fields.passwordHint')}
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
  const t = useT();
  return (
    <Checkbox
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      icon={<ShieldCheck size={16} />}
      label={t('employees.fields.headwear')}
      description={t('employees.fields.headwearHint')}
    />
  );
}
