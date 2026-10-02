import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from '../components/Spinner';
import { AppLayout } from '../layouts/AppLayout';
import { EmployeeFaceGate } from './EmployeeFaceGate';
import {
  AdminDashboardPage,
  CheckpointPage,
  CompaniesListPage,
  CompanySelectPage,
  CompanyCreatePage,
  CompanyDetailPage,
  CompanyEditPage,
  DashboardPage,
  EmployeeCreatePage,
  EmployeeDetailPage,
  EmployeeEditPage,
  EmployeesListPage,
  EnrollmentPage,
  FaceVerificationPage,
  ForbiddenPage,
  LoginPage,
  MyQrPage,
  NotFoundPage,
  PendingValidationPage,
  ProfilePage,
  QrVerificationPage,
  SettingsPage,
  ValidationReviewPage,
  ValidationsPage,
  ValidatorsPage,
  VerificationMenuPage,
} from './lazyPages';
import { paths } from './paths';
import { GuestOnlyRoute, ProtectedRoute, RoleHomeRedirect } from './ProtectedRoute';

/**
 * Rutas de la aplicación. Guardas (de afuera hacia adentro):
 * - GuestOnlyRoute: /login solo sin sesión (con sesión, al inicio de su rol).
 * - ProtectedRoute: requiere sesión; con `roles`, además el rol (ADMIN / COMPANY / EMPLOYEE / VALIDATOR).
 * - EmployeeFaceGate: el empleado va a registro, a "en validación" o al menú según su rostro.
 * Las pantallas se cargan bajo demanda (lazyPages); el backend valida de nuevo cada permiso.
 */
export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader text="Cargando..." />}>
      <Routes>
        <Route path="/" element={<RoleHomeRedirect />} />
        <Route element={<GuestOnlyRoute />}>
          <Route path={paths.login} element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          {/* Empleado en varias empresas: elige a cuál entrar (pantalla completa, como el login). */}
          <Route element={<ProtectedRoute roles={['EMPLOYEE']} />}>
            <Route path={paths.selectCompany} element={<CompanySelectPage />} />
          </Route>

          <Route element={<AppLayout />}>
            <Route path={paths.profile} element={<ProfilePage />} />
            <Route path={paths.forbidden} element={<ForbiddenPage />} />

            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/admin" element={<Navigate to={paths.admin.dashboard} replace />} />
              <Route path={paths.admin.dashboard} element={<AdminDashboardPage />} />
              <Route path={paths.admin.companies} element={<CompaniesListPage />} />
              <Route path={paths.admin.newCompany} element={<CompanyCreatePage />} />
              <Route path="/admin/companies/:id" element={<CompanyDetailPage />} />
              <Route path="/admin/companies/:id/edit" element={<CompanyEditPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['COMPANY']} />}>
              <Route path="/company" element={<Navigate to={paths.company.dashboard} replace />} />
              <Route path={paths.company.dashboard} element={<DashboardPage />} />
              <Route path={paths.company.employees} element={<EmployeesListPage />} />
              <Route path={paths.company.newEmployee} element={<EmployeeCreatePage />} />
              <Route path="/company/employees/:id" element={<EmployeeDetailPage />} />
              <Route path="/company/employees/:id/edit" element={<EmployeeEditPage />} />
              <Route path={paths.company.validations} element={<ValidationsPage />} />
              <Route path="/company/validations/:id" element={<ValidationReviewPage />} />
              <Route path={paths.company.validators} element={<ValidatorsPage />} />
              <Route path={paths.company.settings} element={<SettingsPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['VALIDATOR']} />}>
              <Route path="/validator" element={<Navigate to={paths.validator.checkpoint} replace />} />
              <Route path={paths.validator.checkpoint} element={<CheckpointPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={['EMPLOYEE']} />}>
              <Route element={<EmployeeFaceGate />}>
                <Route path="/employee" element={<Navigate to={paths.employee.dashboard} replace />} />
                <Route path={paths.employee.enroll} element={<EnrollmentPage />} />
                <Route path={paths.employee.pending} element={<PendingValidationPage />} />
                <Route path={paths.employee.dashboard} element={<VerificationMenuPage />} />
                <Route path={paths.employee.verify} element={<VerificationMenuPage />} />
                <Route path={paths.employee.verifyFace} element={<FaceVerificationPage />} />
                <Route path={paths.employee.verifyQr} element={<QrVerificationPage />} />
                <Route path={paths.employee.myQr} element={<MyQrPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
