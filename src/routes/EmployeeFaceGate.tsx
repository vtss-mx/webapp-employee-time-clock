import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { needsCompanySelection, paths } from './paths';

/**
 * Dirige al empleado según el estado de su registro facial:
 *  NOT_ENROLLED / REJECTED → registro facial
 *  PENDING_REVIEW          → pantalla "en validación"
 *  APPROVED                → menú de identificación
 * El backend aplica la misma regla (403 FACE_NOT_APPROVED).
 */
export function EmployeeFaceGate() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const status = user?.employee?.face_status;
  // Trabaja en varias empresas y aún no elige a cuál entrar.
  if (user && needsCompanySelection(user)) return <Navigate to={paths.selectCompany} replace />;

  const target =
    status === 'APPROVED'
      ? null
      : status === 'PENDING_REVIEW'
        ? paths.employee.pending
        : paths.employee.enroll;

  if (target && pathname !== target) return <Navigate to={target} replace />;
  if (!target && (pathname === paths.employee.enroll || pathname === paths.employee.pending)) {
    return <Navigate to={paths.employee.dashboard} replace />;
  }
  return <Outlet />;
}
