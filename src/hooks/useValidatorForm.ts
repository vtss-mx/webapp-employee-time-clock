import { useLayoutEffect, useRef, useState } from 'react';
import { resolveLazy, t } from '../i18n';
import { fieldErrorsFrom } from '../services/apiClient';
import { validatorService } from '../services/validatorService';
import type { Address, Validator, ValidatorMode, ValidatorSettings } from '../types';
import type { ConfirmSource } from '../types/confirm';
import { ADDRESS_FIELDS, addressForPoint, addressPayload, pickAddress, validateAddress, type AddressValues, type GeoPoint } from '../utils/address';
import { formatNumber } from '../utils/numbers';
import { validateEmail, validatePassword, validatePasswordConfirm, type FieldErrors } from '../utils/validation';
import { liveFeedback, useAvailability } from './useAvailability';
import { useCatalogs } from './useCatalogs';
import { useFormState } from './useFormState';

export const VALIDATOR_NAME_MAX = 120;
/** Radio permitido (m): los mismos límites que el backend. */
export const RADIUS_MIN_M = 10;
export const RADIUS_MAX_M = 10_000;
export const DEFAULT_RADIUS_M = 100;

export type ValidatorFormValues = AddressValues & {
  name: string;
  email: string;
  password: string;
  /** La contraseña repetida (solo en el cliente). */
  confirm: string;
  /** Radio permitido en metros (texto del campo). */
  radius: string;
};

/** Un radio en metros exactos, como se captura ("1,500 m"; sin pasar a km), en el idioma activo. */
export const radiusText = (meters: number) => t('validators.meters', { meters: formatNumber(meters) });

/** Los límites del radio con separadores del idioma activo (para avisos y ayudas). */
export const radiusLimits = () => ({ min: formatNumber(RADIUS_MIN_M), max: formatNumber(RADIUS_MAX_M) });

export function validateValidatorName(value: string): string | undefined {
  const name = value.trim();
  if (name.length < 2) return t('validators.form.errors.name');
  return name.length > VALIDATOR_NAME_MAX ? t('validators.form.errors.nameTooLong', { max: VALIDATOR_NAME_MAX }) : undefined;
}

export function validateRadius(value: string): string | undefined {
  const text = value.trim();
  if (!text) return t('validators.form.errors.radiusRequired');
  const meters = Number(text);
  if (!Number.isInteger(meters)) return t('validators.form.errors.radiusInteger');
  if (meters < RADIUS_MIN_M || meters > RADIUS_MAX_M) return t('validators.form.errors.radiusRange', radiusLimits());
  return undefined;
}

/** Títulos del popup si no se pudo guardar (se arman al dibujarse: siguen al idioma activo). */
const addError = () => t('validators.form.addError');
const saveError = () => t('validators.form.saveError');
const pointMissing = () => t('validators.form.errors.point');

/** Nombre en el formulario de los campos del backend (`address.street` → `street`) y de sus errores de negocio. */
const ERROR_FIELDS: Partial<Record<string, keyof ValidatorFormValues>> = {
  ...Object.fromEntries(ADDRESS_FIELDS.map((field) => [`address.${field}`, field])),
  location_radius_m: 'radius',
  EMAIL_TAKEN: 'email',
  LOCATION_RADIUS_REQUIRED: 'radius',
};

/** Errores del backend en los campos del formulario. */
export const validatorServerErrors = (err: unknown): FieldErrors<ValidatorFormValues> => fieldErrorsFrom(err, ERROR_FIELDS);

function initialValues(original: Validator | null): ValidatorFormValues {
  return { ...pickAddress(original?.address), name: original?.name ?? '', email: '', password: '', confirm: '', radius: String(original?.location_radius_m ?? DEFAULT_RADIUS_M) };
}

const pointOf = (address: Address | null | undefined): GeoPoint | null =>
  address?.latitude != null && address.longitude != null ? { lat: address.latitude, lng: address.longitude } : null;

/** Lo que se guarda: domicilio (con su punto), modo y ubicación exigida. */
export function settingsFrom(values: ValidatorFormValues, mode: ValidatorMode, point: GeoPoint | null, locationRequired: boolean): ValidatorSettings {
  return {
    name: values.name.trim(),
    mode,
    address: addressPayload(values, point),
    location_required: locationRequired,
    location_radius_m: values.radius.trim() && !validateRadius(values.radius) ? Number(values.radius) : null,
  };
}

