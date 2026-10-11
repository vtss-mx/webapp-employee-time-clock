import type { ComponentType } from 'react';
import { retryableLazy } from '../components/retryableLazy';
import { clearReloadMark } from '../services/versionReload';
import { importWithRetry } from '../utils/importRetry';

/**
 * Carga diferida (code splitting): cada pantalla es un archivo aparte que se descarga solo al
 * visitarla. Un administrador nunca descarga las pantallas de cámara (MediaPipe, lector QR) y el
 * empleado o el validador no descargan las de administración.
 * Si la descarga falla se repite una vez; si vuelve a fallar, el ErrorBoundary ofrece "Reintentar"
 * (que la descarga de nuevo). Cargar bien una pantalla confirma que esta versión funciona y libera
 * la marca de recarga por versión nueva.
 */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return retryableLazy(async () => {
    const module = await importWithRetry(load);
    clearReloadMark();
    return { default: module[name] };
  });
}

// Públicas y comunes
export const LoginPage = page(() => import('../pages/LoginPage'), 'LoginPage');
export const ProfilePage = page(() => import('../pages/ProfilePage'), 'ProfilePage');
/** Llave de acceso (WebAuthn): registrar una en este dispositivo o renombrarla (Mi perfil → Llaves de acceso). */
export const PasskeyFormPage = page(() => import('../pages/PasskeyFormPage'), 'PasskeyFormPage');
/** Consentimiento biométrico: el texto del servidor y su botón para otorgarlo (Mi perfil → Datos biométricos). */
export const ConsentsPage = page(() => import('../pages/ConsentsPage'), 'ConsentsPage');
export const ForbiddenPage = page(() => import('../pages/ForbiddenPage'), 'ForbiddenPage');
export const NotFoundPage = page(() => import('../pages/NotFoundPage'), 'NotFoundPage');
/** Tableta de un sitio (pública, sin sesión): el código que el personal escanea o escribe al verificar su identidad. */
export const KioskPage = page(() => import('../pages/KioskPage'), 'KioskPage');

