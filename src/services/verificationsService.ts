import type { CompanyVerification, CompanyVerificationList, CompanyVerificationQuery } from '../types/verifications';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

const isVerification = hasKeys<CompanyVerification>('id', 'created_at', 'method', 'success');

/**
 * Verificaciones de identidad de la empresa de la sesión, con dónde se hicieron (pantalla «Verificaciones», mapa). Solo
 * lectura y solo lo que ve la empresa: la empresa SIEMPRE sale de la sesión (aislamiento por empresa; el `company_id`
 * del cliente nunca viaja) y la respuesta nunca trae fotos del registro facial (solo el `avatar` de perfil). El backend
 * lo expone en la fase B (`GET /api/verifications`, migración `0085`); aquí queda el contrato con el que se conecta.
 */
export const verificationsService = {
  list(query: CompanyVerificationQuery, signal?: AbortSignal): Promise<CompanyVerificationList> {
    return apiRequest<CompanyVerificationList>('/verifications', { query: { ...query }, signal, validate: isPage(isVerification) });
  },
};
