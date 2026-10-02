import { useCatalogs } from '../hooks/useCatalogs';
import type { EnrollmentStatus, FaceStatus, StatusTone } from '../types';

export function StatusBadge({ active }: { active: boolean }) {
  return <span className={`badge ${active ? 'badge--success' : 'badge--muted'}`}>{active ? 'Activo' : 'Inactivo'}</span>;
}

export function Badge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`badge ${ok ? 'badge--info' : 'badge--warning'}`}>{ok ? yes : no}</span>;
}

/** Clase de cada tono del catálogo. "warning" es un estado en espera: su punto late. */
const TONE_CLASS: Record<StatusTone, string> = {
  muted: 'badge--muted',
  info: 'badge--info',
  success: 'badge--success',
  warning: 'badge--warning badge--live',
  danger: 'badge--danger',
};

/** Estado de un catálogo con tono (registro facial o solicitud): nombre y tono vienen de la BD. */
function CatalogStatusBadge({ catalog, code }: { catalog: 'face_statuses' | 'enrollment_statuses'; code: string }) {
  const { byCode } = useCatalogs();
  const status = byCode(catalog, code);
  return <span className={`badge ${TONE_CLASS[status?.tone ?? 'muted']}`}>{status?.name ?? code}</span>;
}

export function FaceStatusBadge({ status }: { status: FaceStatus }) {
  return <CatalogStatusBadge catalog="face_statuses" code={status} />;
}

export function EnrollmentBadge({ status }: { status: EnrollmentStatus }) {
  return <CatalogStatusBadge catalog="enrollment_statuses" code={status} />;
}
