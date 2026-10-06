import type { DeviceStatus, Page } from './index';

/**
 * Dispositivo (navegador de un teléfono o computadora) desde el que un empleado checa o verifica su identidad: el
 * backend guarda solo el hash de su llave (decisión D2). Lo ven la empresa (ficha del empleado) y el empleado (Mi
 * perfil). `status`: catálogo `device_statuses` (por decidir, aprobado o revocado).
 */
export interface EmployeeDevice {
  id: number;
  /** "iPhone · Safari" o su tipo en el idioma activo ("Teléfono"): lo arma el backend. */
  name: string;
  status: DeviceStatus;
  first_seen_at: string;
  last_seen_at: string;
  uses: number;
  /** Superó un paso más en él (modo «Un paso más en un dispositivo nuevo»: desde entonces es de confianza). */
  stepped_up_at: string | null;
  reviewed_at: string | null;
  /** Quién decidió (solo en la ficha que ve la empresa). */
  reviewed_by: string | null;
}

export type EmployeeDeviceList = Page<EmployeeDevice>;
