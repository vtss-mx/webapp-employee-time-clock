import type { Catalogs } from '../types';
import { isCatalogs, withMissingCatalogs } from '../utils/catalogs';
import { apiRequest } from './apiClient';

/**
 * Catálogos de la BD (roles, estados, motivos, países...). Requiere sesión. Un catálogo que el servidor aún no envía
 * (despliegue gradual) llega como lista vacía; uno con otra forma rechaza la respuesta.
 */
export const catalogService = {
  async getAll(signal?: AbortSignal): Promise<Catalogs> {
    return withMissingCatalogs(await apiRequest<Partial<Catalogs>>('/catalogs', { signal, validate: isCatalogs }));
  },
};
