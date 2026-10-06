import type { Kiosk, KioskCreated, KioskList, PageQuery, Restored, WorkSite, WorkSiteList, WorkSitePayload } from '../types';
import { hasKeys, isNothing, isPage, isRecord } from '../utils/guards';
import { apiRequest } from './apiClient';
import { restoreRecord } from './http/restore';

export const isWorkSite = hasKeys<WorkSite>('id', 'name', 'address', 'radius_m', 'active');
const isKiosk = hasKeys<Kiosk>('id', 'site_id', 'name', 'paired');
const isKioskCreated = (value: unknown): value is KioskCreated =>
  isRecord(value) && isKiosk(value.kiosk) && typeof value.pairing_code === 'string' && typeof value.pairing_expires_at === 'string';

export interface SiteListQuery extends PageQuery {
  search?: string;
  active?: boolean;
  /** Solo los de «Eliminados» (sin `active`). */
  deleted?: boolean;
}

/** Sitios de trabajo de la empresa (rol COMPANY): dónde se checa "en sitio" (geocerca). */
export const siteService = {
  list(query: SiteListQuery, signal?: AbortSignal): Promise<WorkSiteList> {
    return apiRequest<WorkSiteList>('/sites', { query: { ...query }, signal, validate: isPage(isWorkSite) });
  },

  get(id: number, signal?: AbortSignal): Promise<WorkSite> {
    return apiRequest<WorkSite>(`/sites/${id}`, { signal, validate: isWorkSite });
  },

  create(payload: WorkSitePayload): Promise<WorkSite> {
    return apiRequest<WorkSite>('/sites', { method: 'POST', body: payload, validate: isWorkSite });
  },

  update(id: number, payload: WorkSitePayload): Promise<WorkSite> {
    return apiRequest<WorkSite>(`/sites/${id}`, { method: 'PUT', body: payload, validate: isWorkSite });
  },

  setStatus(id: number, active: boolean): Promise<WorkSite> {
    return apiRequest<WorkSite>(`/sites/${id}/status`, { method: 'PATCH', body: { active }, validate: isWorkSite });
  },

  /** Solo si nadie checa ahí (si no, 409 SITE_IN_USE: se desactiva); va a «Eliminados». */
  async remove(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/sites/${id}`, { method: 'DELETE', validate: isNothing });
  },

  restore(id: number): Promise<Restored<WorkSite>> {
    return restoreRecord(`/sites/${id}`, isWorkSite);
  },

  // ---------- Kioscos del sitio (antifraude 2b: la tableta que muestra el código del sitio) ----------

  /** Kioscos del sitio, paginados; `deleted` = los de «Eliminados». */
  kiosks(siteId: number, query: PageQuery & { deleted?: boolean }, signal?: AbortSignal): Promise<KioskList> {
    return apiRequest<KioskList>(`/sites/${siteId}/kiosks`, { query: { ...query }, signal, validate: isPage(isKiosk) });
  },

  /** Crea un kiosco: su código de vinculación llega UNA sola vez. */
  createKiosk(siteId: number, name: string): Promise<KioskCreated> {
    return apiRequest<KioskCreated>(`/sites/${siteId}/kiosks`, { method: 'POST', body: { name: name.trim() }, validate: isKioskCreated });
  },

  /** Código de vinculación nuevo (una sola vez): la tableta vinculada deja de mostrar el código. */
  repairKiosk(siteId: number, kioskId: number): Promise<KioskCreated> {
    return apiRequest<KioskCreated>(`/sites/${siteId}/kiosks/${kioskId}/pairing`, { method: 'POST', validate: isKioskCreated });
  },

  /** Va a «Eliminados»: la tableta deja de mostrar el código. */
  async removeKiosk(siteId: number, kioskId: number): Promise<void> {
    await apiRequest<unknown>(`/sites/${siteId}/kiosks/${kioskId}`, { method: 'DELETE' }); // lo que devuelva no se usa
  },

  restoreKiosk(siteId: number, kioskId: number): Promise<Restored<Kiosk>> {
    return restoreRecord(`/sites/${siteId}/kiosks/${kioskId}`, isKiosk);
  },
};
