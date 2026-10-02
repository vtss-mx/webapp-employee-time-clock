import type { Validator, ValidatorFormValues, ValidatorMode } from '../types';
import { hasKeys, isArrayOf, isNothing } from '../utils/guards';
import { apiRequest } from './apiClient';

const isValidator = hasKeys<Validator>('id', 'name', 'email', 'mode', 'active');
const isValidators = isArrayOf<Validator[]>(isValidator);

/** Validadores de identidad de la empresa (rol COMPANY). */
export const validatorService = {
  list(signal?: AbortSignal): Promise<Validator[]> {
    return apiRequest<Validator[]>('/validators', { signal, validate: isValidators });
  },

  create(values: ValidatorFormValues): Promise<Validator> {
    const body = { ...values, name: values.name.trim(), email: values.email.trim().toLowerCase() };
    return apiRequest<Validator>('/validators', { method: 'POST', body, validate: isValidator });
  },

  update(id: number, changes: { name?: string; mode?: ValidatorMode }): Promise<Validator> {
    return apiRequest<Validator>(`/validators/${id}`, { method: 'PUT', body: changes, validate: isValidator });
  },

  setStatus(id: number, active: boolean): Promise<Validator> {
    return apiRequest<Validator>(`/validators/${id}/status`, { method: 'PATCH', body: { active }, validate: isValidator });
  },

  resetPassword(id: number, password: string): Promise<Validator> {
    return apiRequest<Validator>(`/validators/${id}/password`, { method: 'PUT', body: { password }, validate: isValidator });
  },

  async remove(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/validators/${id}`, { method: 'DELETE', validate: isNothing });
  },
};
