/**
 * Verificaciones de identidad de una empresa con dónde se hicieron (pantalla «Verificaciones», mapa de Google Maps).
 * Cada fila trae a la persona con su foto (`avatar`: la empresa ve a su gente, decisión del dueño, 2026-10-06) y, si la
 * verificación llevó ubicación (`verification_location` OBSERVE/ENFORCE), el punto donde ocurrió; sin ella, los campos
 * de ubicación son null y la fila lo dice. La empresa SIEMPRE sale de la sesión (aislamiento por empresa, regla 14): el
 * backend nunca recibe el `company_id` del cliente. Nunca viajan fotos del registro facial (solo el `avatar` de perfil).
 */
import type { WithAvatar } from './avatar';
import type { Page, VerificationMethod } from './index';

export interface CompanyVerification extends WithAvatar {
  id: number;
  /** Instante de la verificación (UTC; se muestra en la zona del negocio). */
  created_at: string;
  method: VerificationMethod;
  success: boolean;
  /** Código del catálogo `verification_reasons` cuando no fue exitosa; null si fue exitosa. */
  reason: string | null;
  confidence: number | null;
  /** Empleado identificado (null cuando no se identificó a nadie). */
  employee_id: number | null;
  /** Opcional (decisión del dueño del producto): null = sin número. */
  employee_number: string | null;
  employee_name: string | null;
  /** Dónde se hizo (WGS-84); null cuando la verificación no llevó ubicación («sin ubicación»). */
  latitude: number | null;
  longitude: number | null;
  /** Precisión informada por el dispositivo (m); null sin ubicación. */
  location_accuracy_m: number | null;
}

export type CompanyVerificationList = Page<CompanyVerification>;

/** Filtros del listado (todos opcionales); las fechas son días de la hora del negocio ("YYYY-MM-DD"). */
export interface CompanyVerificationQuery {
  page: number;
  size: number;
  employee_id?: number;
  start?: string;
  end?: string;
  /** `true` solo exitosas, `false` solo fallidas; sin él, todas. */
  success?: boolean;
}
