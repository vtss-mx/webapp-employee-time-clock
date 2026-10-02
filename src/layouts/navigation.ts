import {
  Building2,
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
import { paths } from '../routes/paths';
import type { User } from '../types';

export interface NavEntry {
  to: string;
  label: string;
  /** Etiqueta corta para la barra inferior en teléfonos. */
  short?: string;
  icon: LucideIcon;
  badge?: number | null;
}

/** Opciones del menú según el rol (y, para el empleado, el estado de su registro facial). */
export function navFor(user: User, pending: number | null): NavEntry[] {
  if (user.role === 'ADMIN') {
    return [
      { to: paths.admin.dashboard, label: 'Panel', icon: LayoutDashboard },
      { to: paths.admin.companies, label: 'Empresas', icon: Building2 },
      { to: paths.profile, label: 'Mi perfil', short: 'Perfil', icon: UserCircle2 },
    ];
  }
  if (user.role === 'VALIDATOR') {
    return [
      { to: paths.validator.checkpoint, label: 'Identificar empleados', short: 'Identificar', icon: ScanFace },
      { to: paths.profile, label: 'Mi perfil', short: 'Perfil', icon: UserCircle2 },
    ];
  }
  const approved = user.employee?.face_status === 'APPROVED';
  return user.role === 'COMPANY'
    ? [
        { to: paths.company.dashboard, label: 'Dashboard', short: 'Inicio', icon: LayoutDashboard },
        { to: paths.company.employees, label: 'Empleados', icon: Users },
        { to: paths.company.validations, label: 'Validaciones', short: 'Validar', icon: ClipboardCheck, badge: pending },
        { to: paths.company.validators, label: 'Validadores', icon: ScanLine },
        { to: paths.company.settings, label: 'Configuración', short: 'Ajustes', icon: Settings2 },
        { to: paths.profile, label: 'Mi perfil', short: 'Perfil', icon: UserCircle2 },
      ]
    : [
        {
          to: approved
            ? paths.employee.dashboard
            : user.employee?.face_status === 'PENDING_REVIEW'
              ? paths.employee.pending
              : paths.employee.enroll,
          label: approved ? 'Identificación' : 'Registro facial',
          short: approved ? 'Identificar' : 'Mi rostro',
          icon: ScanFace,
        },
        // El QR de identidad solo existe para el empleado cuando COMPANY aprobó su identidad.
        ...(approved ? [{ to: paths.employee.myQr, label: 'Mi código QR', short: 'Mi QR', icon: QrCode }] : []),
        // Trabaja en varias empresas: puede cambiar de una a otra sin cerrar sesión.
        ...((user.memberships?.length ?? 0) > 1 ? [{ to: paths.selectCompany, label: 'Cambiar de empresa', short: 'Empresa', icon: Building2 }] : []),
        { to: paths.profile, label: 'Mi perfil', short: 'Perfil', icon: UserCircle2 },
      ];
}
