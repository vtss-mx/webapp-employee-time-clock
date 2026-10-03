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
    newCompanyAdmin: (id: number | string) => `/admin/companies/${id}/admins/new`,
    companyAdminPassword: (id: number | string, adminId: number | string) => `/admin/companies/${id}/admins/${adminId}/password`,
  },
  company: {
    dashboard: '/company/dashboard',
    employees: '/company/employees',
    newEmployee: '/company/employees/new',
    employee: (id: number | string) => `/company/employees/${id}`,
    editEmployee: (id: number | string) => `/company/employees/${id}/edit`,
    reverifyEmployee: (id: number | string) => `/company/employees/${id}/reverify`,
    /** Rostro en persona: registrar (enroll) o verificar (verify) con el empleado presente. */
    employeeFace: (id: number | string, mode: 'enroll' | 'verify' | ':mode') => `/company/employees/${id}/face/${mode}`,
    validations: '/company/validations',
    validation: (id: number | string) => `/company/validations/${id}`,
    rejectValidation: (id: number | string) => `/company/validations/${id}/reject`,
    validators: '/company/validators',
    newValidator: '/company/validators/new',
    editValidator: (id: number | string) => `/company/validators/${id}/edit`,
    validatorDevices: (id: number | string) => `/company/validators/${id}/devices`,
    validatorPassword: (id: number | string) => `/company/validators/${id}/password`,
    settings: '/company/settings',
  },
  /** Validador de identidad (tableta o teléfono en un acceso). */
  validator: {
    checkpoint: '/validator/checkpoint',
  },
  employee: {
    dashboard: '/employee/dashboard',
    verify: '/employee/verify',
    verifyFace: '/employee/verify/face',
    verifyQr: '/employee/verify/qr',
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

/** Empleado que trabaja en varias empresas y aún no elige a cuál entrar. */
export function needsCompanySelection(user: Pick<User, 'role' | 'employee'>): boolean {
  return user.role === 'EMPLOYEE' && !user.employee;
}
