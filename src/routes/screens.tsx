import {
  Activity,
  Bug,
  Building2,
  Circle,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  MapPin,
  QrCode,
  Receipt,
  ScanFace,
  ScanLine,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TrendingDown,
  UserCheck,
  UserCircle2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import {
  AccessReviewPage,
  AdminDashboardPage,
  ApiKeyFormPage,
  ApiKeysPage,
  AdminVerificationDetailPage,
  AdminVerificationsPage,
  AuditPage,
  SiteFormPage,
  SiteKiosksPage,
  KioskFormPage,
  SitesPage,
  CheckpointPage,
  CompaniesListPage,
  CompanyCreatePage,
  CompanyDetailPage,
  CompanyEditPage,
  CompanySelectPage,
  CompanyVerificationDetailPage,
  DashboardPage,
  DriftPage,
  ErrorDetailPage,
  ErrorsPage,
  FaceSecurityPage,
  BillingPage,
  CompanyBillingPage,
  PaymentFormPage,
  ChargeDetailPage,
  VoidPaymentPage,
  VoidChargePage,
  SuspendCompanyPage,
  UsagePage,
  CompanyUsagePage,
  PerformancePage,
  MetricDetailPage,
  SlowAlertDetailPage,
  FraudCasesPage,
  FraudCaseDetailPage,
  FraudCaseDecisionPage,
  FraudCaseNotePage,
  RejectPolicyChangePage,
  EmployeeCreatePage,
  EmployeeDetailPage,
  EmployeeEditPage,
  EmployeeFacePage,
  EmployeesListPage,
  EnrollmentCapturePage,
  EnrollmentDocumentPage,
  EnrollmentDocumentUploadPage,
  EnrollmentPage,
  EnrollmentPhotoPage,
  EnrollmentVoicePage,
  FaceVerificationPage,
  MyQrPage,
  PendingValidationPage,
  PasskeyFormPage,
  ProfilePage,
  ConsentsPage,
  ValidationReviewPage,
  ValidationsPage,
  VerificationsPage,
  ValidatorDevicesPage,
  ValidatorPasswordPage,
  ReverifyAllPage,
  ReverifyIdentityPage,
  RejectEnrollmentPage,
  CompanyAdminFormPage,
  CompanyEmployeesPage,
  CompanyDocumentUploadPage,
  CompanyPolicyPage,
  DocumentsPage,
  DocumentUploadPage,
  SigningKeyFormPage,
  SigningKeysPage,
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
      { path: paths.admin.companyEmployees(':id'), Page: CompanyEmployeesPage },
      { path: paths.admin.companyPolicy(':id'), Page: CompanyPolicyPage },
      { path: paths.admin.rejectPolicyChange(':id', ':changeId'), Page: RejectPolicyChangePage },
      { path: paths.admin.newCompanyAdmin(':id'), Page: CompanyAdminFormPage },
      { path: paths.admin.companyAdminPassword(':id', ':adminId'), Page: CompanyAdminFormPage },
      { path: paths.admin.newCompanyDocument(':id'), Page: CompanyDocumentUploadPage },
    ],
  },
  ADMIN_ERRORS: {
    base: paths.admin.errors,
    routes: [
      { path: paths.admin.errors, Page: ErrorsPage },
      { path: paths.admin.error(':id'), Page: ErrorDetailPage },
    ],
  },
  // Bitácora de auditoría y revisión de accesos (migraciones 0095 y 0096): solo consultan y exportan; no hay
  // subpantallas porque no hay nada que crear, editar ni borrar (es evidencia).
  ADMIN_AUDIT: { base: paths.admin.audit, routes: [{ path: paths.admin.audit, Page: AuditPage }] },
  ADMIN_ACCESS_REVIEW: { base: paths.admin.accessReview, routes: [{ path: paths.admin.accessReview, Page: AccessReviewPage }] },
  ADMIN_FACE_SECURITY: { base: paths.admin.faceSecurity, routes: [{ path: paths.admin.faceSecurity, Page: FaceSecurityPage }] },
  ADMIN_DRIFT: { base: paths.admin.drift, routes: [{ path: paths.admin.drift, Page: DriftPage }] },
  ADMIN_VERIFICATIONS: {
    base: paths.admin.verifications,
    routes: [
      { path: paths.admin.verifications, Page: AdminVerificationsPage },
      { path: paths.admin.verification(':id'), Page: AdminVerificationDetailPage },
    ],
  },
  ADMIN_FRAUD_CASES: {
    base: paths.admin.fraudCases,
    routes: [
      { path: paths.admin.fraudCases, Page: FraudCasesPage },
      { path: paths.admin.fraudCase(':id'), Page: FraudCaseDetailPage },
      { path: paths.admin.fraudCaseDecision(':id', ':status'), Page: FraudCaseDecisionPage },
      { path: paths.admin.fraudCaseNote(':id'), Page: FraudCaseNotePage },
    ],
  },
  ADMIN_BILLING: {
    base: paths.admin.billing,
    routes: [
      { path: paths.admin.billing, Page: BillingPage },
      { path: paths.admin.companyBilling(':id'), Page: CompanyBillingPage },
      { path: paths.admin.newPayment(':id'), Page: PaymentFormPage },
      { path: paths.admin.voidPayment(':id', ':paymentId'), Page: VoidPaymentPage },
      { path: paths.admin.charge(':id', ':chargeId'), Page: ChargeDetailPage },
      { path: paths.admin.voidCharge(':id', ':chargeId'), Page: VoidChargePage },
      { path: paths.admin.suspendCompany(':id'), Page: SuspendCompanyPage },
    ],
  },
  ADMIN_USAGE: {
    base: paths.admin.usage,
    routes: [
      { path: paths.admin.usage, Page: UsagePage },
      { path: paths.admin.companyUsage(':id'), Page: CompanyUsagePage },
    ],
  },
  ADMIN_PERFORMANCE: {
    base: paths.admin.performance,
    routes: [
      { path: paths.admin.performance, Page: PerformancePage },
      { path: paths.admin.performanceMetric, Page: MetricDetailPage },
      { path: paths.admin.performanceAlert(':id'), Page: SlowAlertDetailPage },
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
      { path: paths.company.reverifyAll, Page: ReverifyAllPage },
      { path: paths.company.employeeFace(':id', ':mode'), Page: EmployeeFacePage },
    ],
  },
  COMPANY_VERIFICATIONS: {
    base: paths.company.verifications,
    routes: [
      { path: paths.company.verifications, Page: VerificationsPage },
      // El detalle de una verificación es otra ruta de la MISMA pantalla (no una pantalla nueva del seed).
      { path: paths.company.verification(':id'), Page: CompanyVerificationDetailPage },
    ],
  },
  COMPANY_SITES: {
    base: paths.company.sites,
    routes: [
      { path: paths.company.sites, Page: SitesPage },
      { path: paths.company.newSite, Page: SiteFormPage },
      { path: paths.company.editSite(':id'), Page: SiteFormPage },
      { path: paths.company.siteKiosks(':id'), Page: SiteKiosksPage },
      { path: paths.company.newSiteKiosk(':id'), Page: KioskFormPage },
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
  COMPANY_API: {
    base: paths.company.integrations,
    routes: [
      { path: paths.company.integrations, Page: ApiKeysPage },
      { path: paths.company.newApiKey, Page: ApiKeyFormPage },
      // Claves de FIRMA (migración 0105): otra sección de la MISMA pantalla, no una pantalla nueva.
      { path: paths.company.signingKeys, Page: SigningKeysPage },
      { path: paths.company.newSigningKey, Page: SigningKeyFormPage },
    ],
  },
  COMPANY_DOCUMENTS: {
    base: paths.company.documents,
    routes: [
      { path: paths.company.documents, Page: DocumentsPage },
      { path: paths.company.newDocument, Page: DocumentUploadPage },
    ],
  },
  VALIDATOR_CHECKPOINT: { base: paths.validator.checkpoint, routes: [{ path: paths.validator.checkpoint, Page: CheckpointPage }] },
  // Registro de identidad (decisión del dueño, 2026-10-08): el índice del flujo que pide la empresa y una ruta hija por
  // paso, todas en la MISMA pantalla. Los documentos de identidad son pasos (la pantalla «Mis documentos» se retiró):
  // su código del catálogo viaja en la ruta, así un paso de documentos nuevo no agrega rutas.
  EMPLOYEE_ENROLL: {
    base: paths.employee.enroll,
    routes: [
      { path: paths.employee.enroll, Page: EnrollmentPage },
      { path: paths.employee.enrollPhoto, Page: EnrollmentPhotoPage },
      { path: paths.employee.enrollCapture, Page: EnrollmentCapturePage },
      { path: paths.employee.enrollVoice, Page: EnrollmentVoicePage },
      { path: paths.employee.enrollDocument(':step'), Page: EnrollmentDocumentPage },
      { path: paths.employee.newEnrollmentDocument(':step'), Page: EnrollmentDocumentUploadPage },
    ],
  },
  EMPLOYEE_PENDING: { base: paths.employee.pending, routes: [{ path: paths.employee.pending, Page: PendingValidationPage }] },
  EMPLOYEE_VERIFY: {
    base: paths.employee.dashboard,
    routes: [
      { path: paths.employee.dashboard, Page: VerificationMenuPage },
      { path: paths.employee.verify, Page: VerificationMenuPage },
      { path: paths.employee.verifyFace, Page: FaceVerificationPage },
    ],
  },
  EMPLOYEE_QR: { base: paths.employee.myQr, routes: [{ path: paths.employee.myQr, Page: MyQrPage }] },
  EMPLOYEE_SELECT_COMPANY: { base: paths.selectCompany, routes: [{ path: paths.selectCompany, Page: CompanySelectPage }], bare: true },
  PROFILE: {
    base: paths.profile,
    routes: [
      { path: paths.profile, Page: ProfilePage },
      { path: paths.profilePasskeyNew, Page: PasskeyFormPage },
      { path: paths.profilePasskeyRename(':id'), Page: PasskeyFormPage },
      { path: paths.profileConsents, Page: ConsentsPage },
    ],
  },
};

/** Íconos que el backend puede nombrar (`catalog.screens.icon`); uno desconocido muestra un círculo. */
const ICONS: Record<string, LucideIcon> = {
  Activity,
  Bug,
  Building2,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  MapPin,
  QrCode,
  Receipt,
  ScanFace,
  ScanLine,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TrendingDown,
  UserCheck,
  UserCircle2,
  Users,
  Wallet,
};

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Circle;
}

/** Todas las rutas que la aplicación sabe dibujar (para distinguir "no permitida" de "no existe"). */
export const KNOWN_ROUTES = Object.values(SCREEN_VIEWS).flatMap((view) => view.routes.map((route) => route.path));
