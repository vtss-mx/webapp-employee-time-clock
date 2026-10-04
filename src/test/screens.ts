import type { MenuModule, Role, Screen, User } from '../types';

/**
 * Pantallas de las pruebas: copia de `catalog.screens` y `catalog.role_screens` del backend
 * (alembic/seed/catalogs.json). `screens.contract.test.ts` verifica que sigan siendo iguales.
 */
export const SEED_SCREENS: Screen[] = [
  { code: 'ADMIN_DASHBOARD', name: 'Panel', short_name: null, path: '/admin/dashboard', icon: 'LayoutDashboard', badge: null, module: 'PLATFORM' },
  { code: 'ADMIN_COMPANIES', name: 'Empresas', short_name: null, path: '/admin/companies', icon: 'Building2', badge: null, module: 'PLATFORM' },
  { code: 'ADMIN_ERRORS', name: 'Errores del sistema', short_name: 'Errores', path: '/admin/errors', icon: 'Bug', badge: 'PENDING_ERRORS', module: 'OPERATIONS' },
  { code: 'ADMIN_FACE_SECURITY', name: 'Seguridad facial', short_name: 'Seguridad', path: '/admin/face-security', icon: 'ShieldCheck', badge: null, module: 'OPERATIONS' },
  { code: 'COMPANY_DASHBOARD', name: 'Dashboard', short_name: 'Inicio', path: '/company/dashboard', icon: 'LayoutDashboard', badge: null, module: 'OVERVIEW' },
  { code: 'COMPANY_EMPLOYEES', name: 'Empleados', short_name: null, path: '/company/employees', icon: 'Users', badge: null, module: 'PEOPLE' },
  { code: 'COMPANY_DEPARTMENTS', name: 'Departamentos', short_name: 'Áreas', path: '/company/departments', icon: 'Network', badge: null, module: 'PEOPLE' },
  { code: 'COMPANY_VALIDATIONS', name: 'Validaciones', short_name: 'Validar', path: '/company/validations', icon: 'ClipboardCheck', badge: 'PENDING_ENROLLMENTS', module: 'PEOPLE' },
  { code: 'COMPANY_ATTENDANCE', name: 'Tablero del día', short_name: 'Tablero', path: '/company/attendance', icon: 'Clock', badge: null, module: 'ATTENDANCE' },
  { code: 'COMPANY_SHIFTS', name: 'Turnos', short_name: null, path: '/company/shifts', icon: 'CalendarClock', badge: 'PENDING_SHIFT_REQUESTS', module: 'ATTENDANCE' },
  { code: 'COMPANY_CALENDAR', name: 'Calendario', short_name: null, path: '/company/calendar', icon: 'CalendarDays', badge: 'PENDING_ABSENCE_REQUESTS', module: 'ATTENDANCE' },
  { code: 'COMPANY_SITES', name: 'Sitios de trabajo', short_name: 'Sitios', path: '/company/sites', icon: 'MapPin', badge: null, module: 'ATTENDANCE' },
  { code: 'COMPANY_VALIDATORS', name: 'Validadores', short_name: null, path: '/company/validators', icon: 'ScanLine', badge: null, module: 'ACCESS' },
  { code: 'COMPANY_API', name: 'Integraciones (API)', short_name: 'API', path: '/company/integrations', icon: 'KeyRound', badge: null, module: 'DATA' },
  { code: 'VALIDATOR_CHECKPOINT', name: 'Identificar empleados', short_name: 'Identificar', path: '/validator/checkpoint', icon: 'ScanFace', badge: null, module: 'ACCESS' },
  { code: 'EMPLOYEE_ATTENDANCE', name: 'Mi asistencia', short_name: 'Asistencia', path: '/employee/attendance', icon: 'Clock', badge: null, module: 'MY_WORK' },
  { code: 'EMPLOYEE_ENROLL', name: 'Registro facial', short_name: 'Mi rostro', path: '/employee/enroll', icon: 'ScanFace', badge: null, module: 'IDENTITY' },
  { code: 'EMPLOYEE_PENDING', name: 'Registro facial', short_name: 'Mi rostro', path: '/employee/pending', icon: 'ScanFace', badge: null, module: 'IDENTITY' },
  { code: 'EMPLOYEE_VERIFY', name: 'Identificación', short_name: 'Identificar', path: '/employee/dashboard', icon: 'ScanFace', badge: null, module: 'IDENTITY' },
  { code: 'EMPLOYEE_QR', name: 'Mi código QR', short_name: 'Mi QR', path: '/employee/qr', icon: 'QrCode', badge: null, module: 'IDENTITY' },
  { code: 'EMPLOYEE_SELECT_COMPANY', name: 'Cambiar de empresa', short_name: 'Empresa', path: '/select-company', icon: 'Building2', badge: null, module: 'ACCOUNT' },
  { code: 'PROFILE', name: 'Mi perfil', short_name: 'Perfil', path: '/profile', icon: 'UserCircle2', badge: null, module: 'ACCOUNT' },
];

