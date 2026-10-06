// Departamentos de la empresa: responsables y empleados asignados (GET/POST /api/departments).
import type { SoftDeleted } from './trash';

/** Departamento (id y nombre) junto a un empleado. */
export interface DepartmentRef {
  id: number;
  name: string;
}

/** Responsable de un departamento: un empleado de la misma empresa. */
export interface DepartmentPerson {
  employee_id: number;
  full_name: string;
  employee_number: string;
  active: boolean;
}

export interface Department extends SoftDeleted {
  id: number;
  name: string;
  description: string | null;
  /** Empleados asignados (activos e inactivos). */
  employee_count: number;
  managers: DepartmentPerson[];
  created_at: string;
  updated_at: string;
}

export interface DepartmentPayload {
  name: string;
  description: string | null;
}
