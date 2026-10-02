import type { EnrollmentStatus, FaceStatus } from '../types';

export function StatusBadge({ active }: { active: boolean }) {
  return <span className={`badge ${active ? 'badge--success' : 'badge--muted'}`}>{active ? 'Activo' : 'Inactivo'}</span>;
}

export function Badge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`badge ${ok ? 'badge--info' : 'badge--warning'}`}>{ok ? yes : no}</span>;
}

export const FACE_STATUS_LABEL: Record<FaceStatus, string> = {
  NOT_ENROLLED: 'Sin registrar',
  PENDING_REVIEW: 'En validación',
  APPROVED: 'Validado',
  REJECTED: 'Rechazado',
};

const FACE_STATUS_CLASS: Record<FaceStatus, string> = {
  NOT_ENROLLED: 'badge--muted',
  PENDING_REVIEW: 'badge--warning badge--live',
  APPROVED: 'badge--success',
  REJECTED: 'badge--danger',
};

export function FaceStatusBadge({ status }: { status: FaceStatus }) {
  return <span className={`badge ${FACE_STATUS_CLASS[status]}`}>{FACE_STATUS_LABEL[status]}</span>;
}

const ENROLLMENT_LABEL: Record<EnrollmentStatus, [string, string]> = {
  PENDING: ['Pendiente', 'badge--warning badge--live'],
  APPROVED: ['Aceptado', 'badge--success'],
  REJECTED: ['Rechazado', 'badge--danger'],
};

export function EnrollmentBadge({ status }: { status: EnrollmentStatus }) {
  const [label, cls] = ENROLLMENT_LABEL[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}
