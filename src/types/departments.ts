// Departamentos de la empresa: responsables y empleados asignados (GET/POST /api/departments).
import type { WithAvatar } from './avatar';
import type { SoftDeleted } from './trash';

/** Departamento (id y nombre) junto a un empleado. */
export interface DepartmentRef {
  id: number;
  name: string;
}

/** Responsable de un departamento: un empleado de la misma empresa. */
export interface DepartmentPerson extends WithAvatar {
  employee_id: number;
  full_name: string;
  /** Opcional (decisión del dueño del producto): null = sin número. */
  employee_number: string | null;
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