// ADMIN (plataforma)
export const AdminDashboardPage = page(() => import('../pages/admin/AdminDashboardPage'), 'AdminDashboardPage');
export const CompaniesListPage = page(() => import('../pages/admin/CompaniesListPage'), 'CompaniesListPage');
export const CompanyCreatePage = page(() => import('../pages/admin/CompanyCreatePage'), 'CompanyCreatePage');
export const CompanyDetailPage = page(() => import('../pages/admin/CompanyDetailPage'), 'CompanyDetailPage');
export const CompanyEditPage = page(() => import('../pages/admin/CompanyEditPage'), 'CompanyEditPage');
export const CompanyPolicyPage = page(() => import('../pages/admin/CompanyPolicyPage'), 'CompanyPolicyPage');
export const RejectPolicyChangePage = page(() => import('../pages/admin/RejectPolicyChangePage'), 'RejectPolicyChangePage');
export const CompanyEmployeesPage = page(() => import('../pages/admin/CompanyEmployeesPage'), 'CompanyEmployeesPage');
export const CompanyDocumentUploadPage = page(() => import('../pages/admin/CompanyDocumentUploadPage'), 'CompanyDocumentUploadPage');
export const FaceSecurityPage = page(() => import('../pages/admin/FaceSecurityPage'), 'FaceSecurityPage');
export const DriftPage = page(() => import('../pages/admin/drift/DriftPage'), 'DriftPage');
export const BillingPage = page(() => import('../pages/admin/billing/BillingPage'), 'BillingPage');
export const CompanyBillingPage = page(() => import('../pages/admin/billing/CompanyBillingPage'), 'CompanyBillingPage');
export const PaymentFormPage = page(() => import('../pages/admin/billing/PaymentFormPage'), 'PaymentFormPage');
export const ChargeDetailPage = page(() => import('../pages/admin/billing/ChargeDetailPage'), 'ChargeDetailPage');
export const VoidPaymentPage = page(() => import('../pages/admin/billing/BillingReasonPages'), 'VoidPaymentPage');
export const VoidChargePage = page(() => import('../pages/admin/billing/BillingReasonPages'), 'VoidChargePage');
export const SuspendCompanyPage = page(() => import('../pages/admin/billing/BillingReasonPages'), 'SuspendCompanyPage');
export const UsagePage = page(() => import('../pages/admin/usage/UsagePage'), 'UsagePage');
export const CompanyUsagePage = page(() => import('../pages/admin/usage/CompanyUsagePage'), 'CompanyUsagePage');
export const PerformancePage = page(() => import('../pages/admin/performance/PerformancePage'), 'PerformancePage');
export const MetricDetailPage = page(() => import('../pages/admin/performance/MetricDetailPage'), 'MetricDetailPage');
export const SlowAlertDetailPage = page(() => import('../pages/admin/performance/SlowAlertDetailPage'), 'SlowAlertDetailPage');
/** Bitácora de auditoría (migración 0095): evidencia de solo lectura, con su exportación por tramos. */
export const AuditPage = page(() => import('../pages/admin/audit/AuditPage'), 'AuditPage');
/** Revisión de accesos (migración 0096): el informe trimestral que pide un auditor, con sus controles declarados. */
export const AccessReviewPage = page(() => import('../pages/admin/accessReview/AccessReviewPage'), 'AccessReviewPage');
export const AdminVerificationsPage = page(() => import('../pages/admin/verifications/VerificationsPage'), 'AdminVerificationsPage');
export const AdminVerificationDetailPage = page(() => import('../pages/verifications/VerificationDetailPages'), 'AdminVerificationDetailPage');
export const CompanyVerificationDetailPage = page(() => import('../pages/verifications/VerificationDetailPages'), 'CompanyVerificationDetailPage');
export const FraudCasesPage = page(() => import('../pages/admin/fraud/FraudCasesPage'), 'FraudCasesPage');
export const FraudCaseDetailPage = page(() => import('../pages/admin/fraud/FraudCaseDetailPage'), 'FraudCaseDetailPage');
export const FraudCaseDecisionPage = page(() => import('../pages/admin/fraud/FraudCaseFormPages'), 'FraudCaseDecisionPage');
export const FraudCaseNotePage = page(() => import('../pages/admin/fraud/FraudCaseFormPages'), 'FraudCaseNotePage');

// COMPANY
export const DashboardPage = page(() => import('../pages/company/DashboardPage'), 'DashboardPage');
export const SitesPage = page(() => import('../pages/company/sites/SitesPage'), 'SitesPage');
export const SiteFormPage = page(() => import('../pages/company/sites/SiteFormPage'), 'SiteFormPage');
export const SiteKiosksPage = page(() => import('../pages/company/sites/SiteKiosksPage'), 'SiteKiosksPage');
export const KioskFormPage = page(() => import('../pages/company/sites/KioskFormPage'), 'KioskFormPage');
export const EmployeesListPage = page(() => import('../pages/company/EmployeesListPage'), 'EmployeesListPage');
export const EmployeeCreatePage = page(() => import('../pages/company/EmployeeCreatePage'), 'EmployeeCreatePage');
export const EmployeeDetailPage = page(() => import('../pages/company/EmployeeDetailPage'), 'EmployeeDetailPage');
export const EmployeeEditPage = page(() => import('../pages/company/EmployeeEditPage'), 'EmployeeEditPage');
export const EmployeeFacePage = page(() => import('../pages/company/EmployeeFacePage'), 'EmployeeFacePage');
export const ValidationsPage = page(() => import('../pages/company/ValidationsPage'), 'ValidationsPage');
export const VerificationsPage = page(() => import('../pages/company/VerificationsPage'), 'VerificationsPage');
export const ValidationReviewPage = page(() => import('../pages/company/ValidationReviewPage'), 'ValidationReviewPage');
export const ApiKeysPage = page(() => import('../pages/company/ApiKeysPage'), 'ApiKeysPage');
export const ApiKeyFormPage = page(() => import('../pages/company/ApiKeyFormPage'), 'ApiKeyFormPage');
/** Claves de firma de la empresa (sección de Integraciones, migración 0105): el listado y el formulario. */
export const SigningKeysPage = page(() => import('../pages/company/SigningKeysPage'), 'SigningKeysPage');
export const SigningKeyFormPage = page(() => import('../pages/company/SigningKeyFormPage'), 'SigningKeyFormPage');
export const DocumentsPage = page(() => import('../pages/company/DocumentsPages'), 'DocumentsPage');
export const DocumentUploadPage = page(() => import('../pages/company/DocumentsPages'), 'DocumentUploadPage');
export const ValidatorsPage = page(() => import('../pages/company/ValidatorsPage'), 'ValidatorsPage');
export const ValidatorFormPage = page(() => import('../pages/company/ValidatorFormPage'), 'ValidatorFormPage');
export const ValidatorDevicesPage = page(() => import('../pages/company/ValidatorDevicesPage'), 'ValidatorDevicesPage');

