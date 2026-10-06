import type { DeviceStatus, PageQuery, Restored, Validator, ValidatorCreatePayload, ValidatorDevice, ValidatorDeviceList, ValidatorList, ValidatorSettings } from '../types';
import { hasKeys, isNothing, isPage } from '../utils/guards';
import { apiRequest } from './apiClient';
import { restoreRecord } from './http/restore';

const isValidator = hasKeys<Validator>('id', 'name', 'email', 'mode', 'active');
const isDevice = hasKeys<ValidatorDevice>('id', 'name', 'status');
/** La página trae además el uso del límite que fija el ADMIN (`active` de `limit`). */
const isValidatorList = (value: unknown): value is ValidatorList => isPage(isValidator)(value) && hasKeys<ValidatorList>('active', 'limit')(value);

/** Validadores de identidad de la empresa (rol COMPANY). */
export const validatorService = {
  /** `deleted`: solo los de «Eliminados». */
  list(query: PageQuery & { deleted?: boolean }, signal?: AbortSignal): Promise<ValidatorList> {
    return apiRequest<ValidatorList>('/validators', { query: { ...query }, signal, validate: isValidatorList });
  },

  get(id: number, signal?: AbortSignal): Promise<Validator> {
    return apiRequest<Validator>(`/validators/${id}`, { signal, validate: isValidator });
  },

  /** Alta: cuenta, modo, domicilio y (si se exige) ubicación permitida para iniciar sesión. */
  create(values: ValidatorCreatePayload): Promise<Validator> {
    const body = { ...values, name: values.name.trim(), email: values.email.trim().toLowerCase() };
    return apiRequest<Validator>('/validators', { method: 'POST', body, validate: isValidator });
  },

  update(id: number, changes: Partial<ValidatorSettings>): Promise<Validator> {
    return apiRequest<Validator>(`/validators/${id}`, { method: 'PUT', body: changes, validate: isValidator });
  },

  setStatus(id: number, active: boolean): Promise<Validator> {
    return apiRequest<Validator>(`/validators/${id}/status`, { method: 'PATCH', body: { active }, validate: isValidator });
  },

  resetPassword(id: number, password: string): Promise<Validator> {
    return apiRequest<Validator>(`/validators/${id}/password`, { method: 'PUT', body: { password }, validate: isValidator });
  },

  /** Dispositivos del validador (los por autorizar primero). */
  devices(id: number, query: PageQuery, signal?: AbortSignal): Promise<ValidatorDeviceList> {
    return apiRequest<ValidatorDeviceList>(`/validators/${id}/devices`, { query: { ...query }, signal, validate: isPage(isDevice) });
  },

  /** Autorizar, rechazar (uno pendiente) o revocar (uno autorizado: cierra sus sesiones). */
  setDeviceStatus(id: number, deviceId: number, status: Exclude<DeviceStatus, 'PENDING'>): Promise<ValidatorDevice> {
    return apiRequest<ValidatorDevice>(`/validators/${id}/devices/${deviceId}/status`, { method: 'PATCH', body: { status }, validate: isDevice });
  },

  /** Lo manda a «Eliminados» (se restaura durante 1 año). */
  async remove(id: number): Promise<void> {
    await apiRequest<null | undefined>(`/validators/${id}`, { method: 'DELETE', validate: isNothing });
  },

  /** Lo regresa de «Eliminados» (el límite de validadores activos se vuelve a revisar). */
  restore(id: number): Promise<Restored<Validator>> {
    return restoreRecord(`/validators/${id}`, isValidator);
  },
};
