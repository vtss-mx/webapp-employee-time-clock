/**
 * Puntos de verificación de una empresa (pantalla «Sitios de verificación») y su contrato con la API.
 *
 * Un sitio es un lugar con su domicilio, su punto en el mapa y su radio: acota una verificación de identidad a ese
 * lugar y, si activa su código, exige el código rotativo de su kiosco (antifraude 2b). Antes decía «dónde se checa»:
 * la asistencia se retiró del producto (backend, migración `0102`).
 */
import type { Address, Page } from './index';
import type { SoftDeleted } from './trash';

/** Sitio de verificación: «en sitio» es estar a no más de `radius_m` metros de su punto. */
export interface WorkSite extends SoftDeleted {
  id: number;
  name: string;
  address: Address;
  radius_m: number;
  active: boolean;
  /** Antifraude 2b: una verificación aquí pide el código que muestra el kiosco del sitio. */
  presence_code: boolean;
  /** Kioscos vigentes del sitio. */
  kiosks: number;
  created_at: string;
}

export type WorkSiteList = Page<WorkSite>;

export interface WorkSitePayload {
  name: string;
  address: Address;
  radius_m: number;
  presence_code: boolean;
}
