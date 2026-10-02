import type { Role, User } from '../types';

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
  },
  company: {
    dashboard: '/company/dashboard',
    employees: '/company/employees',
    newEmployee: '/company/employees/new',
    employee: (id: number | string) => `/company/employees/${id}`,
    editEmployee: (id: number | string) => `/company/employees/${id}/edit`,
    validations: '/company/validations',
    validation: (id: number | string) => `/company/validations/${id}`,
    validators: '/company/validators',
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

const HOMES: Record<Role, string> = {
  ADMIN: paths.admin.dashboard,
  COMPANY: paths.company.dashboard,
  EMPLOYEE: paths.employee.dashboard,
  VALIDATOR: paths.validator.checkpoint,
};

export function homeFor(role: Role): string {
  return HOMES[role];
}

type HomeUser = Pick<User, 'role' | 'employee'>;

/** Empleado que trabaja en varias empresas y aún no elige a cuál entrar. */
export function needsCompanySelection(user: HomeUser): boolean {
  return user.role === 'EMPLOYEE' && !user.employee;
}

/** Inicio del usuario: el de su rol o, si aún debe elegir empresa, el selector. */
export function homeForUser(user: HomeUser): string {
  return needsCompanySelection(user) ? paths.selectCompany : homeFor(user.role);
}
