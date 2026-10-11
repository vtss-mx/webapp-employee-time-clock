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
  { code: 'ADMIN_FRAUD_CASES', name: 'Casos de fraude', short_name: 'Fraude', path: '/admin/fraud-cases', icon: 'ShieldAlert', badge: 'OPEN_FRAUD_CASES', module: 'OPERATIONS' },
  { code: 'ADMIN_BILLING', name: 'Cobranza', short_name: null, path: '/admin/billing', icon: 'Receipt', badge: null, module: 'BUSINESS' },
  { code: 'ADMIN_USAGE', name: 'Consumo', short_name: null, path: '/admin/usage', icon: 'Gauge', badge: null, module: 'BUSINESS' },
  { code: 'ADMIN_PERFORMANCE', name: 'Rendimiento', short_name: null, path: '/admin/performance', icon: 'Timer', badge: 'OPEN_SLOW_ALERTS', module: 'OPERATIONS' },
  { code: 'ADMIN_DRIFT', name: 'Deriva de señales', short_name: 'Deriva', path: '/admin/drift', icon: 'TrendingDown', badge: null, module: 'OPERATIONS' },
  { code: 'COMPANY_DASHBOARD', name: 'Panel', short_name: 'Inicio', path: '/company/dashboard', icon: 'LayoutDashboard', badge: null, module: 'OVERVIEW' },
  { code: 'COMPANY_EMPLOYEES', name: 'Empleados', short_name: null, path: '/company/employees', icon: 'Users', badge: null, module: 'PEOPLE' },
  { code: 'COMPANY_VALIDATIONS', name: 'Validaciones', short_name: 'Validar', path: '/company/validations', icon: 'ClipboardCheck', badge: 'PENDING_ENROLLMENTS', module: 'PEOPLE' },
  { code: 'COMPANY_VERIFICATIONS', name: 'Verificaciones', short_name: null, path: '/company/verifications', icon: 'MapPin', badge: null, module: 'ATTENDANCE' },
  { code: 'COMPANY_SITES', name: 'Sitios de verificación', short_name: 'Sitios', path: '/company/sites', icon: 'MapPin', badge: null, module: 'ATTENDANCE' },
  { code: 'COMPANY_VALIDATORS', name: 'Validadores', short_name: null, path: '/company/validators', icon: 'ScanLine', badge: null, module: 'ACCESS' },
  { code: 'COMPANY_API', name: 'Integraciones (API)', short_name: 'API', path: '/company/integrations', icon: 'KeyRound', badge: null, module: 'DATA' },
  { code: 'COMPANY_DOCUMENTS', name: 'Documentos', short_name: null, path: '/company/documents', icon: 'FileText', badge: null, module: 'ACCOUNT' },
  { code: 'VALIDATOR_CHECKPOINT', name: 'Identificar empleados', short_name: 'Identificar', path: '/validator/checkpoint', icon: 'ScanFace', badge: null, module: 'ACCESS' },
  { code: 'EMPLOYEE_ENROLL', name: 'Registro facial', short_name: 'Mi rostro', path: '/employee/enroll', icon: 'ScanFace', badge: null, module: 'IDENTITY' },
  { code: 'EMPLOYEE_PENDING', name: 'Registro facial', short_name: 'Mi rostro', path: '/employee/pending', icon: 'ScanFace', badge: null, module: 'IDENTITY' },
  { code: 'EMPLOYEE_VERIFY', name: 'Identificación', short_name: 'Identificar', path: '/employee/dashboard', icon: 'ScanFace', badge: null, module: 'IDENTITY' },
  { code: 'EMPLOYEE_QR', name: 'Mi código QR', short_name: 'Mi QR', path: '/employee/qr', icon: 'QrCode', badge: null, module: 'IDENTITY' },
  { code: 'EMPLOYEE_SELECT_COMPANY', name: 'Cambiar de empresa', short_name: 'Empresa', path: '/select-company', icon: 'Building2', badge: null, module: 'ACCOUNT' },
  { code: 'PROFILE', name: 'Mi perfil', short_name: 'Perfil', path: '/profile', icon: 'UserCircle2', badge: null, module: 'ACCOUNT' },
  { code: 'ADMIN_AUDIT', name: 'Bitácora de auditoría', short_name: 'Auditoría', path: '/admin/audit', icon: 'ScrollText', badge: null, module: 'OPERATIONS' },
  { code: 'ADMIN_ACCESS_REVIEW', name: 'Revisión de accesos', short_name: 'Accesos', path: '/admin/access-review', icon: 'UserCheck', badge: null, module: 'OPERATIONS' },
  { code: 'ADMIN_VERIFICATIONS', name: 'Historial de verificaciones', short_name: 'Verificaciones', path: '/admin/verifications', icon: 'History', badge: null, module: 'OPERATIONS' },
];

/** Módulos del menú (catalog.menu_modules), en su orden. */
export const SEED_MODULES: MenuModule[] = [
  { code: 'PLATFORM', name: 'Plataforma', icon: 'Building2' },
  { code: 'BUSINESS', name: 'Negocio', icon: 'Wallet' },
  { code: 'OPERATIONS', name: 'Operación', icon: 'Activity' },
  { code: 'OVERVIEW', name: 'General', icon: 'LayoutDashboard' },
  { code: 'PEOPLE', name: 'Personal', icon: 'Users' },
  { code: 'ATTENDANCE', name: 'Verificación', icon: 'Clock' },
  { code: 'ACCESS', name: 'Control de acceso', icon: 'ScanLine' },
  { code: 'DATA', name: 'Conexiones', icon: 'KeyRound' },
  { code: 'IDENTITY', name: 'Mi identidad', icon: 'ScanFace' },
  { code: 'ACCOUNT', name: 'Cuenta', icon: 'UserCircle2' },
];

export const SEED_GRANTS: Record<Role, string[]> = {
  ADMIN: [
    'ADMIN_DASHBOARD',
    'ADMIN_COMPANIES',
    'ADMIN_ERRORS',
    'ADMIN_FACE_SECURITY',
    'ADMIN_FRAUD_CASES',
    'ADMIN_BILLING',
    'ADMIN_USAGE',
    'ADMIN_PERFORMANCE',
    'ADMIN_DRIFT',
    'PROFILE',
    'ADMIN_AUDIT',
    'ADMIN_ACCESS_REVIEW',
    'ADMIN_VERIFICATIONS',
  ],
  COMPANY: [
    'COMPANY_DASHBOARD',
    'COMPANY_EMPLOYEES',
    'COMPANY_VALIDATIONS',
    'COMPANY_VALIDATORS',
    'COMPANY_VERIFICATIONS',
    'COMPANY_SITES',
    'COMPANY_API',
    'COMPANY_DOCUMENTS',
    'PROFILE',
  ],
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
