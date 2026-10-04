import type { PageQuery, WorkSite, WorkSiteList, WorkSitePayload } from '../types';
import { hasKeys, isNothing, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

export const isWorkSite = hasKeys<WorkSite>('id', 'name', 'address', 'radius_m', 'active');

export interface SiteListQuery extends PageQuery {
  search?: string;
  active?: boolean;
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

  /** Solo si nadie checa ahí (si no, 409 SITE_IN_USE: se desactiva). */
  async remove(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/sites/${id}`, { method: 'DELETE', validate: isNothing });
  },
};