// VALIDATOR (punto de control)
export const CheckpointPage = page(() => import('../pages/validator/CheckpointPage'), 'CheckpointPage');

// EMPLOYEE
export const EnrollmentPage = page(() => import('../pages/employee/EnrollmentPage'), 'EnrollmentPage');
/**
 * Las pantallas de los pasos del registro de identidad (decisión del dueño, 2026-10-08: el flujo es dinámico y los
 * documentos de identidad son pasos). Cada una es una ruta hija de la pantalla `EMPLOYEE_ENROLL`.
 */
export const EnrollmentPhotoPage = page(() => import('../pages/employee/EnrollmentStepPages'), 'EnrollmentPhotoPage');
export const EnrollmentCapturePage = page(() => import('../pages/employee/EnrollmentStepPages'), 'EnrollmentCapturePage');
export const EnrollmentVoicePage = page(() => import('../pages/employee/EnrollmentStepPages'), 'EnrollmentVoicePage');
export const EnrollmentDocumentPage = page(() => import('../pages/employee/EnrollmentStepPages'), 'EnrollmentDocumentPage');
export const EnrollmentDocumentUploadPage = page(() => import('../pages/employee/EnrollmentStepPages'), 'EnrollmentDocumentUploadPage');
export const CompanySelectPage = page(() => import('../pages/employee/CompanySelectPage'), 'CompanySelectPage');
export const PendingValidationPage = page(() => import('../pages/employee/PendingValidationPage'), 'PendingValidationPage');
export const VerificationMenuPage = page(() => import('../pages/employee/VerificationMenuPage'), 'VerificationMenuPage');
export const FaceVerificationPage = page(() => import('../pages/employee/FaceVerificationPage'), 'FaceVerificationPage');
export const MyQrPage = page(() => import('../pages/employee/MyQrPage'), 'MyQrPage');
export const ValidatorPasswordPage = page(() => import('../pages/company/ValidatorPasswordPage'), 'ValidatorPasswordPage');
export const ReverifyIdentityPage = page(() => import('../pages/company/ReverifyIdentityPage'), 'ReverifyIdentityPage');
export const ReverifyAllPage = page(() => import('../pages/company/ReverifyIdentityPage'), 'ReverifyAllPage');
export const RejectEnrollmentPage = page(() => import('../pages/company/RejectEnrollmentPage'), 'RejectEnrollmentPage');
export const CompanyAdminFormPage = page(() => import('../pages/admin/CompanyAdminFormPage'), 'CompanyAdminFormPage');
export const ErrorsPage = page(() => import('../pages/admin/ErrorsPage'), 'ErrorsPage');
export const ErrorDetailPage = page(() => import('../pages/admin/ErrorDetailPage'), 'ErrorDetailPage');
