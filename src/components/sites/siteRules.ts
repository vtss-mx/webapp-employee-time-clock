import { t } from '../../i18n';

/**
 * Reglas puras del formulario de un punto de verificación (solo para guiar: el backend vuelve a validar todo).
 * Los límites son los mismos que el backend (`app/schemas/site.py`).
 */

export const SITE_NAME_MAX = 120;

/** Título del popup cuando no cargan los sitios (listado y selectores), en el idioma activo. */
export const sitesLoadError = () => t('sites.list.loadError');

/** Nombre de un sitio: obligatorio (2 caracteres o más) y con su máximo; `example` ya traducido. */
export function validateSiteName(value: string, example: string): string | undefined {
  const name = value.trim();
  if (name.length < 2) return t('sites.validation.nameRequired', { example });
  return name.length > SITE_NAME_MAX ? t('sites.validation.nameMax', { max: SITE_NAME_MAX }) : undefined;
}
