import type { Catalogs } from '../types';
import { isCatalogs } from '../utils/catalogs';
import { apiRequest } from './apiClient';

/** Catálogos de la BD (roles, estados, motivos, países...). Requiere sesión. */
export const catalogService = {
  getAll(signal?: AbortSignal): Promise<Catalogs> {
    return apiRequest<Catalogs>('/catalogs', { signal, validate: isCatalogs });
  },
};