/** Módulos del menú (catalog.menu_modules), en su orden. */
export const SEED_MODULES: MenuModule[] = [
  { code: 'PLATFORM', name: 'Plataforma', icon: 'Building2' },
  { code: 'OPERATIONS', name: 'Operación', icon: 'Activity' },
  { code: 'OVERVIEW', name: 'General', icon: 'LayoutDashboard' },
  { code: 'PEOPLE', name: 'Personal', icon: 'Users' },
  { code: 'ATTENDANCE', name: 'Asistencia', icon: 'Clock' },
  { code: 'ACCESS', name: 'Control de acceso', icon: 'ScanLine' },
  { code: 'DATA', name: 'Conexiones', icon: 'KeyRound' },
  { code: 'MY_WORK', name: 'Mi trabajo', icon: 'Clock' },
  { code: 'IDENTITY', name: 'Mi identidad', icon: 'ScanFace' },
  { code: 'ACCOUNT', name: 'Cuenta', icon: 'UserCircle2' },
];

export const SEED_GRANTS: Record<Role, string[]> = {
  ADMIN: ['ADMIN_DASHBOARD', 'ADMIN_COMPANIES', 'ADMIN_ERRORS', 'ADMIN_FACE_SECURITY', 'PROFILE'],
  COMPANY: [
    'COMPANY_DASHBOARD',
    'COMPANY_EMPLOYEES',
    'COMPANY_DEPARTMENTS',
    'COMPANY_VALIDATIONS',
    'COMPANY_VALIDATORS',
    'COMPANY_ATTENDANCE',
    'COMPANY_SHIFTS',
    'COMPANY_CALENDAR',
    'COMPANY_SITES',
    'COMPANY_API',
    'PROFILE',
  ],
  VALIDATOR: ['VALIDATOR_CHECKPOINT', 'PROFILE'],
  EMPLOYEE: ['EMPLOYEE_ATTENDANCE', 'EMPLOYEE_ENROLL', 'EMPLOYEE_PENDING', 'EMPLOYEE_VERIFY', 'EMPLOYEE_QR', 'EMPLOYEE_SELECT_COMPANY', 'PROFILE'],
};

/** Mismas reglas de disponibilidad que el backend (app/services/navigation_service.py). */
function available(code: string, user: Pick<User, 'employee' | 'memberships'>): boolean {
  const status = user.employee?.face_status;
  switch (code) {
    case 'EMPLOYEE_ENROLL':
      return Boolean(user.employee) && (status === 'NOT_ENROLLED' || status === 'REJECTED');
    case 'EMPLOYEE_PENDING':
      return status === 'PENDING_REVIEW';
    case 'EMPLOYEE_ATTENDANCE':
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
export function withScreens<T extends Omit<User, 'screens' | 'home'>>(user: T): T & Pick<User, 'screens' | 'home' | 'modules'> {
  const granted = SEED_GRANTS[user.role];
  const order = SEED_MODULES.map((module) => module.code);
  // Como el backend: agrupadas por módulo (en su orden) y, dentro de cada uno, en el de las pantallas.
  const screens = SEED_SCREENS.filter((screen) => granted.includes(screen.code) && available(screen.code, user)).sort(
    (a, b) => order.indexOf(a.module ?? '') - order.indexOf(b.module ?? ''),
  );
  const modules = SEED_MODULES.filter((module) => screens.some((screen) => screen.module === module.code));
  return { ...user, screens, modules, home: screens[0]?.path ?? null };
}
