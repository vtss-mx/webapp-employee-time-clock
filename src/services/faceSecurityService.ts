import type { FaceSecurityOverview } from '../types/faceSecurity';
import { hasKeys } from '../utils/guards';
import { apiEnvelope, apiRequest } from './apiClient';

const isOverview = hasKeys<FaceSecurityOverview>('thresholds', 'reinforced', 'flash');

/**
 * Seguridad facial de la plataforma (solo el ADMIN): lo que se endureció solo (umbrales
 * autocalibrados), las empresas reforzadas por ataques y lo medido del destello de colores.
 */
export const faceSecurityService = {
  overview(signal?: AbortSignal): Promise<FaceSecurityOverview> {
    return apiRequest<FaceSecurityOverview>('/admin/face-security', { signal, validate: isOverview });
  },

  /**
   * Recalcula ahora los umbrales con las mediciones recientes (lo mismo que hace el mantenimiento;
   * solo endurece). Devuelve los datos nuevos y el mensaje del servidor (cuántos cambiaron).
   */
  async recalibrate(): Promise<{ overview: FaceSecurityOverview; message: string }> {
    const { data, message } = await apiEnvelope<FaceSecurityOverview>('/admin/face-security/recalibrate', { method: 'POST', validate: isOverview });
    return { overview: data, message };
  },
};
