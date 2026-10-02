import { lazy, type ComponentType } from 'react';

/**
 * Carga diferida (code splitting): cada pantalla es un archivo aparte que se descarga solo al
 * visitarla. Un administrador nunca descarga las pantallas de cámara (MediaPipe, lector QR) y el
 * empleado o el validador no descargan las de administración.
 */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(async () => ({ default: (await load())[name] }));
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

// COMPANY
export const DashboardPage = page(() => import('../pages/company/DashboardPage'), 'DashboardPage');
export const EmployeesListPage = page(() => import('../pages/company/EmployeesListPage'), 'EmployeesListPage');
export const EmployeeCreatePage = page(() => import('../pages/company/EmployeeCreatePage'), 'EmployeeCreatePage');
export const EmployeeDetailPage = page(() => import('../pages/company/EmployeeDetailPage'), 'EmployeeDetailPage');
export const EmployeeEditPage = page(() => import('../pages/company/EmployeeEditPage'), 'EmployeeEditPage');
export const ValidationsPage = page(() => import('../pages/company/ValidationsPage'), 'ValidationsPage');
export const ValidationReviewPage = page(() => import('../pages/company/ValidationReviewPage'), 'ValidationReviewPage');
export const SettingsPage = page(() => import('../pages/company/SettingsPage'), 'SettingsPage');
export const ValidatorsPage = page(() => import('../pages/company/ValidatorsPage'), 'ValidatorsPage');

// VALIDATOR (punto de control)
export const CheckpointPage = page(() => import('../pages/validator/CheckpointPage'), 'CheckpointPage');

// EMPLOYEE
export const EnrollmentPage = page(() => import('../pages/employee/EnrollmentPage'), 'EnrollmentPage');
export const CompanySelectPage = page(() => import('../pages/employee/CompanySelectPage'), 'CompanySelectPage');
export const PendingValidationPage = page(() => import('../pages/employee/PendingValidationPage'), 'PendingValidationPage');
export const VerificationMenuPage = page(() => import('../pages/employee/VerificationMenuPage'), 'VerificationMenuPage');
export const FaceVerificationPage = page(() => import('../pages/employee/FaceVerificationPage'), 'FaceVerificationPage');
export const QrVerificationPage = page(() => import('../pages/employee/QrVerificationPage'), 'QrVerificationPage');
export const MyQrPage = page(() => import('../pages/employee/MyQrPage'), 'MyQrPage');
