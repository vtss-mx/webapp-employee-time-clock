import {
  Building2,
  Circle,
  ClipboardCheck,
  LayoutDashboard,
  QrCode,
  ScanFace,
  ScanLine,
  Settings2,
  UserCircle2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import {
  AdminDashboardPage,
  CheckpointPage,
  CompaniesListPage,
  CompanyCreatePage,
  CompanyDetailPage,
  CompanyEditPage,
  CompanySelectPage,
  DashboardPage,
  EmployeeCreatePage,
  EmployeeDetailPage,
  EmployeeEditPage,
  EmployeeFacePage,
  EmployeesListPage,
  EnrollmentPage,
  FaceVerificationPage,
  MyQrPage,
  PendingValidationPage,
  ProfilePage,
  QrVerificationPage,
  SettingsPage,
  ValidationReviewPage,
  ValidationsPage,
  ValidatorDevicesPage,
  ValidatorPasswordPage,
  ReverifyIdentityPage,
  RejectEnrollmentPage,
  CompanyAdminFormPage,
  ValidatorFormPage,
  ValidatorsPage,
  VerificationMenuPage,
} from './lazyPages';
import { paths } from './paths';

/**
 * Registro de pantallas: lo ÚNICO que el frontend sabe de ellas es cómo dibujarlas.
 *
 * Qué pantallas ve cada usuario, en qué orden, con qué nombre, ícono y contador lo decide el
 * backend (`user.screens`, tablas catalog.screens y catalog.role_screens). Aquí cada código de
 * pantalla se asocia con sus rutas y componentes. Agregar una pantalla:
 *   1. backend: registro en `alembic/seed/catalogs.json` (screens y role_screens) + migración;
 *   2. frontend: su entrada aquí (y su ruta en `paths.ts`).
 * Una prueba de contrato verifica que ambos lados tengan las mismas pantallas y rutas base.
 */
export interface ScreenView {
  /** Ruta base (la misma que `catalog.screens.path`): a ella lleva la opción del menú. */
  base: string;
  /** Rutas de la pantalla (la base y sus subpantallas). */
  routes: Array<{ path: string; Page: ComponentType }>;
  /** A pantalla completa, sin el menú (p. ej. elegir empresa al entrar). */
  bare?: boolean;
}

export const SCREEN_VIEWS: Record<string, ScreenView> = {
  ADMIN_DASHBOARD: { base: paths.admin.dashboard, routes: [{ path: paths.admin.dashboard, Page: AdminDashboardPage }] },
  ADMIN_COMPANIES: {
    base: paths.admin.companies,
    routes: [
      { path: paths.admin.companies, Page: CompaniesListPage },
      { path: paths.admin.newCompany, Page: CompanyCreatePage },
      { path: paths.admin.company(':id'), Page: CompanyDetailPage },
      { path: paths.admin.editCompany(':id'), Page: CompanyEditPage },
      { path: paths.admin.newCompanyAdmin(':id'), Page: CompanyAdminFormPage },
      { path: paths.admin.companyAdminPassword(':id', ':adminId'), Page: CompanyAdminFormPage },
    ],
  },
  COMPANY_DASHBOARD: { base: paths.company.dashboard, routes: [{ path: paths.company.dashboard, Page: DashboardPage }] },
  COMPANY_EMPLOYEES: {
    base: paths.company.employees,
    routes: [
      { path: paths.company.employees, Page: EmployeesListPage },
      { path: paths.company.newEmployee, Page: EmployeeCreatePage },
      { path: paths.company.employee(':id'), Page: EmployeeDetailPage },
      { path: paths.company.editEmployee(':id'), Page: EmployeeEditPage },
      { path: paths.company.reverifyEmployee(':id'), Page: ReverifyIdentityPage },
      { path: paths.company.employeeFace(':id', ':mode'), Page: EmployeeFacePage },
    ],
  },
  COMPANY_VALIDATIONS: {
    base: paths.company.validations,
    routes: [
      { path: paths.company.validations, Page: ValidationsPage },
      { path: paths.company.validation(':id'), Page: ValidationReviewPage },
      { path: paths.company.rejectValidation(':id'), Page: RejectEnrollmentPage },
    ],
  },
  COMPANY_VALIDATORS: {
    base: paths.company.validators,
    routes: [
      { path: paths.company.validators, Page: ValidatorsPage },
      { path: paths.company.newValidator, Page: ValidatorFormPage },
      { path: paths.company.editValidator(':id'), Page: ValidatorFormPage },
      { path: paths.company.validatorDevices(':id'), Page: ValidatorDevicesPage },
      { path: paths.company.validatorPassword(':id'), Page: ValidatorPasswordPage },
    ],
  },
  COMPANY_SETTINGS: { base: paths.company.settings, routes: [{ path: paths.company.settings, Page: SettingsPage }] },
  VALIDATOR_CHECKPOINT: { base: paths.validator.checkpoint, routes: [{ path: paths.validator.checkpoint, Page: CheckpointPage }] },
  EMPLOYEE_ENROLL: { base: paths.employee.enroll, routes: [{ path: paths.employee.enroll, Page: EnrollmentPage }] },
  EMPLOYEE_PENDING: { base: paths.employee.pending, routes: [{ path: paths.employee.pending, Page: PendingValidationPage }] },
  EMPLOYEE_VERIFY: {
    base: paths.employee.dashboard,
    routes: [
      { path: paths.employee.dashboard, Page: VerificationMenuPage },
      { path: paths.employee.verify, Page: VerificationMenuPage },
      { path: paths.employee.verifyFace, Page: FaceVerificationPage },
      { path: paths.employee.verifyQr, Page: QrVerificationPage },
    ],
  },
  EMPLOYEE_QR: { base: paths.employee.myQr, routes: [{ path: paths.employee.myQr, Page: MyQrPage }] },
  EMPLOYEE_SELECT_COMPANY: { base: paths.selectCompany, routes: [{ path: paths.selectCompany, Page: CompanySelectPage }], bare: true },
  PROFILE: { base: paths.profile, routes: [{ path: paths.profile, Page: ProfilePage }] },
};

/** Íconos que el backend puede nombrar (`catalog.screens.icon`); uno desconocido muestra un círculo. */
const ICONS: Record<string, LucideIcon> = {
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  QrCode,
  ScanFace,
  ScanLine,
  Settings2,
  UserCircle2,
  Users,
};

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Circle;
}

/** Todas las rutas que la aplicación sabe dibujar (para distinguir "no permitida" de "no existe"). */
export const KNOWN_ROUTES = Object.values(SCREEN_VIEWS).flatMap((view) => view.routes.map((route) => route.path));
