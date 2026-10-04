import type { ApiKey, ApiKeyCreatePayload, ApiKeyCreated, ApiKeyList, PageQuery } from '../types';
import { hasKeys, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';

const isKey = hasKeys<ApiKey>('id', 'name', 'prefix', 'scopes', 'status');
const isCreated = hasKeys<ApiKeyCreated>('id', 'prefix', 'secret');

/** Llaves de la API de integración de la empresa (pantalla Integraciones). */
export const apiKeyService = {
  list(query: PageQuery, signal?: AbortSignal): Promise<ApiKeyList> {
    return apiRequest<ApiKeyList>('/api-keys', { query: { ...query }, signal, validate: isPage(isKey) });
  },

  /** Crea una llave: el secreto viene UNA sola vez en la respuesta. */
  create(payload: ApiKeyCreatePayload): Promise<ApiKeyCreated> {
    return apiRequest<ApiKeyCreated>('/api-keys', { method: 'POST', body: { ...payload, name: payload.name.trim() }, validate: isCreated });
  },

  /** Llave nueva con los mismos permisos; la anterior deja de servir al instante. */
  rotate(id: number): Promise<ApiKeyCreated> {
    return apiRequest<ApiKeyCreated>(`/api-keys/${id}/rotate`, { method: 'POST', validate: isCreated });
  },

  revoke(id: number): Promise<ApiKey> {
    return apiRequest<ApiKey>(`/api-keys/${id}`, { method: 'DELETE', validate: isKey });
  },
};
