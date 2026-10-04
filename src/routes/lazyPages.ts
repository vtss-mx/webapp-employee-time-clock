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
export const ForbiddenPage = page(() => import('../pages/ForbiddenPage'), 'ForbiddenPage');
export const NotFoundPage = page(() => import('../pages/NotFoundPage'), 'NotFoundPage');

// ADMIN (plataforma)
export const AdminDashboardPage = page(() => import('../pages/admin/AdminDashboardPage'), 'AdminDashboardPage');
export const CompaniesListPage = page(() => import('../pages/admin/CompaniesListPage'), 'CompaniesListPage');
export const CompanyCreatePage = page(() => import('../pages/admin/CompanyCreatePage'), 'CompanyCreatePage');
export const CompanyDetailPage = page(() => import('../pages/admin/CompanyDetailPage'), 'CompanyDetailPage');
export const CompanyEditPage = page(() => import('../pages/admin/CompanyEditPage'), 'CompanyEditPage');
export const CompanyEmployeesPage = page(() => import('../pages/admin/CompanyEmployeesPage'), 'CompanyEmployeesPage');

// COMPANY
export const DashboardPage = page(() => import('../pages/company/DashboardPage'), 'DashboardPage');
export const EmployeesListPage = page(() => import('../pages/company/EmployeesListPage'), 'EmployeesListPage');
export const EmployeeCreatePage = page(() => import('../pages/company/EmployeeCreatePage'), 'EmployeeCreatePage');
export const EmployeeDetailPage = page(() => import('../pages/company/EmployeeDetailPage'), 'EmployeeDetailPage');
export const EmployeeEditPage = page(() => import('../pages/company/EmployeeEditPage'), 'EmployeeEditPage');
export const EmployeeFacePage = page(() => import('../pages/company/EmployeeFacePage'), 'EmployeeFacePage');
export const ValidationsPage = page(() => import('../pages/company/ValidationsPage'), 'ValidationsPage');
export const ValidationReviewPage = page(() => import('../pages/company/ValidationReviewPage'), 'ValidationReviewPage');
export const SettingsPage = page(() => import('../pages/company/SettingsPage'), 'SettingsPage');
export const ApiKeysPage = page(() => import('../pages/company/ApiKeysPage'), 'ApiKeysPage');
export const ApiKeyFormPage = page(() => import('../pages/company/ApiKeyFormPage'), 'ApiKeyFormPage');
export const ValidatorsPage = page(() => import('../pages/company/ValidatorsPage'), 'ValidatorsPage');
export const ValidatorFormPage = page(() => import('../pages/company/ValidatorFormPage'), 'ValidatorFormPage');
export const ValidatorDevicesPage = page(() => import('../pages/company/ValidatorDevicesPage'), 'ValidatorDevicesPage');

// VALIDATOR (punto de control)
export const CheckpointPage = page(() => import('../pages/validator/CheckpointPage'), 'CheckpointPage');

// EMPLOYEE
export const EnrollmentPage = page(() => import('../pages/employee/EnrollmentPage'), 'EnrollmentPage');
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
export const DepartmentsPage = page(() => import('../pages/company/DepartmentsPage'), 'DepartmentsPage');
export const ReportsPage = page(() => import('../pages/company/reports/ReportsPage'), 'ReportsPage');
export const DepartmentFormPage = page(() => import('../pages/company/DepartmentFormPage'), 'DepartmentFormPage');
export const DepartmentDetailPage = page(() => import('../pages/company/DepartmentDetailPage'), 'DepartmentDetailPage');
export const DepartmentAssignPage = page(() => import('../pages/company/DepartmentAssignPage'), 'DepartmentAssignPage');
export const ErrorsPage = page(() => import('../pages/admin/ErrorsPage'), 'ErrorsPage');
export const ErrorDetailPage = page(() => import('../pages/admin/ErrorDetailPage'), 'ErrorDetailPage');
