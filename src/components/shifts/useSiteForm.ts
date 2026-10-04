import { useLayoutEffect, useRef, useState } from 'react';
import { useFormState } from '../../hooks/useFormState';
import { DEFAULT_RADIUS_M, validateRadius } from '../../hooks/useValidatorForm';
import { fieldErrorsFrom } from '../../services/apiClient';
import { siteService } from '../../services/siteService';
import type { WorkSite, WorkSitePayload } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { ADDRESS_FIELDS, addressForPoint, addressLine, formatPoint, pickAddress, validateAddress, type AddressValues, type GeoPoint } from '../../utils/address';
import { describeChanges, describeValues, type FieldLabels } from '../../utils/changes';
import { metersText, SITE_NAME_MAX, validateName } from './shiftRules';

export type SiteFormValues = AddressValues & {
  name: string;
  /** Radio de la geocerca en metros (texto del campo). */
  radius: string;
};

/** Campos del backend (`address.street` → `street`, `radius_m` → `radius`) y errores de negocio con campo. */
const RENAME: Partial<Record<string, keyof SiteFormValues>> = {
  ...Object.fromEntries(ADDRESS_FIELDS.map((field) => [`address.${field}`, field])),
  radius_m: 'radius',
  SITE_NAME_TAKEN: 'name',
};

const serverErrors = (err: unknown) => fieldErrorsFrom<SiteFormValues>(err, RENAME);

/** Lo que se guarda: nombre, domicilio con su punto y radio. */
export function sitePayload(values: SiteFormValues, point: GeoPoint): WorkSitePayload {
  const address = pickAddress(values, { trim: true });
  return {
    name: values.name.trim(),
    address: { ...address, interior_number: address.interior_number || null, latitude: point.lat, longitude: point.lng },
    radius_m: Number(values.radius),
  };
}

/** Lo que se confirma de un sitio: su nombre, su domicilio, su punto en el mapa y el radio. */
interface SiteFacts {
  name: string;
  address: string;
  point: string;
  radius: number;
}

const SITE_LABELS: FieldLabels<SiteFacts> = { name: 'Nombre', address: 'Domicilio', point: 'Punto en el mapa', radius: { label: 'Radio para checar', format: metersText } };

const siteFacts = ({ name, address, radius_m }: WorkSitePayload): SiteFacts => ({
  name,
  address: addressLine(address),
  // El punto siempre existe al guardar (es obligatorio) y el backend lo devuelve con el sitio.
  point: formatPoint({ lat: Number(address.latitude), lng: Number(address.longitude) }),
  radius: radius_m,
});

/** Crear: lo que se registra. Editar: solo lo que cambia ("antes → después"). */
export function siteConfirm(original: WorkSite | null, payload: WorkSitePayload): ConfirmInput {
  if (!original) {
    return {
      kind: 'create',
      title: `¿Crear el sitio ${payload.name}?`,
      message: 'Tu personal podrá checar aquí y elegirlo en las asignaciones de turno.',
      detailsTitle: 'Se creará',
      details: describeValues(siteFacts(payload), SITE_LABELS),
      confirmLabel: 'Crear sitio',
    };
  }
  return {
    kind: 'edit',
    title: `¿Guardar los cambios del sitio ${original.name}?`,
    changes: describeChanges(siteFacts(original), siteFacts(payload), SITE_LABELS),
  };
}

/**
 * Estado del alta o la edición de un sitio de trabajo: nombre, radio de la geocerca, domicilio y su
 * punto en el mapa (obligatorio: checar en sitio se mide desde ahí). Valida en el cliente (solo UX)
 * y los errores del servidor vuelven a sus campos.
 */
export function useSiteForm(original: WorkSite | null) {
  const form = useFormState<SiteFormValues>(
    { ...pickAddress(original?.address), name: original?.name ?? '', radius: String(original?.radius_m ?? DEFAULT_RADIUS_M) },
    { serverErrors },
  );
  const saved = original?.address;
  const [point, setPoint] = useState<GeoPoint | null>(saved?.latitude != null && saved.longitude != null ? { lat: saved.latitude, lng: saved.longitude } : null);
  const [submitted, setSubmitted] = useState(false);
  const { values } = form;
  // El domicilio que Google encuentra llega después de una consulta: se aplica sobre lo escrito hasta entonces.
  const current = useRef(values);
  useLayoutEffect(() => {
    current.current = values;
  });

  const clientErrors = { ...validateAddress(values), name: validateName(values.name, SITE_NAME_MAX, 'Planta Hermosillo'), radius: validateRadius(values.radius) };
  const pointError = point ? undefined : 'Marca en el mapa el punto del sitio: desde ahí se mide el radio para checar';

  const save = (onSaved: (site: WorkSite) => void): Promise<void> => {
    form.touchAll();
    setSubmitted(true);
    if (!point || Object.values(clientErrors).some(Boolean)) {
      void form.feedback.invalidForm({ ...clientErrors, point: pointError });
      return Promise.resolve();
    }
    const payload = sitePayload(values, point);
    return form.save(
      async () => {
        onSaved(original ? await siteService.update(original.id, payload) : await siteService.create(payload));
      },
      original ? 'No se pudo guardar el sitio' : 'No se pudo crear el sitio',
      siteConfirm(original, payload),
    );
  };

  return {
    values,
    set: (field: keyof SiteFormValues, value: string) => form.setValues({ ...values, [field]: value }),
    touch: form.touch,
    errors: form.visibleErrors(clientErrors),
    point,
    setPoint,
    pointError: submitted ? pointError : undefined,
    /** Domicilio que Google encontró para el punto: reemplaza al escrito (y se valida de inmediato). */
    applyAddress: (found: Partial<AddressValues>) => {
      form.setValues({ ...current.current, ...addressForPoint(current.current, found) });
      for (const field of ADDRESS_FIELDS) form.touch(field);
    },
    /** Radio válido para dibujarlo en el mapa (mientras se escribe uno inválido, sin círculo). */
    radius: validateRadius(values.radius) ? null : Number(values.radius),
    saving: form.saving,
    save,
  };
}

export type SiteForm = ReturnType<typeof useSiteForm>;
