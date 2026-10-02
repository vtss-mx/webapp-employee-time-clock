import type { Role, Screen, User } from '../types';

/**
 * Pantallas de las pruebas: copia de `catalog.screens` y `catalog.role_screens` del backend
 * (alembic/seed/catalogs.json). `screens.contract.test.ts` verifica que sigan siendo iguales.
 */
export const SEED_SCREENS: Screen[] = [
  { code: 'ADMIN_DASHBOARD', name: 'Panel', short_name: null, path: '/admin/dashboard', icon: 'LayoutDashboard', badge: null },
  { code: 'ADMIN_COMPANIES', name: 'Empresas', short_name: null, path: '/admin/companies', icon: 'Building2', badge: null },
  { code: 'COMPANY_DASHBOARD', name: 'Dashboard', short_name: 'Inicio', path: '/company/dashboard', icon: 'LayoutDashboard', badge: null },
  { code: 'COMPANY_EMPLOYEES', name: 'Empleados', short_name: null, path: '/company/employees', icon: 'Users', badge: null },
  { code: 'COMPANY_VALIDATIONS', name: 'Validaciones', short_name: 'Validar', path: '/company/validations', icon: 'ClipboardCheck', badge: 'PENDING_ENROLLMENTS' },
  { code: 'COMPANY_VALIDATORS', name: 'Validadores', short_name: null, path: '/company/validators', icon: 'ScanLine', badge: null },
  { code: 'COMPANY_SETTINGS', name: 'Configuración', short_name: 'Ajustes', path: '/company/settings', icon: 'Settings2', badge: null },
  { code: 'VALIDATOR_CHECKPOINT', name: 'Identificar empleados', short_name: 'Identificar', path: '/validator/checkpoint', icon: 'ScanFace', badge: null },
  { code: 'EMPLOYEE_ENROLL', name: 'Registro facial', short_name: 'Mi rostro', path: '/employee/enroll', icon: 'ScanFace', badge: null },
  { code: 'EMPLOYEE_PENDING', name: 'Registro facial', short_name: 'Mi rostro', path: '/employee/pending', icon: 'ScanFace', badge: null },
  { code: 'EMPLOYEE_VERIFY', name: 'Identificación', short_name: 'Identificar', path: '/employee/dashboard', icon: 'ScanFace', badge: null },
  { code: 'EMPLOYEE_QR', name: 'Mi código QR', short_name: 'Mi QR', path: '/employee/qr', icon: 'QrCode', badge: null },
  { code: 'EMPLOYEE_SELECT_COMPANY', name: 'Cambiar de empresa', short_name: 'Empresa', path: '/select-company', icon: 'Building2', badge: null },
  { code: 'PROFILE', name: 'Mi perfil', short_name: 'Perfil', path: '/profile', icon: 'UserCircle2', badge: null },
];

export const SEED_GRANTS: Record<Role, string[]> = {
  ADMIN: ['ADMIN_DASHBOARD', 'ADMIN_COMPANIES', 'PROFILE'],
  COMPANY: ['COMPANY_DASHBOARD', 'COMPANY_EMPLOYEES', 'COMPANY_VALIDATIONS', 'COMPANY_VALIDATORS', 'COMPANY_SETTINGS', 'PROFILE'],
  VALIDATOR: ['VALIDATOR_CHECKPOINT', 'PROFILE'],
  EMPLOYEE: ['EMPLOYEE_ENROLL', 'EMPLOYEE_PENDING', 'EMPLOYEE_VERIFY', 'EMPLOYEE_QR', 'EMPLOYEE_SELECT_COMPANY', 'PROFILE'],
};

/** Mismas reglas de disponibilidad que el backend (app/services/navigation_service.py). */
function available(code: string, user: Pick<User, 'employee' | 'memberships'>): boolean {
  const status = user.employee?.face_status;
  switch (code) {
    case 'EMPLOYEE_ENROLL':
      return Boolean(user.employee) && (status === 'NOT_ENROLLED' || status === 'REJECTED');
    case 'EMPLOYEE_PENDING':
      return status === 'PENDING_REVIEW';
    case 'EMPLOYEE_VERIFY':
    case 'EMPLOYEE_QR':
      return status === 'APPROVED';
    case 'EMPLOYEE_SELECT_COMPANY':
      return (user.memberships?.length ?? 0) > 1;
    default:
      return true;
  }
}

/** El usuario como lo enviaría el backend: con sus pantallas y su inicio según su rol y estado. */
export function withScreens<T extends Omit<User, 'screens' | 'home'>>(user: T): T & Pick<User, 'screens' | 'home'> {
  const granted = SEED_GRANTS[user.role];
  const screens = SEED_SCREENS.filter((screen) => granted.includes(screen.code) && available(screen.code, user));
  return { ...user, screens, home: screens[0]?.path ?? null };
}
