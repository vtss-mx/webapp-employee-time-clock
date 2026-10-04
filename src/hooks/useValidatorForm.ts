import { useLayoutEffect, useRef, useState } from 'react';
import { fieldErrorsFrom } from '../services/apiClient';
import { validatorService } from '../services/validatorService';
import type { Address, Validator, ValidatorMode, ValidatorSettings } from '../types';
import { ADDRESS_FIELDS, addressForPoint, pickAddress, validateAddress, type AddressValues, type GeoPoint } from '../utils/address';
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

export function validateValidatorName(value: string): string | undefined {
  const name = value.trim();
  if (name.length < 2) return 'Escribe un nombre o ubicación (p. ej. "Recepción planta 1")';
  return name.length > VALIDATOR_NAME_MAX ? `Máximo ${VALIDATOR_NAME_MAX} caracteres` : undefined;
}

export function validateRadius(value: string): string | undefined {
  const text = value.trim();
  if (!text) return 'Indica el radio en metros';
  const meters = Number(text);
  if (!Number.isInteger(meters)) return 'Escribe metros enteros';
  if (meters < RADIUS_MIN_M || meters > RADIUS_MAX_M) return `Entre ${RADIUS_MIN_M} y ${RADIUS_MAX_M.toLocaleString('es-MX')} m`;
  return undefined;
}

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
  const address = pickAddress(values, { trim: true });
  return {
    name: values.name.trim(),
    mode,
    address: { ...address, interior_number: address.interior_number || null, latitude: point?.lat ?? null, longitude: point?.lng ?? null },
    location_required: locationRequired,
    location_radius_m: values.radius.trim() && !validateRadius(values.radius) ? Number(values.radius) : null,
  };
}

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
  const clientErrors: FieldErrors<ValidatorFormValues> = {
    ...validateAddress(values),
    name: validateValidatorName(values.name),
    email: creating ? (validateEmail(values.email) ?? live.error) : undefined,
    password: creating ? validatePassword(values.password) : undefined,
    confirm: creating ? validatePasswordConfirm(values.password, values.confirm) : undefined,
    radius: locationRequired || values.radius.trim() ? validateRadius(values.radius) : undefined,
  };
  const pointError = locationRequired && !point ? 'Marca en el mapa el punto del acceso para exigir ubicación' : undefined;
  const invalid = Object.values(clientErrors).some(Boolean) || Boolean(pointError);

  const set = (field: keyof ValidatorFormValues, value: string) => form.setValues({ ...values, [field]: value });
  /** Domicilio que Google encontró para el punto: reemplaza al escrito (y se valida de inmediato). */
  const applyAddress = (found: Partial<AddressValues>) => {
    form.setValues({ ...latest.current, ...addressForPoint(latest.current, found) });
    ADDRESS_FIELDS.forEach((f) => form.touch(f));
  };

  const save = (onSaved: (saved: Validator) => void) => {
    form.touchAll();
    setSubmitted(true);
    if (invalid) {
      void form.feedback.invalidForm({ ...clientErrors, point: pointError });
      return Promise.resolve();
    }
    const settings = settingsFrom(values, mode, point, locationRequired);
    return form.save(async () => {
      const saved = original
        ? await validatorService.update(original.id, settings)
        : await validatorService.create({ ...settings, email: values.email, password: values.password });
      onSaved(saved);
    }, creating ? 'No se pudo agregar el validador' : 'No se pudo guardar el validador');
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
