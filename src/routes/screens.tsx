import {
  Activity,
  Bug,
  Building2,
  CalendarClock,
  CalendarDays,
  Circle,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Network,
  QrCode,
  Receipt,
  ScanFace,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Timer,
  UserCircle2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import {
  AdminDashboardPage,
  ApiKeyFormPage,
  ApiKeysPage,
  AbsenceFormPage,
  AbsenceRejectPage,
  AbsenceRequestFormPage,
  AssignShiftPage,
  BulkAssignPage,
  CalendarPage,
  HolidayFormPage,
  ManualSessionPage,
  MyDaysOffPage,
  WorkdayFormPage,
  AttendanceHistoryPage,
  AttendancePage,
  AttendanceRecordPage,
  AttendanceSessionPage,
  RejectAttendanceReviewPage,
  EmployeeShiftsPage,
  MyAttendanceHistoryPage,
  MyAttendancePage,
  MyShiftRequestsPage,
  ShiftFormPage,
  ShiftRequestApprovePage,
  ShiftRequestFormPage,
  ShiftRequestRejectPage,
  ShiftRequestsPage,
  ShiftsPage,
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
  DashboardPage,
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
  DepartmentAssignPage,
  DepartmentDetailPage,
  DepartmentFormPage,
  DepartmentsPage,
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
  ValidationReviewPage,
  ValidationsPage,
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
  ADMIN_FACE_SECURITY: { base: paths.admin.faceSecurity, routes: [{ path: paths.admin.faceSecurity, Page: FaceSecurityPage }] },
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
  COMPANY_DEPARTMENTS: {
    base: paths.company.departments,
    routes: [
      { path: paths.company.departments, Page: DepartmentsPage },
      { path: paths.company.newDepartment, Page: DepartmentFormPage },
      { path: paths.company.department(':id'), Page: DepartmentDetailPage },
      { path: paths.company.editDepartment(':id'), Page: DepartmentFormPage },
      { path: paths.company.assignDepartment(':id', ':role'), Page: DepartmentAssignPage },
    ],
  },
  COMPANY_ATTENDANCE: {
    base: paths.company.attendance,
    routes: [
      { path: paths.company.attendance, Page: AttendancePage },
      { path: paths.company.attendanceHistory, Page: AttendanceHistoryPage },
      { path: paths.company.attendanceSession(':id'), Page: AttendanceSessionPage },
      { path: paths.company.newAttendanceSession, Page: ManualSessionPage },
      { path: paths.company.correctAttendanceSession(':id'), Page: ManualSessionPage },
      { path: paths.company.rejectAttendanceReview(':id'), Page: RejectAttendanceReviewPage },
    ],
  },
  COMPANY_SHIFTS: {
    base: paths.company.shifts,
    routes: [
      { path: paths.company.shifts, Page: ShiftsPage },
      { path: paths.company.newShift, Page: ShiftFormPage },
      { path: paths.company.editShift(':id'), Page: ShiftFormPage },
      { path: paths.company.shiftRequests, Page: ShiftRequestsPage },
      { path: paths.company.approveShiftRequest(':id'), Page: ShiftRequestApprovePage },
      { path: paths.company.rejectShiftRequest(':id'), Page: ShiftRequestRejectPage },
      { path: paths.company.employeeShifts(':id'), Page: EmployeeShiftsPage },
      { path: paths.company.assignShift(':id'), Page: AssignShiftPage },
      { path: paths.company.bulkAssignShift, Page: BulkAssignPage },
    ],
  },
  COMPANY_CALENDAR: {
    base: paths.company.calendar,
    routes: [
      { path: paths.company.calendar, Page: CalendarPage },
      { path: paths.company.newHoliday, Page: HolidayFormPage },
      { path: paths.company.newAbsence, Page: AbsenceFormPage },
      { path: paths.company.rejectAbsence(':id'), Page: AbsenceRejectPage },
      { path: paths.company.newWorkday, Page: WorkdayFormPage },
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
  EMPLOYEE_ATTENDANCE: {
    base: paths.employee.attendance,
    routes: [
      { path: paths.employee.attendance, Page: MyAttendancePage },
      { path: paths.employee.recordAttendance(':action'), Page: AttendanceRecordPage },
      { path: paths.employee.attendanceHistory, Page: MyAttendanceHistoryPage },
      { path: paths.employee.shiftRequests, Page: MyShiftRequestsPage },
      { path: paths.employee.newShiftRequest, Page: ShiftRequestFormPage },
      { path: paths.employee.daysOff, Page: MyDaysOffPage },
      { path: paths.employee.newAbsenceRequest, Page: AbsenceRequestFormPage },
    ],
  },
  EMPLOYEE_ENROLL: { base: paths.employee.enroll, routes: [{ path: paths.employee.enroll, Page: EnrollmentPage }] },
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
  PROFILE: { base: paths.profile, routes: [{ path: paths.profile, Page: ProfilePage }] },
};

/** Íconos que el backend puede nombrar (`catalog.screens.icon`); uno desconocido muestra un círculo. */
const ICONS: Record<string, LucideIcon> = {
  Activity,
  Bug,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Network,
  QrCode,
  Receipt,
  ScanFace,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Timer,
  UserCircle2,
  Users,
  Wallet,
};

export function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Circle;
}

/** Todas las rutas que la aplicación sabe dibujar (para distinguir "no permitida" de "no existe"). */
export const KNOWN_ROUTES = Object.values(SCREEN_VIEWS).flatMap((view) => view.routes.map((route) => route.path));
