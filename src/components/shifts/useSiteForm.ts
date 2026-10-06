import { useLayoutEffect, useRef, useState } from 'react';
import { useFormState } from '../../hooks/useFormState';
import { DEFAULT_RADIUS_M, validateRadius } from '../../hooks/useValidatorForm';
import { t } from '../../i18n';
import { fieldErrorsFrom } from '../../services/apiClient';
import { siteService } from '../../services/siteService';
import type { WorkSite, WorkSitePayload } from '../../types';
import type { ConfirmInput } from '../../types/confirm';
import { ADDRESS_FIELDS, addressForPoint, addressLine, addressPayload, formatPoint, pickAddress, validateAddress, type AddressValues, type GeoPoint } from '../../utils/address';
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

/** Lo que se guarda: nombre, domicilio con su punto, radio y si pide el código del kiosco (antifraude 2b). */
export function sitePayload(values: SiteFormValues, point: GeoPoint, presenceCode: boolean): WorkSitePayload {
  return { name: values.name.trim(), address: addressPayload(values, point), radius_m: Number(values.radius), presence_code: presenceCode };
}

/** Lo que se confirma de un sitio: su nombre, su domicilio, sus referencias, su punto en el mapa, el radio y el código. */
interface SiteFacts {
  name: string;
  address: string;
  references: string;
  point: string;
  radius: number;
  presenceCode: boolean;
}

/** Nombres de los datos del sitio en el idioma activo. */
const siteLabels = (): FieldLabels<SiteFacts> => ({
  name: t('common.fields.name'),
  address: t('sites.fields.address'),
  references: t('sites.fields.references'),
  point: t('sites.fields.point'),
  radius: { label: t('sites.fields.radius'), format: metersText },
  presenceCode: { label: t('sites.presence.label'), format: (on) => t(on ? 'sites.presence.on' : 'sites.presence.off') },
});

const siteFacts = ({ name, address, radius_m, presence_code }: WorkSitePayload): SiteFacts => ({
  name,
  address: addressLine(address),
  // Aparte de la línea del domicilio: cambiar solo las referencias también es un cambio que se confirma.
  references: address.reference_notes ?? '',
  // El punto siempre existe al guardar (es obligatorio) y el backend lo devuelve con el sitio.
  point: formatPoint({ lat: Number(address.latitude), lng: Number(address.longitude) }),
  radius: radius_m,
  presenceCode: presence_code,
});

/** Crear: lo que se registra. Editar: solo lo que cambia ("antes → después"). Se arma al dibujarse (en el idioma activo). */
export function siteConfirm(original: WorkSite | null, payload: WorkSitePayload): ConfirmInput {
  if (!original) {
    return {
      kind: 'create',
      title: t('sites.confirm.createTitle', { name: payload.name }),
      message: t('sites.confirm.createMessage'),
      detailsTitle: t('sites.confirm.willCreate'),
      details: describeValues(siteFacts(payload), siteLabels()),
      confirmLabel: t('sites.form.create'),
    };
  }
  return {
    kind: 'edit',
    title: t('sites.confirm.editTitle', { name: original.name }),
    changes: describeChanges(siteFacts(original), siteFacts(payload), siteLabels()),
  };
}

/** Errores de lo capturado (solo UX: el backend vuelve a validar todo), en el idioma activo. */
const siteErrors = (values: SiteFormValues) => ({ ...validateAddress(values), name: validateName(values.name, SITE_NAME_MAX, t('sites.form.nameExample')), radius: validateRadius(values.radius) });

const pointErrorOf = (point: GeoPoint | null) => (point ? undefined : t('sites.form.pointRequired'));

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
  const [presenceCode, setPresenceCode] = useState(original?.presence_code ?? false);
  const { values } = form;
  // El domicilio que Google encuentra llega después de una consulta: se aplica sobre lo escrito hasta entonces.
  const current = useRef(values);
  useLayoutEffect(() => {
    current.current = values;
  });

  const clientErrors = siteErrors(values);
  const pointError = pointErrorOf(point);

  const save = (onSaved: (site: WorkSite) => void): Promise<void> => {
    form.touchAll();
    setSubmitted(true);
    if (!point || Object.values(clientErrors).some(Boolean)) {
      // El resumen se vuelve a calcular al dibujarse: abierto, sigue al idioma activo.
      void form.feedback.invalidForm(() => ({ ...siteErrors(values), point: pointErrorOf(point) }));
      return Promise.resolve();
    }
    const payload = sitePayload(values, point, presenceCode);
    return form.save(
      async () => {
        onSaved(original ? await siteService.update(original.id, payload) : await siteService.create(payload));
      },
      () => t(original ? 'sites.form.saveError' : 'sites.form.createError'),
      () => siteConfirm(original, payload),
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
    /** La entrada y la salida piden el código del kiosco del sitio (antifraude 2b). */
    presenceCode,
    setPresenceCode,
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
