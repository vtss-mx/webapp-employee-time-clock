import type { User } from '../types';

export const paths = {
  login: '/login',
  /** Empleado que trabaja en varias empresas: elige a cuál entrar. */
  selectCompany: '/select-company',
  profile: '/profile',
  forbidden: '/forbidden',
  admin: {
    dashboard: '/admin/dashboard',
    companies: '/admin/companies',
    newCompany: '/admin/companies/new',
    company: (id: number | string) => `/admin/companies/${id}`,
    editCompany: (id: number | string) => `/admin/companies/${id}/edit`,
    /** Empleados de la empresa: solo consulta (ficha de trabajo, sin biometría). */
    companyEmployees: (id: number | string) => `/admin/companies/${id}/employees`,
    newCompanyAdmin: (id: number | string) => `/admin/companies/${id}/admins/new`,
    companyAdminPassword: (id: number | string, adminId: number | string) => `/admin/companies/${id}/admins/${adminId}/password`,
    errors: '/admin/errors',
    error: (id: number | string) => `/admin/errors/${id}`,
  },
  company: {
    dashboard: '/company/dashboard',
    employees: '/company/employees',
    newEmployee: '/company/employees/new',
    employee: (id: number | string) => `/company/employees/${id}`,
    editEmployee: (id: number | string) => `/company/employees/${id}/edit`,
    reverifyEmployee: (id: number | string) => `/company/employees/${id}/reverify`,
    /** Nueva verificación de identidad para toda la empresa. */
    reverifyAll: '/company/employees/reverify-all',
    /** Rostro en persona: registrar (enroll) o verificar (verify) con el empleado presente. */
    employeeFace: (id: number | string, mode: 'enroll' | 'verify' | ':mode') => `/company/employees/${id}/face/${mode}`,
    departments: '/company/departments',
    newDepartment: '/company/departments/new',
    department: (id: number | string) => `/company/departments/${id}`,
    editDepartment: (id: number | string) => `/company/departments/${id}/edit`,
    /** Elegir empleados para asignar al departamento o nombrar responsables. */
    assignDepartment: (id: number | string, role: 'employees' | 'managers' | ':role') => `/company/departments/${id}/assign/${role}`,
    validations: '/company/validations',
    validation: (id: number | string) => `/company/validations/${id}`,
    rejectValidation: (id: number | string) => `/company/validations/${id}/reject`,
    validators: '/company/validators',
    newValidator: '/company/validators/new',
    editValidator: (id: number | string) => `/company/validators/${id}/edit`,
    validatorDevices: (id: number | string) => `/company/validators/${id}/devices`,
    validatorPassword: (id: number | string) => `/company/validators/${id}/password`,
    /** Asistente de reportes: preguntas sobre los datos de la empresa y exportación a Excel. */
    reports: '/company/reports',
    settings: '/company/settings',
    integrations: '/company/integrations',
    newApiKey: '/company/integrations/new',
  },
  /** Validador de identidad (tableta o teléfono en un acceso). */
  validator: {
    checkpoint: '/validator/checkpoint',
  },
  employee: {
    dashboard: '/employee/dashboard',
    verify: '/employee/verify',
    verifyFace: '/employee/verify/face',
    myQr: '/employee/qr',
    enroll: '/employee/enroll',
    pending: '/employee/pending',
  },
} as const;

type HomeUser = Pick<User, 'home'>;

/** Inicio del usuario: lo decide el backend (su primera pantalla). */
export function homeForUser(user: HomeUser): string {
  return user.home ?? paths.profile;
}

/**
 * Persona que trabaja en varias empresas y aún no elige a cuál entrar: el backend le da como
 * inicio el selector de empresa (lo decide su estado, no el rol).
 */
export function needsCompanySelection(user: HomeUser): boolean {
  return user.home === paths.selectCompany;
}
