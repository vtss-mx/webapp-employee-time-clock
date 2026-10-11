import { useCatalogs } from '../hooks/useCatalogs';
import { useT } from '../i18n';
import type { ApiKeyStatus, DeviceStatus, EnrollmentStatus, FaceStatus, StatusTone } from '../types';

export function StatusBadge({ active }: { active: boolean }) {
  const t = useT();
  return <span className={`badge ${active ? 'badge--success' : 'badge--muted'}`}>{active ? t('common.states.active') : t('common.states.inactive')}</span>;
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
/** Catálogos con tono (`StatusItem`): su nombre y su color salen de la BD. */
export type StatusCatalog =
  | 'face_statuses'
  | 'enrollment_statuses'
  | 'device_statuses'
  | 'api_key_statuses'
  | 'error_statuses'
  | 'error_severities'
  | 'billing_statuses'
  | 'charge_statuses'
  | 'payment_statuses'
  | 'slow_alert_statuses'
  | 'risk_tiers'
  | 'policy_change_statuses'
  | 'fraud_case_statuses';

export function CatalogStatusBadge({ catalog, code }: { catalog: StatusCatalog; code: string }) {
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

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return <CatalogStatusBadge catalog="device_statuses" code={status} />;
}

export function ApiKeyStatusBadge({ status }: { status: ApiKeyStatus }) {
  return <CatalogStatusBadge catalog="api_key_statuses" code={status} />;
}
