import type { CompanyUsage, CompanyUsageRow, Page, PageQuery, RouteUsage, UsageOverview, UsageRange, UsageSort, UserUsage } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

const isOverview = hasKeys<UsageOverview>('start', 'end', 'totals', 'days', 'storage');
const isRow = hasKeys<CompanyUsageRow>('company_id', 'name', 'requests', 'bytes_in', 'bytes_out', 'share');
const isCompany = hasKeys<CompanyUsage>('company_id', 'totals', 'days', 'top_routes', 'storage');
const isUser = hasKeys<UserUsage>('user_id', 'requests', 'share');
const isRoute = hasKeys<RouteUsage>('route', 'requests', 'max_ms');

const base = (companyId: number) => `/admin/usage/companies/${companyId}`;

/**
 * Consumo de la plataforma (solo el ADMIN): peticiones, datos que entran y salen, tiempo de proceso,
 * errores y almacenamiento, de toda la plataforma, de cada empresa y de cada usuario. Sin rango, el
 * backend usa del 1 del mes a hoy (máximo 366 días).
 */
export const usageService = {
  overview(range: UsageRange, signal?: AbortSignal): Promise<UsageOverview> {
    return apiRequest<UsageOverview>('/admin/usage/overview', { query: { ...range }, signal, validate: isOverview });
  },

  companies(query: UsageRange & PageQuery & { search?: string; sort?: UsageSort }, signal?: AbortSignal): Promise<Page<CompanyUsageRow>> {
    return apiRequest<Page<CompanyUsageRow>>('/admin/usage/companies', { query: { ...query }, signal, validate: isPage(isRow) });
  },

  company(companyId: number, range: UsageRange, signal?: AbortSignal): Promise<CompanyUsage> {
    return apiRequest<CompanyUsage>(base(companyId), { query: { ...range }, signal, validate: isCompany });
  },

  /** Usuarios de la empresa (más peticiones primero). */
  users(companyId: number, query: UsageRange & PageQuery, signal?: AbortSignal): Promise<Page<UserUsage>> {
    return apiRequest<Page<UserUsage>>(`${base(companyId)}/users`, { query: { ...query }, signal, validate: isPage(isUser) });
  },

  /** Rutas de la API que usó la empresa (más peticiones primero). */
  routes(companyId: number, query: UsageRange & PageQuery, signal?: AbortSignal): Promise<Page<RouteUsage>> {
    return apiRequest<Page<RouteUsage>>(`${base(companyId)}/routes`, { query: { ...query }, signal, validate: isPage(isRoute) });
  },
};
