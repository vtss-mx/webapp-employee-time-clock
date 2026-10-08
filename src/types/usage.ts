// Consumo de la plataforma por empresa y por usuario (solo el ADMIN). Enteros como number: bytes,
// milisegundos y conteos.
import type { WithAvatar } from './avatar';
import type { BillingStatus, CurrencyCode, Money, PricePeriod, PricingMode } from './billing';

export interface UsageCounters {
  requests: number;
  bytes_in: number;
  bytes_out: number;
  /** Tiempo total de proceso. */
  duration_ms: number;
  /** duration_ms / requests (0 sin peticiones), con 1 decimal. */
  avg_ms: number;
  /** Respuestas 5xx. */
  server_errors: number;
  /** Respuestas 4xx. */
  client_errors: number;
}

export interface UsageDay extends UsageCounters {
  day: string;
}

export interface StorageItem {
  /** Código de `storage_categories`. */
  category: string;
  rows: number;
  bytes: number;
}

export interface StorageSummary {
  /** Día de la foto; null = aún no hay. */
  day: string | null;
  rows: number;
  bytes: number;
  items: StorageItem[];
}

export interface UsageOverview {
  start: string;
  end: string;
  totals: UsageCounters;
  /** Un registro por día del rango (con ceros), en orden. */
  days: UsageDay[];
  /** Toda la plataforma (última foto). */
  storage: StorageSummary;
  companies_with_traffic: number;
}

export interface CompanyUsageRow extends UsageCounters {
  company_id: number;
  name: string;
  active: boolean;
  status: BillingStatus;
  storage_bytes: number;
  storage_rows: number;
  /** Última foto del día. */
  active_employees: number;
  /** Validadores activos: se cobran como empleados. */
  active_validators: number;
  /** % de las peticiones de la plataforma en el rango (0..100, 1 decimal). */
  share: number;
}

export interface RouteUsage extends UsageCounters {
  /** "GET /api/employees/{employee_id}". */
  route: string;
  max_ms: number;
}

export interface UserUsage extends UsageCounters, WithAvatar {
  user_id: number;
  email: string | null;
  role: string | null;
  /** Nombre del empleado si la cuenta es de un empleado de esa empresa. */
  name: string | null;
  /** % de las peticiones de la empresa. */
  share: number;
}

export interface CompanyUsage {
  company_id: number;
  name: string;
  status: BillingStatus;
  start: string;
  end: string;
  totals: UsageCounters;
  days: UsageDay[];
  /** Las 5 rutas con más peticiones. */
  top_routes: RouteUsage[];
  storage: StorageSummary;
  active_employees: number;
  /** Validadores activos: se cobran como empleados. */
  active_validators: number;
  /** Su plan (en su moneda) para comparar el costo con el consumo; null sin plan. */
  billing: { currency: CurrencyCode; pricing_mode: PricingMode; unit_price: Money; price_period: PricePeriod; forecast_total: Money | null } | null;
}

/** Orden del listado de empresas por consumo. */
export type UsageSort = 'requests' | 'bytes' | 'duration' | 'errors' | 'storage';

/** Rango de días que se consulta (vacío = el que decide el backend: del 1 del mes a hoy). */
export interface UsageRange {
  start?: string;
  end?: string;
}