/** Lo que se guardaría del validador tal como se abrió: la base de "antes → después" al editar. */
export const settingsOf = (original: Validator): ValidatorSettings =>
  settingsFrom(initialValues(original), original.mode, pointOf(original.address), original.location_required);

/**
 * Estado del alta o la edición de un validador: cuenta (solo en el alta), modo, domicilio, punto
 * en el mapa y "requiere ubicación" con su radio. Valida en el cliente (solo UX), verifica el
 * correo en vivo y guarda; los errores del servidor vuelven a sus campos.
 */
export function useValidatorForm(original: Validator | null) {
  const creating = original === null;
  const [firstMode] = useCatalogs().active('validator_modes');
  const form = useFormState<ValidatorFormValues>(initialValues(original), { serverErrors: validatorServerErrors });
  const [mode, setMode] = useState<ValidatorMode>(original?.mode ?? firstMode.code);
  const [point, setPoint] = useState<GeoPoint | null>(pointOf(original?.address));
  const [locationRequired, setLocationRequired] = useState(original?.location_required ?? false);
  const [submitted, setSubmitted] = useState(false);
  const { values } = form;
  // El domicilio del mapa llega después de una consulta: se aplica sobre lo escrito hasta entonces.
  const latest = useRef(values);
  useLayoutEffect(() => {
    latest.current = values;
  });

  // Correo de acceso: único en la plataforma, verificado en vivo por el canal del backend.
  const live = liveFeedback(useAvailability('validator_email', values.email, { enabled: creating && !validateEmail(values.email) }));
  // Como función: el resumen de "Revisa la información" abierto sigue al idioma activo.
  const validate = (): FieldErrors<ValidatorFormValues> => ({
    ...validateAddress(values),
    name: validateValidatorName(values.name),
    email: creating ? (validateEmail(values.email) ?? live.error) : undefined,
    password: creating ? validatePassword(values.password) : undefined,
    confirm: creating ? validatePasswordConfirm(values.password, values.confirm) : undefined,
    radius: locationRequired || values.radius.trim() ? validateRadius(values.radius) : undefined,
  });
  const clientErrors = validate();
  const pointError = locationRequired && !point ? pointMissing() : undefined;
  const invalid = Object.values(clientErrors).some(Boolean) || Boolean(pointError);

  const set = (field: keyof ValidatorFormValues, value: string) => form.setValues({ ...values, [field]: value });
  /** Domicilio que Google encontró para el punto: reemplaza al escrito (y se valida de inmediato). */
  const applyAddress = (found: Partial<AddressValues>) => {
    form.setValues({ ...latest.current, ...addressForPoint(latest.current, found) });
    ADDRESS_FIELDS.forEach((f) => form.touch(f));
  };

  /**
   * Guarda tras confirmar: `confirm` arma la pregunta con lo que se enviará (cancelar no envía nada).
   * Se vuelve a pedir en cada dibujo del popup: con `t('…')` adentro, la confirmación abierta sigue
   * al idioma activo.
   */
  const save = (onSaved: (saved: Validator) => void, confirm: (settings: ValidatorSettings) => ConfirmSource) => {
    form.touchAll();
    setSubmitted(true);
    if (invalid) {
      void form.feedback.invalidForm(() => ({ ...validate(), point: locationRequired && !point ? pointMissing() : undefined }));
      return Promise.resolve();
    }
    const settings = settingsFrom(values, mode, point, locationRequired);
    return form.save(async () => {
      const saved = original
        ? await validatorService.update(original.id, settings)
        : await validatorService.create({ ...settings, email: values.email, password: values.password });
      onSaved(saved);
    }, creating ? addError : saveError, () => resolveLazy(confirm(settings)));
  };

  return {
    creating,
    values,
    set,
    touch: form.touch,
    errors: form.visibleErrors(clientErrors),
    emailStatus: live.status,
    mode,
    setMode,
    point,
    setPoint,
    pointError: submitted ? pointError : undefined,
    locationRequired,
    setLocationRequired,
    applyAddress,
    saving: form.saving,
    checking: live.status?.tone === 'checking',
    save,
  };
}
